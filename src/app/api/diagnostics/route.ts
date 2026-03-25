import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'OK: Set' : 'Missing',
    supabase_public_key: hasPublishableKey
      ? 'OK: Set (publishable)'
      : hasAnonKey
        ? 'OK: Set (anon)'
        : 'Missing',
    supabase_publishable_key: hasPublishableKey ? 'OK: Set' : 'Missing',
    supabase_anon_key: hasAnonKey ? 'OK: Set' : 'Missing',
    supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY 
      ? (process.env.SUPABASE_SERVICE_ROLE_KEY.length > 100 ? 'OK: Set (full)' : 'Warning: Set (incomplete - ends with ...)') 
      : 'Missing',
    gemini_api_key: process.env.GEMINI_API_KEY 
      ? (process.env.GEMINI_API_KEY.length > 30 ? 'OK: Set (full)' : 'Warning: Set (incomplete - ends with ...)') 
      : 'Missing',
    node_env: process.env.NODE_ENV,
  }

  try {
    // Try to fetch API keys from database
    const { data: keys, error: keysError } = await supabase
      .from('api_keys')
      .select('id, nickname, quota_used_today, quota_daily_limit, is_active')
      .eq('is_deleted', false)
      .eq('is_active', true)

    if (keysError) {
      diagnostics.database_connection = `Error: ${keysError.message}`
      diagnostics.database_error = keysError
    } else {
      diagnostics.database_connection = `OK: Connected (${keys?.length || 0} active keys)`
      diagnostics.api_keys = keys?.map(k => ({
        id: k.id,
        nickname: k.nickname,
        quota_remaining: k.quota_daily_limit - k.quota_used_today,
        quota_limit: k.quota_daily_limit,
      })) || []
    }
  } catch (err: any) {
    diagnostics.database_connection = `Exception: ${err.message}`
    diagnostics.error_details = {
      message: err.message,
      code: err.code,
      timeout: err.message.includes('Timeout'),
      network: err.message.includes('Connect'),
    }
  }

  return NextResponse.json(diagnostics)
}
