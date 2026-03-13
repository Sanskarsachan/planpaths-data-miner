import { createClient } from '@supabase/supabase-js'
import { hashCourse } from '@/utils/hashCourse'
import type { StateCode } from '@/types/database'

export async function POST(req: Request) {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    const body = await req.json()
    const { uploadId, schoolSlug, stateCode, courses } = body

    if (!uploadId || !schoolSlug || !stateCode || !Array.isArray(courses)) {
      return Response.json(
        { error: 'Missing required fields: uploadId, schoolSlug, stateCode, courses' },
        { status: 400 }
      )
    }

    if (courses.length === 0) {
      return Response.json(
        { error: 'No courses to save' },
        { status: 400 }
      )
    }

    let resolvedUploadId: string | null = uploadId

    try {
      const { data: uploadRow, error: uploadLookupError } = await serviceSupabase
        .from('uploads')
        .select('id')
        .eq('id', uploadId)
        .maybeSingle()

      if (uploadLookupError) {
        if (uploadLookupError.code === 'PGRST205') {
          resolvedUploadId = null
        } else {
          throw uploadLookupError
        }
      }

      if (!uploadRow && resolvedUploadId) {
        const { error: uploadCreateError } = await serviceSupabase
          .from('uploads')
          .insert({
            id: uploadId,
            school_slug: schoolSlug,
            filename: `${schoolSlug}.pdf`,
            state_code: stateCode,
            status: 'complete',
            courses_found: courses.length,
            completed_at: new Date().toISOString(),
          })

        if (uploadCreateError) {
          console.warn('[SaveCourses] Could not create uploads row, saving without upload_id:', uploadCreateError)
          resolvedUploadId = null
        }
      }
    } catch (uploadErr) {
      console.warn('[SaveCourses] Upload precheck failed, saving without upload_id:', uploadErr)
      resolvedUploadId = null
    }

    // Map UI course format to database format
    const extractedRows = courses.map((course, index) => ({
      upload_id: resolvedUploadId,
      school_slug: schoolSlug,
      state_code: stateCode as StateCode,
      course_name: course.name || 'Untitled Course',
      course_code: course.code || null,
      category: course.category || null,
      grade_level: course.grade || null,
      credits: course.credit || null,
      course_duration: course.length === 'Y' ? 'Year' : 'Semester',
      course_term: course.length || null,
      chunk_index: index,
      content_hash: hashCourse(course.name, course.code || null, schoolSlug),
    }))

    // Insert courses into database (will skip duplicates due to UNIQUE constraint)
    const { data, error } = await serviceSupabase
      .from('extractions_v2')
      .upsert(extractedRows, { 
        onConflict: 'school_slug,content_hash',
        ignoreDuplicates: true 
      })
      .select()

    if (error) {
      console.error('[SaveCourses] Database error:', error)
      return Response.json(
        { error: 'Failed to save courses to database', details: error.message },
        { status: 500 }
      )
    }

    console.log(`[SaveCourses] Saved ${data?.length || 0} courses for ${schoolSlug}`)

    return Response.json({
      success: true,
      saved: data?.length || 0,
      total: courses.length,
      upload_id_used: resolvedUploadId,
      message: `Successfully saved ${data?.length || 0} courses to database`,
    })
  } catch (err: any) {
    console.error('[SaveCourses] Error:', err)
    return Response.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}
