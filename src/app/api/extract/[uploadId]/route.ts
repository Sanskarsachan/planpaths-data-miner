import { createClient } from '@/lib/supabase/server'
import { getJob } from '@/lib/extraction/JobStore'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await params
  const inMemory = getJob(uploadId)
  if (inMemory) {
    return Response.json(inMemory)
  }

  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single()

    if (error || !data) {
      return Response.json({
        id: uploadId,
        status: 'processing',
        courses_found: 0,
        dupes_removed: 0,
        total_chunks: 0,
        processing_ms: null,
        error_message: null,
        courses: [],
        temporary: true,
      })
    }

    return Response.json(data)
  } catch (err: any) {
    return Response.json({
      id: uploadId,
      status: 'processing',
      courses_found: 0,
      dupes_removed: 0,
      total_chunks: 0,
      processing_ms: null,
      error_message: null,
      courses: [],
      temporary: true,
    })
  }
}
