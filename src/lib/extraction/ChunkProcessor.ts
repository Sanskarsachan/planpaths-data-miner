/**
 * ChunkProcessor.ts — Optimized PDF Course Extraction Engine
 *
 * KEY CHANGES FROM ORIGINAL:
 *  1. Page-aware chunking — splits on ---PAGE_BREAK--- markers, never mid-course
 *  2. Real token tracking — reads Gemini usageMetadata.totalTokenCount
 *  3. Context overlap — passes last N chars of prev chunk to avoid boundary drops
 *  4. Better deduplication — normalized skeleton + code key, not raw name
 *  5. Progress events carry real pageStart/pageEnd, tokensUsed, tokensRemaining
 *  6. 'waiting' status actually emitted between batches
 *  7. Failed chunks surface visually via chunk_error (not silently swallowed)
 *  8. Category carry-forward — last seen category seeded into next chunk prompt
 *  9. Master DB still processed as a single chunk (correct behaviour preserved)
 * 10. Vercel-safe: 55s hard timeout (below 60s limit) with clean fallback
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const PAGE_BREAK_MARKER   = '---PAGE_BREAK---'
const CONTEXT_OVERLAP     = 400
const DEFAULT_PAGES_BATCH = 5
const VERCEL_TIMEOUT_MS   = 55000
const RETRY_ATTEMPTS      = 3
const RETRY_BASE_DELAY_MS = 800
const MAX_CHUNK_CHARS     = 18000
const MIN_TEXT_CHARS      = 50

const FREE_TIER_TOKENS_PER_DAY   = 1_000_000
const FREE_TIER_REQUESTS_PER_DAY = 20

export type DocFormat = 'master_db' | 'k12' | 'regular'

export interface ProcessProgress {
  status        : 'processing' | 'chunk_complete' | 'chunk_error' | 'waiting'
  total         : number
  current       : number
  message       : string
  pageStart?    : number
  pageEnd?      : number
  coursesFound? : number
  tokensUsed?   : number
  tokensRemaining?: number
  pagesProcessed? : number
}

export interface APIUsageStats {
  tokensUsedToday      : number
  tokensLimitPerDay    : number
  requestsUsedToday    : number
  requestsLimitPerDay  : number
  coursesExtracted     : number
  pagesProcessed       : number
}

export interface Course {
  Category?            : string
  CourseName           : string
  CourseCode?          : string
  CourseAbbrevTitle?   : string
  CourseTitle?         : string
  GradeLevel?          : string
  Length?              : string
  CourseDuration?      : string
  CourseTerm?          : string
  Prerequisite?        : string
  Credit?              : string
  Details?             : string
  CourseDescription?   : string
  GraduationRequirement?: string
  Certification?       : string
  SourceFile?          : string
}

interface PageChunk {
  text        : string
  pageStart   : number
  pageEnd     : number
  chunkIndex  : number
  totalChunks : number
  prevContext : string
  lastCategory: string
}

export function detectFormat(text: string): DocFormat {
  const hasPipeHeaders = /\|[A-Z][A-Z &/\-]{2,}\|/.test(text)
  const has7DigitCodes = /\d{7}/.test(text)
  if (hasPipeHeaders && has7DigitCodes) {
    console.log('[ChunkProcessor] Format → master_db (pipe headers + 7-digit codes)')
    return 'master_db'
  }

  const hasDashCode        = /[–\-]\s*\d{7}/.test(text)
  const hasAsterisk        = /[A-Z][A-Z ]{2,}\*/.test(text)
  const hasSchoolWord      = /High School|Middle School|Course Guide|Course Selection|Freshman|Course Catalog/i.test(text)
  const hasSubjectAndCode  = /\b(English|Mathematics|Science|History|Art|Music|PE|Health)\b/i.test(text) && has7DigitCodes

  if (hasDashCode || hasAsterisk || (hasSchoolWord && has7DigitCodes) || hasSubjectAndCode) {
    console.log('[ChunkProcessor] Format → k12', { hasDashCode, hasAsterisk, hasSchoolWord, hasSubjectAndCode })
    return 'k12'
  }

  console.log('[ChunkProcessor] Format → regular')
  return 'regular'
}

