/**
 * POST /api/v2/admin/reset-quotas
 * Manually reset daily quotas (for testing or manual intervention)
 * Requires CRON_SECRET in Authorization header
 */

import { QuotaManager } from '@/lib/quota/QuotaManager'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    // Verify secret (for cron job automation)
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient()
    const quotaMgr = new QuotaManager(supabase)

    const result = await quotaMgr.resetDailyQuotas()

    return Response.json(
      {
        success: result.success,
        keys_reset: result.keys_reset,
        total_requests_before: result.total_requests_before,
        reset_at: result.reset_at,
        message: result.success ? 'Quotas reset successfully' : 'Failed to reset quotas',
      },
      { status: result.success ? 200 : 500 }
    )
  } catch (error: any) {
    console.error('Reset quotas error:', error)
    return Response.json(
      { error: 'Failed to reset quotas', details: error.message },
      { status: 500 }
    )
  }
}
