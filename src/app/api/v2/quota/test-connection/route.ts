import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test both client types
    const anonUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Testing Supabase connection...')
    console.log('URL configured:', !!anonUrl)
    console.log('Anon key configured:', !!anonKey)
    console.log('Service key configured:', !!serviceKey)

    if (!anonUrl || !serviceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing Supabase configuration',
        hasUrl: !!anonUrl,
        hasServiceKey: !!serviceKey,
      })
    }

    // Use service role key for server-side operations
    const supabase = createClient(anonUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const { data, error, count } = await supabase
      .from('api_keys')
      .select('id, nickname, quota_used_today, quota_daily_limit, is_active', { count: 'exact' })
      .eq('is_deleted', false)
      .eq('is_active', true)

    if (error) {
      console.error('Supabase query error:', error)
      return NextResponse.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
    }

    console.log(`✅ Successfully fetched ${data?.length || 0} API keys`)

    const keys = (data || []).map(key => ({
      id: key.id,
      nickname: key.nickname,
      quota_remaining: key.quota_daily_limit - key.quota_used_today,
      quota_limit: key.quota_daily_limit,
      is_active: key.is_active,
    }))

    return NextResponse.json({
      success: true,
      count: count || 0,
      keys,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('Test connection error:', err)
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
    }, { status: 500 })
  }
}
