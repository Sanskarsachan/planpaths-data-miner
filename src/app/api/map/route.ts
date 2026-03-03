import { createClient } from '@/lib/supabase/server'
import { runMapping } from '@/lib/mapping/SQLMapper'
import type { StateCode } from '@/types/database'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { school_slug, state_code, reset } = body

    if (!school_slug || !state_code) {
      return Response.json(
        { error: 'Missing required fields: school_slug, state_code' },
        { status: 400 }
      )
    }

    // Verify school exists
    const supabase = createClient()
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', school_slug)
      .single()

    if (schoolError || !school) {
      return Response.json(
        { error: 'School not found' },
        { status: 404 }
      )
    }

    console.log(
      `[${school_slug}] Running mapping (${reset ? 'with reset' : 'fresh'})...`
    )

    // Run mapping
    const results = await runMapping(school_slug, state_code as StateCode, reset ?? false)

    console.log(`[${school_slug}] Mapping complete: ${results.length} pass types`)

    return Response.json(results)
  } catch (err: any) {
    console.error('Map error:', err)
    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
}