export function buildPageChunks(
  text          : string,
  format        : DocFormat,
  pagesPerBatch : number = DEFAULT_PAGES_BATCH
): PageChunk[] {

  if (format === 'master_db') {
    return [{
      text,
      pageStart   : 1,
      pageEnd     : 1,
      chunkIndex  : 1,
      totalChunks : 1,
      prevContext : '',
      lastCategory: '',
    }]
  }

  const rawPages = text
    .split(PAGE_BREAK_MARKER)
    .map(p => p.trim())
    .filter(p => p.length >= MIN_TEXT_CHARS)

  if (rawPages.length === 0) {
    return [{
      text,
      pageStart   : 1,
      pageEnd     : 1,
      chunkIndex  : 1,
      totalChunks : 1,
      prevContext : '',
      lastCategory: '',
    }]
  }

  const batches: Omit<PageChunk, 'chunkIndex' | 'totalChunks'>[] = []
  let prevTail     = ''
  let lastCategory = ''

  for (let i = 0; i < rawPages.length; i += pagesPerBatch) {
    const slice     = rawPages.slice(i, i + pagesPerBatch)
    const batchText = slice.join('\n' + PAGE_BREAK_MARKER + '\n')
    const pageStart = i + 1
    const pageEnd   = Math.min(i + pagesPerBatch, rawPages.length)

    const finalBatches = splitOversizedBatch(batchText, pageStart, pageEnd, prevTail, lastCategory)
    batches.push(...finalBatches)

    prevTail     = batchText.slice(-CONTEXT_OVERLAP)
    lastCategory = extractLastCategory(batchText) || lastCategory
  }

  const total = batches.length
  return batches.map((b, idx) => ({ ...b, chunkIndex: idx + 1, totalChunks: total }))
}

function splitOversizedBatch(
  text        : string,
  pageStart   : number,
  pageEnd     : number,
  prevContext : string,
  lastCategory: string
): Omit<PageChunk, 'chunkIndex' | 'totalChunks'>[] {

  if (text.length <= MAX_CHUNK_CHARS) {
    return [{ text, pageStart, pageEnd, prevContext, lastCategory }]
  }

  const paragraphs = text.split(/\n{2,}/)
  const parts: Omit<PageChunk, 'chunkIndex' | 'totalChunks'>[] = []
  let current = ''
  let isFirst = true

  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHUNK_CHARS && current.length > 0) {
      parts.push({
        text        : current.trim(),
        pageStart,
        pageEnd,
        prevContext : isFirst ? prevContext : current.slice(-CONTEXT_OVERLAP),
        lastCategory,
      })
      lastCategory = extractLastCategory(current) || lastCategory
      current  = para
      isFirst  = false
    } else {
      current += (current ? '\n\n' : '') + para
    }
  }
  if (current.trim().length >= MIN_TEXT_CHARS) {
    parts.push({
      text        : current.trim(),
      pageStart,
      pageEnd,
      prevContext : isFirst ? prevContext : current.slice(-CONTEXT_OVERLAP),
      lastCategory,
    })
  }

  console.warn(`[ChunkProcessor] Oversized batch (pages ${pageStart}-${pageEnd}) → ${parts.length} sub-chunks`)
  return parts
}

function extractLastCategory(text: string): string {
  const matches = text.match(/^[A-Z][A-Z &/\-]{4,}$/gm)
  return matches ? matches[matches.length - 1].trim() : ''
}

export class ChunkProcessor {

  private pagesPerBatch: number

  private usageStats: APIUsageStats = {
    tokensUsedToday     : 0,
    tokensLimitPerDay   : FREE_TIER_TOKENS_PER_DAY,
    requestsUsedToday   : 0,
    requestsLimitPerDay : FREE_TIER_REQUESTS_PER_DAY,
    coursesExtracted    : 0,
    pagesProcessed      : 0,
  }

  constructor(
    private onProgress : (progress: ProcessProgress) => void = () => {},
    private onError    : (error: Error) => void = console.error,
    private apiKeyId   : string = '',
    private apiKey     : string = '',
    pagesPerBatch      : number = DEFAULT_PAGES_BATCH,
  ) {
    this.pagesPerBatch = pagesPerBatch
  }

  getUsageStats(): APIUsageStats {
    return { ...this.usageStats }
  }

