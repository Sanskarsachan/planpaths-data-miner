import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  const { uploadId } = await params
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single()

    if (error || !data) {
      return Response.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    return Response.json(data)
  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
