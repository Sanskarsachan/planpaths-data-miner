import { createClient } from '@/lib/supabase/server'
import type { StateCode } from '@/types/database'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { state_code, alias_name, master_code } = body

    if (!state_code || !alias_name || !master_code) {
      return Response.json(
        { error: 'Missing required fields: state_code, alias_name, master_code' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify master code exists
    const { data: master, error: masterError } = await supabase
      .from('master_courses')
      .select('id')
      .eq('state_code', state_code as StateCode)
      .eq('course_code', master_code)
      .single()

    if (masterError || !master) {
      return Response.json(
        { error: 'Master course not found' },
        { status: 404 }
      )
    }

    // Insert synonym
    const { data, error } = await supabase
      .from('course_synonyms')
      .upsert(
        {
          state_code: state_code as StateCode,
          alias_name,
          master_code,
        },
        { onConflict: 'state_code,alias_name' }
      )
      .select()
      .single()

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return Response.json(data, { status: 201 })
  } catch (err: any) {
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