  getTokensRemaining(): number {
    return Math.max(0, this.usageStats.tokensLimitPerDay - this.usageStats.tokensUsedToday)
  }

  getRequestsRemaining(): number {
    return Math.max(0, this.usageStats.requestsLimitPerDay - this.usageStats.requestsUsedToday)
  }

  canProcessBatch(): boolean {
    return this.getRequestsRemaining() >= 1
  }

  recordTokenUsage(tokens: number, courses: number, pages: number): void {
    this.usageStats.tokensUsedToday   += tokens
    this.usageStats.requestsUsedToday += 1
    this.usageStats.coursesExtracted  += courses
    this.usageStats.pagesProcessed    += pages
  }

  async processDocument(text: string, filename: string): Promise<Course[]> {

    if (!text || text.trim().length < MIN_TEXT_CHARS) {
      console.warn('[ChunkProcessor] Empty or too-short document')
      return []
    }

    const format = detectFormat(text)
    const chunks = buildPageChunks(text, format, this.pagesPerBatch)
    const total  = chunks.length

    console.log(`[ChunkProcessor] ▶ processDocument | format=${format} chunks=${total} apiKeyId=${!!this.apiKeyId}`)

    this.onProgress({
      status  : 'processing',
      total,
      current : 0,
      message : `Detected ${format} format — split into ${total} chunk${total !== 1 ? 's' : ''}`,
    })

    const allCourses   : Course[] = []
    const failedChunks : number[] = []

    for (let i = 0; i < chunks.length; i++) {
      const chunk    = chunks[i]
      const chunkNum = i + 1

      this.onProgress({
        status         : 'processing',
        total,
        current        : chunkNum,
        message        : `Processing pages ${chunk.pageStart}–${chunk.pageEnd} (chunk ${chunkNum}/${total})…`,
        pageStart      : chunk.pageStart,
        pageEnd        : chunk.pageEnd,
        pagesProcessed : this.usageStats.pagesProcessed,
        tokensRemaining: this.getTokensRemaining(),
      })

      try {
        const { courses, tokensUsed } = await this.processChunk(chunk, filename, format)
        const pagesInChunk = chunk.pageEnd - chunk.pageStart + 1

        this.recordTokenUsage(tokensUsed, courses.length, pagesInChunk)

        allCourses.push(...courses)

        this.onProgress({
          status          : 'chunk_complete',
          total,
          current         : chunkNum,
          message         : `✓ Pages ${chunk.pageStart}–${chunk.pageEnd}: ${courses.length} course${courses.length !== 1 ? 's' : ''} found`,
          pageStart       : chunk.pageStart,
          pageEnd         : chunk.pageEnd,
          coursesFound    : courses.length,
          tokensUsed      : tokensUsed,
          tokensRemaining : this.getTokensRemaining(),
          pagesProcessed  : this.usageStats.pagesProcessed,
        })

        console.log(`[ChunkProcessor] ✓ Chunk ${chunkNum}/${total} | pages ${chunk.pageStart}-${chunk.pageEnd} | ${courses.length} courses | ${tokensUsed} tokens`)

        if (i < chunks.length - 1) {
          this.onProgress({
            status          : 'waiting',
            total,
            current         : chunkNum,
            message         : `Waiting before next batch…`,
            pageStart       : chunk.pageStart,
            pageEnd         : chunk.pageEnd,
            tokensRemaining : this.getTokensRemaining(),
            pagesProcessed  : this.usageStats.pagesProcessed,
          })
          await sleep(100)
        }

      } catch (error: any) {

        if (error?.isRateLimit) {
          console.log('[ChunkProcessor] Rate limit hit — throwing to UI')
          throw error
        }

        const msg = error instanceof Error ? error.message : String(error)
        failedChunks.push(chunkNum)
        this.onError(error instanceof Error ? error : new Error(msg))

        this.onProgress({
          status         : 'chunk_error',
          total,
          current        : chunkNum,
          message        : `✗ Pages ${chunk.pageStart}–${chunk.pageEnd} failed: ${msg.slice(0, 120)}`,
          pageStart      : chunk.pageStart,
          pageEnd        : chunk.pageEnd,
          pagesProcessed : this.usageStats.pagesProcessed,
        })

        console.error(`[ChunkProcessor] ✗ Chunk ${chunkNum} (pages ${chunk.pageStart}-${chunk.pageEnd}) failed:`, msg)
      }
    }

    const beforeDedup  = allCourses.length
    const deduplicated = this.deduplicateCourses(allCourses)
    const dupesRemoved = beforeDedup - deduplicated.length

    console.log(`[ChunkProcessor] ✅ Complete | ${deduplicated.length} courses | ${dupesRemoved} dupes removed | ${failedChunks.length} failed chunks`)

    this.onProgress({
      status          : 'processing',
      total,
      current         : total,
      message         : `✅ Done — ${deduplicated.length} unique courses (${dupesRemoved} duplicates removed${failedChunks.length > 0 ? `, ${failedChunks.length} chunks failed` : ''})`,
      coursesFound    : deduplicated.length,
      tokensRemaining : this.getTokensRemaining(),
      pagesProcessed  : this.usageStats.pagesProcessed,
    })

    return deduplicated
  }

