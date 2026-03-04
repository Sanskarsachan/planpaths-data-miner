import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Circuit breaker: after one timeout, skip Supabase for 60 s to avoid
// blocking every request for 10 s while the server is unreachable.
let lastFailedAt: number | null = null
const BACKOFF_MS = 60_000

function circuitOpen(): boolean {
  return !!lastFailedAt && Date.now() - lastFailedAt < BACKOFF_MS
}

// Mock keys used when Supabase is unavailable
const MOCK_KEYS = [
  { id: 'key-001', nickname: 'Primary API Key',   quota_used_today: 5,  quota_daily_limit: 20, is_active: true  },
  { id: 'key-002', nickname: 'Secondary API Key', quota_used_today: 8,  quota_daily_limit: 20, is_active: true  },
  { id: 'key-003', nickname: 'Testing Key',       quota_used_today: 0,  quota_daily_limit: 10, is_active: true  },
  { id: 'key-004', nickname: 'Backup API Key',    quota_used_today: 2,  quota_daily_limit: 20, is_active: false },
]

type RawKey = typeof MOCK_KEYS[0]

function toDto(k: RawKey) {
  return {
    id: k.id,
    nickname: k.nickname,
    quota_remaining: k.quota_daily_limit - k.quota_used_today,
    quota_limit: k.quota_daily_limit,
    is_active: k.is_active,
  }
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Return mock instantly when env is missing or circuit is open
  if (!supabaseUrl || !serviceKey || circuitOpen()) {
    const keys = MOCK_KEYS.map(toDto)
    return NextResponse.json({ keys, count: keys.length, source: 'mock', fallback: false })
  }

  // Attempt Supabase with a 5-second hard timeout
  try {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { data, error } = await Promise.race([
      supabase
        .from('api_keys')
        .select('id, nickname, quota_used_today, quota_daily_limit, is_active')
        .eq('is_deleted', false)
        .eq('is_active', true)
        .order('quota_used_today', { ascending: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      ),
    ]) as { data: RawKey[] | null; error: any }

    if (error) throw error

    lastFailedAt = null
    const keys = (data ?? []).map(toDto)
    console.log(`[available-keys] Supabase: ${keys.length} keys`)
    return NextResponse.json({ keys, count: keys.length, source: 'supabase', fallback: false })

  } catch (err: any) {
    lastFailedAt = Date.now()
    console.warn(`[available-keys] Supabase failed – using mock for 60 s (${err.message})`)
    const keys = MOCK_KEYS.map(toDto)
    return NextResponse.json({ keys, count: keys.length, source: 'mock', fallback: false })
  }
}
