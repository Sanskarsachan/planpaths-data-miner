import { createClient } from '@/lib/supabase/server'
import { schoolSlug } from '@/utils/slugify'
import { detectState } from '@/lib/extraction/StateDetector'
import { createSmartChunks } from '@/lib/extraction/SmartChunker'
import { extractAllChunks } from '@/lib/extraction/GeminiExtractor'
import { deduplicateWithinUpload } from '@/lib/extraction/Deduplicator'
import { QuotaManager } from '@/lib/quota/QuotaManager'
import pdfParse from 'pdf-parse'
import formidable from 'formidable'
import fs from 'fs'
import type { StateCode } from '@/types/database'

export const config = {
  api: { bodyParser: false },
}

async function POST(req: Request) {
  const supabase = createClient()
  const quotaMgr = new QuotaManager(supabase)

  try {
    // ✅ CHECK QUOTA BEFORE PROCESSING
    const quotaStatus = await quotaMgr.checkQuotaAvailable()
    if (!quotaStatus.available) {
      return Response.json(
        {
          error: 'API quota exhausted (20 requests/day)',
          quota_reset_at: quotaStatus.reset_at,
        },
        { status: 429 }
      )
    }

    // ✅ SELECT BEST AVAILABLE API KEY
    const selectedKey = await quotaMgr.selectNextApiKey()
    if (!selectedKey) {
      return Response.json(
        { error: 'No API keys available for extraction' },
        { status: 503 }
      )
    }

    console.log(`[QUOTA] Using API key: ${selectedKey.nickname} (${selectedKey.quota_remaining} remaining)`)

    // Parse form data
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 })
    const [fields, files] = await form.parse(req as any)

    const schoolName = fields.school_name?.[0]
    const stateCodeInput = fields.state_code?.[0] as StateCode | undefined
    const file = Array.isArray(files.file) ? files.file[0] : files.file

    if (!schoolName || !stateCodeInput || !file) {
      return Response.json(
        { error: 'Missing required fields: school_name, state_code, file' },
        { status: 400 }
      )
    }

    // Create or get school
    const slug = schoolSlug(schoolName, stateCodeInput)

    const { data: schoolData, error: schoolError } = await supabase
      .from('schools')
      .upsert(
        {
          name: schoolName,
          slug,
          state_code: stateCodeInput,
          district: fields.school_district?.[0] ?? null,
          city: fields.school_city?.[0] ?? null,
        },
        { onConflict: 'slug' }
      )
      .select()
      .single()

    if (schoolError || !schoolData) {
      console.error('School insert/update error:', schoolError)
      return Response.json(
        { error: `Failed to create/update school: ${schoolError?.message}` },
        { status: 500 }
      )
    }

    // Create upload record
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        school_id: schoolData.id,
        school_slug: slug,
        filename: file.originalFilename ?? 'upload.pdf',
        state_code: stateCodeInput,
        status: 'processing',
      })
      .select()
      .single()

    if (uploadError || !uploadData) {
      console.error('Upload insert error:', uploadError)
      return Response.json(
        { error: `Failed to create upload record: ${uploadError?.message}` },
        { status: 500 }
      )
    }

    const uploadId = uploadData.id

    // Process extraction asynchronously
    setImmediate(() => {
      runExtraction(uploadId, slug, stateCode, file.filepath, supabase, {
        apiKeyId: selectedKey.id,
        schoolName: schoolName,
      })
        .catch(err => {
          console.error('Async extraction error:', err)
          updateUploadError(uploadId, err.message, supabase).catch(e =>
            console.error('Failed to update error:', e)
          )
        })
    })

    return Response.json({ upload_id: uploadId, school_slug: slug }, { status: 201 })
  } catch (err: any) {
    console.error('Extract POST error:', err)
    return Response.json(
      { error: `Failed to process request: ${err.message}` },
      { status: 500 }
    )
  }
}

async function runExtraction(
  uploadId: string,
  schoolSlug: string,
  stateCode: StateCode,
  filePath: string,
  supabase: any,
  options?: { apiKeyId?: string; schoolName?: string }
) {
  const start = Date.now()

  try {
    const buffer = fs.readFileSync(filePath)
    const pdfData = await pdfParse(buffer)
    const text = pdfData.text

    const detected = detectState(text, filePath)
    const finalState = detected !== 'UNKNOWN' ? detected : stateCode

    console.log(
      `[${uploadId}] PDF: ${Math.round(buffer.length / 1024)}KB, ${pdfData.numpages} pages, state: ${finalState}`
    )

    const chunks = createSmartChunks(text, finalState)
    console.log(`[${uploadId}] ${chunks.length} chunks created`)

    await supabase.from('uploads').update({ total_chunks: chunks.length }).eq('id', uploadId)

    console.log(`[${uploadId}] Extracting with Gemini...`)
    const chunkResults = await extractAllChunks(chunks, finalState, {
      apiKeyId: options?.apiKeyId,
      uploadId: uploadId,
      schoolName: options?.schoolName,
    })

    const allCourses = chunkResults.flatMap(r => r.courses)
    console.log(`[${uploadId}] ${allCourses.length} courses extracted`)

    const { unique, duplicateCount } = deduplicateWithinUpload(allCourses, schoolSlug)
    console.log(`[${uploadId}] ${unique.length} unique, ${duplicateCount} duplicates`)

    if (unique.length > 0) {
      const { data: schoolData } = await supabase
        .from('schools')
        .select('id')
        .eq('slug', schoolSlug)
        .single()

      if (!schoolData) throw new Error('School not found')

      const rows = unique.map(c => ({
        upload_id: uploadId,
        school_id: schoolData.id,
        school_slug: schoolSlug,
        state_code: finalState,
        course_name: c.CourseName,
        course_code: c.CourseCode ?? null,
        category: c.Category ?? null,
        grade_level: c.GradeLevel ?? null,
        credits: c.Credits ?? null,
        course_duration: c.CourseDuration ?? null,
        course_term: c.CourseTerm ?? null,
        grad_requirement: c.GraduationRequirement ?? null,
        confidence_score: c._confidence ?? 0.8,
        field_scores: c._field_confidence ?? null,
        content_hash: c._hash,
        raw_ai_output: c as any,
      }))

      const BATCH_SIZE = 200
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        await supabase.from('extracted_courses').upsert(batch, {
          onConflict: 'school_slug,content_hash',
          ignoreDuplicates: true,
        })
      }
    }

    const processingTime = Date.now() - start
    await supabase.from('uploads').update({
      status: 'complete',
      courses_found: unique.length,
      dupes_removed: duplicateCount,
      processing_ms: processingTime,
      completed_at: new Date().toISOString(),
    }).eq('id', uploadId)

    console.log(`[${uploadId}] ✅ Done in ${(processingTime / 1000).toFixed(2)}s`)
  } catch (err: any) {
    console.error(`[${uploadId}] ❌ Error:`, err.message)
    await updateUploadError(uploadId, err.message, supabase)
  } finally {
    try { fs.unlinkSync(filePath) } catch (_) {}
  }
}

async function updateUploadError(uploadId: string, message: string, supabase: any) {
  await supabase.from('uploads').update({
    status: 'failed',
    error_message: message,
    completed_at: new Date().toISOString(),
  }).eq('id', uploadId).catch(() => {})
}

export { POST }