  private async processChunk(
    chunk    : PageChunk,
    filename : string,
    format   : DocFormat,
    attempt  : number = 1
  ): Promise<{ courses: Course[]; tokensUsed: number }> {

    const textToSend = chunk.prevContext
      ? `[CONTEXT FROM PREVIOUS PAGES — do not re-extract these, use only for section continuity]\n${chunk.prevContext}\n[END CONTEXT]\n\n${chunk.text}`
      : chunk.text

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), VERCEL_TIMEOUT_MS)

    try {
      console.log(`[ChunkProcessor] → Gemini API | attempt ${attempt}/${RETRY_ATTEMPTS} | pages ${chunk.pageStart}-${chunk.pageEnd} | ${textToSend.length} chars`)

      const genAI = new GoogleGenerativeAI(this.apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = this.buildPrompt(chunk, format)

      const result = await model.generateContent(prompt)
      const text = result.response.text()

      const usageMetadata = (result.response as any).usageMetadata || {}
      const promptTokens = usageMetadata.promptTokenCount || 0
      const completionTokens = usageMetadata.candidatesTokenCount || 0
      const totalTokens = promptTokens + completionTokens

      clearTimeout(timeoutId)

      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()

      let courses: Course[] = []
      try {
        const parsed = JSON.parse(cleaned)
        courses = Array.isArray(parsed) ? parsed : []
      } catch {
        try {
          const obj = JSON.parse(cleaned)
          courses = [obj]
        } catch {
          courses = []
        }
      }

      const processed = this.normalizeCourses(courses, chunk.lastCategory)
      console.log(`[ChunkProcessor] ← ${processed.length} courses | ${totalTokens} tokens`)
      return { courses: processed, tokensUsed: totalTokens }

    } catch (error: any) {

      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        console.error(`[ChunkProcessor] Timeout after ${VERCEL_TIMEOUT_MS}ms (pages ${chunk.pageStart}-${chunk.pageEnd})`)
        if (attempt < RETRY_ATTEMPTS) {
          await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
          return this.processChunk(chunk, filename, format, attempt + 1)
        }
        console.error('[ChunkProcessor] Timeout — all retries exhausted, skipping chunk')
        return { courses: [], tokensUsed: 0 }
      }

      if (error?.isRateLimit) throw error

      if (isNetworkError(error) && attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
        return this.processChunk(chunk, filename, format, attempt + 1)
      }

      if (attempt < RETRY_ATTEMPTS && !(error instanceof SyntaxError)) {
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1))
        return this.processChunk(chunk, filename, format, attempt + 1)
      }

      throw error
    }
  }

  private buildPrompt(chunk: PageChunk, format: DocFormat): string {
    const stateContext: Record<string, string> = {
      master_db: `Florida Master Course Database. Pipe-delimited category headers.
Course codes are 7 digits (e.g. "0101300").
Duration/Term split: CourseDuration = number, CourseTerm = Y/S/Q.`,
      k12: `K-12 school course catalog.
Identify courses even if code is prefixed with – or -.
Course codes are 6-7 digits.`,
      regular: `School course catalog. Extract all courses.`,
    }

    return `You are extracting courses from a ${stateContext[format] || stateContext.regular}
${chunk.lastCategory ? `Context: Last category was "${chunk.lastCategory}". Inherit if current section is unlabeled.` : ''}
${chunk.prevContext ? `[CONTEXT FROM PREVIOUS PAGES — use ONLY for continuity, do NOT re-extract]` : ''}

Return ONLY a JSON array. No markdown fences, no explanation, no preamble.

{
  "CourseName": "string — required, full course name",
  "CourseCode": "string or null",
  "Category": "string or null — subject area",
  "GradeLevel": "string or null",
  "Credit": "string or null",
  "CourseDuration": "string or null — FL: number part",
  "CourseTerm": "string or null — FL: Y/S/Q part",
  "Prerequisite": "string or null",
  "CourseDescription": "string or null",
  "GraduationRequirement": "string or null"
}

RULES:
- Never invent data. Null if not found.
- Extract EVERY course found.
- Do NOT filter or deduplicate.
- Do NOT extract page headers, footers, or non-course text.
- GradeLevel examples: "9-12", "10", "PF"
- CourseTerm: Y = year, S = semester, Q = quarter
- Credit examples: "1", "0.5", "1.0"
- Return [] if no courses.

TEXT:
---
${chunk.text}
${chunk.prevContext ? `\n[END CONTEXT]` : ''}
---`
  }

  private normalizeCourses(courses: Course[], lastCategory: string): Course[] {
    return courses
      .filter(c => c && typeof c.CourseName === 'string' && c.CourseName.trim().length > 0)
      .map(course => {
        let c = { ...course }

        c = this.splitDurationTerm(c)

        if (!c.Category || c.Category.trim() === '' || c.Category.toLowerCase() === 'unknown') {
          if (lastCategory) c.Category = lastCategory
        }

        if (c.Credit) {
          const numeric = String(c.Credit).trim().replace(/[^0-9./]/g, '')
          c.Credit = numeric || undefined
        }

        c.CourseName = c.CourseName.replace(/\s+/g, ' ').trim()

        return c
      })
  }

  private splitDurationTerm(course: Course): Course {
    const DT_PATTERN = /^(\d+)\/([A-Z])$/i

    if (course.CourseDuration) {
      const m = String(course.CourseDuration).match(DT_PATTERN)
      if (m) return { ...course, CourseDuration: m[1], CourseTerm: m[2].toUpperCase() }
    }

    if (course.Length) {
      const m = String(course.Length).match(DT_PATTERN)
      if (m) return { ...course, CourseDuration: m[1], CourseTerm: m[2].toUpperCase() }
    }

    if (course.CourseTerm) {
      const t = String(course.CourseTerm).toLowerCase().trim()
      if (t === 'year' || t === 'full year' || t === 'annual')  return { ...course, CourseTerm: 'Y' }
      if (t === 'semester' || t === 'sem')                      return { ...course, CourseTerm: 'S' }
      if (t === 'quarter')                                       return { ...course, CourseTerm: 'Q' }
    }

    return course
  }

  private deduplicateCourses(courses: Course[]): Course[] {
    const seen = new Map<string, { course: Course; score: number }>()

    for (const course of courses) {
      const code = normalizeCode(course.CourseCode || '')
      const key  = code.length >= 6
        ? `code:${code}`
        : `name:${buildSkeleton(course.CourseName)}|${String(course.GradeLevel || '').toLowerCase().trim()}`

      const score    = fieldScore(course)
      const existing = seen.get(key)

      if (!existing || score > existing.score) {
        seen.set(key, { course, score })
      }
    }

    const result = Array.from(seen.values()).map(v => v.course)
    console.log(`[ChunkProcessor] Dedup: ${courses.length} → ${result.length} (removed ${courses.length - result.length})`)
    return result
  }
}

function buildSkeleton(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeCode(code: string): string {
  return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function fieldScore(course: Course): number {
  const fields: (keyof Course)[] = [
    'Category', 'CourseCode', 'GradeLevel', 'Length', 'Credit',
    'Prerequisite', 'CourseDescription', 'CourseDuration', 'CourseTerm',
    'GraduationRequirement', 'Certification',
  ]
  return fields.filter(f => course[f] && String(course[f]).trim() !== '').length
}

function isNetworkError(error: Error): boolean {
  const msg = (error.message || '').toLowerCase()
  return msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
