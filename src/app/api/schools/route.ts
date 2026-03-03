import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request) {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name')

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
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

export async function POST(_req: Request) {
  const supabase = createClient()

  try {
    const body = await _req.json()
    const { name, slug, state_code, district, city } = body

    if (!name || !slug || !state_code) {
      return Response.json(
        { error: 'Missing required fields: name, slug, state_code' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('schools')
      .upsert(
        { name, slug, state_code, district: district ?? null, city: city ?? null },
        { onConflict: 'slug' }
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
