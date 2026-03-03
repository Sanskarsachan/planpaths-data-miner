/**
 * GET /api/v2/quota/keys
 * List all available API keys with quota information
 */

import { createClient } from '@/lib/supabase/server'
import { QuotaManager } from '@/lib/quota/QuotaManager'

export async function GET() {
  try {
    const supabase = createClient()
    const quotaMgr = new QuotaManager(supabase)

    const keys = await quotaMgr.getAllActiveKeys()

    // Format for frontend
    const formattedKeys = keys.map(k => ({
      id: k.id,
      nickname: k.nickname,
      quota_remaining: k.quota_remaining,
      quota_limit: k.quota_daily_limit,
      percentage_used: parseFloat(
        (((k.quota_daily_limit - k.quota_remaining) / k.quota_daily_limit) * 100).toFixed(2)
      ),
      is_active: k.is_active,
      last_used_at: k.last_used_at,
      total_requests: k.total_requests,
      total_tokens_used: k.total_tokens_used,
    }))

    return Response.json(
      {
        keys: formattedKeys,
        total_keys: formattedKeys.length,
        active_keys: formattedKeys.filter(k => k.is_active).length,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Get keys error:', error)
    return Response.json(
      { error: 'Failed to fetch API keys', details: error.message },
      { status: 500 }
    )
  }
}
