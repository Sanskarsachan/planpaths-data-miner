import { randomUUID } from 'crypto'
import { schoolSlug } from '@/utils/slugify'
import { ChunkProcessor } from '@/lib/extraction/ChunkProcessor'
import { QuotaManager } from '@/lib/quota/QuotaManager'
import { createClient } from '@supabase/supabase-js'
import { createJob, updateJob } from '@/lib/extraction/JobStore'
import { hashCourse } from '@/utils/hashCourse'
import type { StateCode } from '@/types/database'

export const maxDuration = 300

const SUPPORTED_STATE_MAP: Record<string, StateCode> = {
  FL: 'FL', FLORIDA: 'FL',
  TX: 'TX', TEXAS: 'TX',
  CA: 'CA', CALIFORNIA: 'CA',
}

function normalizeState(input: string | null): StateCode | null {
  if (!input) return null
  return SUPPORTED_STATE_MAP[input.trim().toUpperCase()] ?? null
}

async function POST(req: Request) {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const quotaMgr = new QuotaManager(serviceSupabase, (msg, level) => {
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]'
    console.log(`${prefix} ${msg}`)
  })

  try {
    console.log(`[Extract] POST: Initiating extraction request`)
    const selectedKey = await quotaMgr.selectNextApiKey()
    if (!selectedKey?.key) {
      console.error('[Extract] POST: No API keys available')
      return Response.json({ error: 'No API keys available. Please check configuration.' }, { status: 503 })
    }

    const formData = await req.formData()
    const schoolName = formData.get('school_name') as string | null
    const stateInput = formData.get('state') as string | null
    const manualApiKeyId = formData.get('api_key_id') as string | null
    const fileEntry = formData.get('file')

    const pageStartRaw = formData.get('page_start') as string | null
    const pageEndRaw = formData.get('page_end') as string | null
    const pageStart = pageStartRaw ? parseInt(pageStartRaw, 10) : undefined
    const pageEnd = pageEndRaw ? parseInt(pageEndRaw, 10) : undefined

    if (!schoolName || !stateInput || !(fileEntry instanceof Blob)) {
      console.error('[Extract] POST: Missing required fields')
      return Response.json({ error: 'Missing required fields: school_name, state, file' }, { status: 400 })
    }

    const normalizedState = normalizeState(stateInput)
    if (!normalizedState) {
      console.error(`[Extract] POST: Unsupported state: ${stateInput}`)
      return Response.json({
        error: 'Unsupported state. Currently supported: Florida (FL), Texas (TX), California (CA).',
      }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer())

    let apiKeyToUse = selectedKey
    if (manualApiKeyId) {
      const manualKey = await quotaMgr.getApiKey(manualApiKeyId)
      if (manualKey?.key) {
        apiKeyToUse = manualKey
        console.log(`[Extract] POST: Using manually selected key: ${manualKey.nickname}`)
      }
    }

    const slug = schoolSlug(schoolName, normalizedState)
    const uploadId = randomUUID()
    createJob(uploadId, slug)
    console.log(`[Extract] POST: Created job ${uploadId} for ${slug}`)

    setImmediate(() => {
      runExtraction(uploadId, slug, normalizedState, fileBuffer, {
        apiKeyId: apiKeyToUse.id,
        apiKey: apiKeyToUse.key,
        schoolName,
        pageStart,
        pageEnd,
        quotaMgr,
      }).catch(err => {
        console.error(`[Extract] runExtraction failed for ${uploadId}: ${err.message}`)
        updateJob(uploadId, {
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        })
      })
    })

    return Response.json({ upload_id: uploadId, school_slug: slug }, { status: 201 })
  } catch (err: any) {
    console.error('[Extract] POST error:', err)
    return Response.json({ error: `Failed to process request: ${err.message}` }, { status: 500 })
  }
}

