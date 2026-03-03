/**
 * GET /api/v2/quota/dashboard
 * Complete dashboard data for quota monitoring
 */

import { createClient } from '@/lib/supabase/server'
import { QuotaManager } from '@/lib/quota/QuotaManager'

export async function GET() {
  try {
    const supabase = createClient()
    const quotaMgr = new QuotaManager(supabase)

    // Fetch all data in parallel
    const [quotaStatus, keys, stats, logs, dailyStats] = await Promise.all([
      quotaMgr.checkQuotaAvailable(),
      quotaMgr.getAllActiveKeys(),
      quotaMgr.getQuotaStats(),
      quotaMgr.getRecentUsageLogs(10),
      quotaMgr.getDailyUsageStats(7),
    ])

    const formattedKeys = keys.map(k => ({
      id: k.id,
      nickname: k.nickname,
      quota_remaining: k.quota_remaining,
      quota_limit: k.quota_daily_limit,
      percentage_used: ((k.quota_daily_limit - k.quota_remaining) / k.quota_daily_limit) * 100 || 0,
      is_active: k.is_active,
      last_used_at: k.last_used_at,
    }))

    return Response.json(
      {
        // Quota status
        quota: {
          available: quotaStatus.available,
          remaining: quotaStatus.remaining,
          limit: quotaStatus.limit,
          percentage_used: quotaStatus.percentage_used,
          reset_at: quotaStatus.reset_at,
        },

        // Keys
        keys: formattedKeys,
        total_keys: formattedKeys.length,
        active_keys: formattedKeys.filter(k => k.is_active).length,

        // Stats
        stats: stats || {
          total_keys: 0,
          active_keys: 0,
          total_requests_today: 0,
          quota_remaining: 0,
        },

        // Recent activity
        recent_logs: logs,

        // Daily trends
        daily_stats: dailyStats,

        // Summary
        summary: {
          message: quotaStatus.available
            ? `${quotaStatus.remaining}/${quotaStatus.limit} API calls remaining today`
            : 'Quota exhausted - please wait for daily reset',
          status_code: quotaStatus.available ? 'OK' : 'EXHAUSTED',
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return Response.json(
      { error: 'Failed to load dashboard', details: error.message },
      { status: 500 }
    )
  }
}
