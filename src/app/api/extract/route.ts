import { randomUUID } from 'crypto'
import { schoolSlug } from '@/utils/slugify'
import { ChunkProcessor } from '@/lib/extraction/ChunkProcessor'
import { QuotaManager } from '@/lib/quota/QuotaManager'
import { createClient } from '@/lib/supabase/server'
import { createJob, updateJob } from '@/lib/extraction/JobStore'
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
  const supabase = createClient()
  const quotaMgr = new QuotaManager(supabase)

  try {
    const selectedKey = await quotaMgr.selectNextApiKey()
    if (!selectedKey?.key) {
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
      return Response.json({ error: 'Missing required fields: school_name, state, file' }, { status: 400 })
    }

    const normalizedState = normalizeState(stateInput)
    if (!normalizedState) {
      return Response.json({
        error: 'Unsupported state. Currently supported: Florida (FL), Texas (TX), California (CA).',
      }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer())

    let apiKeyToUse = selectedKey
    if (manualApiKeyId) {
      const manualKey = await quotaMgr.getApiKey(manualApiKeyId)
      if (manualKey?.key) apiKeyToUse = manualKey
    }

    const slug = schoolSlug(schoolName, normalizedState)
    const uploadId = randomUUID()
    createJob(uploadId, slug)

    setImmediate(() => {
      runExtraction(uploadId, slug, normalizedState, fileBuffer, {
        apiKeyId: apiKeyToUse.id,
        apiKey: apiKeyToUse.key,
        schoolName,
        pageStart,
        pageEnd,
      }).catch(err => {
        updateJob(uploadId, {
          status: 'failed',
          error_message: err.message,
          completed_at: new Date().toISOString(),
        })
      })
    })

    return Response.json({ upload_id: uploadId, school_slug: slug }, { status: 201 })
  } catch (err: any) {
    console.error('Extract POST error:', err)
    return Response.json({ error: `Failed to process request: ${err.message}` }, { status: 500 })
  }
}

async function runExtraction(
  uploadId: string,
  slug: string,
  _stateCode: StateCode,
  fileBuffer: Buffer,
  options?: {
    apiKeyId?: string
    apiKey?: string
    schoolName?: string
    pageStart?: number
    pageEnd?: number
  }
) {
  const start = Date.now()

  try {
    // Extract text from PDF
    const pdfParse = (await import('pdf-parse')).default
    const pdfData = await pdfParse(fileBuffer)
    let text = pdfData.text

    // Inject page break markers
    if (pdfData.numpages > 1) {
      const lines = text.split('\n')
      const linesPerPage = Math.ceil(lines.length / pdfData.numpages)
      const pages = []
      for (let i = 0; i < pdfData.numpages; i++) {
        pages.push(lines.slice(i * linesPerPage, (i + 1) * linesPerPage).join('\n'))
      }
      text = pages.join('\n---PAGE_BREAK---\n')
    }

    // Apply page range filter if provided
    if (options?.pageStart && options?.pageEnd) {
      const lines = text.split('\n---PAGE_BREAK---\n')
      const pageStart = Math.max(1, options.pageStart)
      const pageEnd = Math.min(lines.length, options.pageEnd)
      text = lines.slice(pageStart - 1, pageEnd).join('\n---PAGE_BREAK---\n')
    }

    // Create processor with progress callback
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
      options?.apiKey || process.env.GOOGLE_API_KEY || '',
      5  // pagesPerBatch
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

    console.log(`[Extract] Complete | ${rows.length} courses | ${processingTime}ms | tokens: ${stats.tokensUsedToday}`)

    updateJob(uploadId, {
      status: 'complete',
      courses_found: courses.length,
      processing_ms: processingTime,
      completed_at: new Date().toISOString(),
      courses: rows,
    })
  } catch (err: any) {
    console.error('[Extract] Fatal error:', err.message)
    updateJob(uploadId, {
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    })
  }
}

export { POST }