async function runExtraction(
  uploadId: string,
  slug: string,
  stateCode: StateCode,
  fileBuffer: Buffer,
  options?: {
    apiKeyId?: string
    apiKey?: string
    schoolName?: string
    pageStart?: number
    pageEnd?: number
    quotaMgr?: QuotaManager
  }
) {
  const start = Date.now()
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  
  const quotaMgr = options?.quotaMgr || new QuotaManager(serviceSupabase, (msg, level) => {
    const prefix = level === 'error' ? '[ERROR]' : level === 'warn' ? '[WARN]' : '[INFO]'
    console.log(`${prefix} ${msg}`)
  })

  const persistedRows: Array<{
    id: number
    name: string
    code: string
    category: string
    grade: string
    credit: string
    length: 'Y' | 'S'
  }> = []

  try {
    // Extract text from PDF
    const pdfParse = (await import('pdf-parse')).default
    const pdfData = await pdfParse(fileBuffer)
    let fullText = pdfData.text
    const totalPages = pdfData.numpages || 1

    // Insert page break markers using character-based division (more accurate than line-based)
    let text = fullText
    if (totalPages > 1) {
      const charsPerPage = Math.ceil(fullText.length / totalPages)
      const pages: string[] = []
      
      for (let i = 0; i < totalPages; i++) {
        const startIdx = i * charsPerPage
        const endIdx = Math.min((i + 1) * charsPerPage, fullText.length)
        pages.push(fullText.substring(startIdx, endIdx))
      }
      
      text = pages.join('\n---PAGE_BREAK---\n')
    }

    console.log(`[Extract] PDF detected pages: ${totalPages}`)

    // Apply page range filter if provided
    let actualPageStart = 1
    let actualPageEnd = totalPages
    
    if (options?.pageStart && options?.pageEnd) {
      actualPageStart = Math.max(1, options.pageStart)
      actualPageEnd = Math.min(totalPages, options.pageEnd)
      
      const pages = text.split('\n---PAGE_BREAK---\n')
      // Clamp to actual pages extracted
      const endIdx = Math.min(actualPageEnd, pages.length)
      const selectedPages = pages.slice(actualPageStart - 1, endIdx)
      text = selectedPages.join('\n---PAGE_BREAK---\n')
      
      console.log(`[Extract] Scope: selected range ${actualPageStart}-${actualPageEnd} (${totalPages} total pages)`)
    } else {
      console.log(`[Extract] Scope: all pages (1-${totalPages})`)
    }

    // Create processor with progress callback
    const apiKeyResolved = options?.apiKey || process.env.GEMINI_API_KEY || ''

    await serviceSupabase
      .from('uploads')
      .upsert({
        id: uploadId,
        school_slug: slug,
        filename: `${slug}.pdf`,
        state_code: stateCode,
        status: 'processing',
        total_chunks: 0,
        courses_found: 0,
        dupes_removed: 0,
      })

    const processor = new ChunkProcessor(
      (progress) => {
        console.log(`[Extract] Progress: ${progress.status} | ${progress.current}/${progress.total} | ${progress.message}`)
        updateJob(uploadId, {
          processing_status: `${progress.status} - ${progress.message}`,
          pagesProcessed: progress.pagesProcessed,
        })
      },
      (error) => {
        console.error('[Extract] Chunk error:', error)
      },
      options?.apiKeyId || '',
      apiKeyResolved,
      5, // pagesPerBatch
      async ({ chunkNum, total, pageStart, pageEnd, courses }) => {
        const chunkRows = courses.map((course, index) => ({
          id: persistedRows.length + index + 1,
          name: course.CourseName ?? 'Untitled Course',
          code: course.CourseCode ?? '',
          category: course.Category ?? 'General',
          grade: course.GradeLevel ?? '',
          credit: course.Credit ?? '',
          length: (course.CourseDuration && /year|full/i.test(course.CourseDuration) ? 'Y' : 'S') as 'Y' | 'S',
        }))

        persistedRows.push(...chunkRows)

        updateJob(uploadId, {
          courses_found: persistedRows.length,
          total_chunks: total,
          courses: [...persistedRows],
          processing_status: `processing - Appended pages ${pageStart}–${pageEnd} (${courses.length} courses)`
        })

        const extractedRows = courses.map((course) => ({
          upload_id: uploadId,
          school_slug: slug,
          state_code: stateCode,
          course_name: course.CourseName,
          course_code: course.CourseCode ?? null,
          category: course.Category ?? null,
          grade_level: course.GradeLevel ?? null,
          credits: course.Credit ?? null,
          course_duration: course.CourseDuration ?? null,
          course_term: course.CourseTerm ?? null,
          grad_requirement: course.GraduationRequirement ?? null,
          description: course.CourseDescription ?? null,
          chunk_index: chunkNum,
          content_hash: hashCourse(course.CourseName, course.CourseCode ?? null, slug),
        }))

        if (extractedRows.length > 0) {
          await serviceSupabase
            .from('extractions_v2')
            .upsert(extractedRows, { onConflict: 'school_slug,content_hash', ignoreDuplicates: true })
        }

        await serviceSupabase
          .from('uploads')
          .update({
            total_chunks: total,
            courses_found: persistedRows.length,
            status: 'processing',
          })
          .eq('id', uploadId)
      }
    )

    // Process document
    console.log(`[Extract] Starting ChunkProcessor for ${slug} (${text.length} chars)`)
    const courses = await processor.processDocument(text, `${slug}.pdf`)

    // Map to UI format
    const rows = courses.map((course, index) => ({
      id: index + 1,
      name: course.CourseName ?? 'Untitled Course',
      code: course.CourseCode ?? '',
      category: course.Category ?? 'General',
      grade: course.GradeLevel ?? '',
      credit: course.Credit ?? '',
      length: (course.CourseDuration && /year|full/i.test(course.CourseDuration) ? 'Y' : 'S') as 'Y' | 'S',
    }))

    const processingTime = Date.now() - start
    const stats = processor.getUsageStats()
    
    // Use persisted course count (from per-chunk callbacks) for accuracy
    const finalCourseCount = persistedRows.length > 0 ? persistedRows.length : courses.length

    console.log(`[Extract] Complete | ${finalCourseCount} courses | ${processingTime}ms | tokens: ${stats.tokensUsedToday}`)

    updateJob(uploadId, {
      status: 'complete',
      courses_found: finalCourseCount,
      total_chunks: Math.max(1, processor.getUsageStats().requestsUsedToday),
      processing_ms: processingTime,
      completed_at: new Date().toISOString(),
      courses: persistedRows.length > 0 ? persistedRows : rows,
    })

    await serviceSupabase
      .from('uploads')
      .update({
        status: 'complete',
        courses_found: finalCourseCount,
        processing_ms: processingTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', uploadId)
  } catch (err: any) {
    const errorMsg = err?.message || String(err)
    const statusCode = err?.status || err?.statusCode
    
    console.error(`[Extract] Fatal error | KeyId: ${(options?.apiKeyId || '').substring(0, 8)}... | Status: ${statusCode || 'N/A'} | Message: ${errorMsg.substring(0, 100)}`)

    // Record the error with QuotaManager
    if (options?.apiKeyId && errorMsg.includes('leaked')) {
      console.error(`[Extract] ALERT: API key ${options.apiKeyId.substring(0, 8)}... is leaked, deactivating...`)
      await quotaMgr.recordKeyError(options.apiKeyId, errorMsg, statusCode)
    } else if (options?.apiKeyId && (errorMsg.includes('quota') || statusCode === 429)) {
      console.error(`[Extract] ALERT: API key ${options.apiKeyId.substring(0, 8)}... quota exceeded`)
      await quotaMgr.recordKeyError(options.apiKeyId, errorMsg, statusCode)
    } else if (options?.apiKeyId) {
      console.error(`[Extract] ALERT: API key ${options.apiKeyId.substring(0, 8)}... error: ${errorMsg.substring(0, 60)}`)
      await quotaMgr.recordKeyError(options.apiKeyId, errorMsg, statusCode)
    }

    updateJob(uploadId, {
      status: 'failed',
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    })

    await serviceSupabase
      .from('uploads')
      .update({
        status: 'failed',
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', uploadId)
  }
}

export { POST }
