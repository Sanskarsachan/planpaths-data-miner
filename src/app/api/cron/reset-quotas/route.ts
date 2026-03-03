/**
 * GET /api/cron/reset-quotas
 * Cron endpoint for daily quota reset (call at 00:00 UTC)
 * 
 * Deploy with Vercel: Update vercel.json
 * {
 *   "crons": [{
 *     "path": "/api/cron/reset-quotas",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */

import { QuotaManager } from '@/lib/quota/QuotaManager'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    // Verify authorization (Vercel includes a secret automatically)
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[CRON] Starting daily quota reset...')

    const supabase = createClient()
    const quotaMgr = new QuotaManager(supabase, console.log)

    const result = await quotaMgr.resetDailyQuotas()

    console.log(`[CRON] Reset completed: ${result.keys_reset} keys, ${result.total_requests_before} requests`)

    return Response.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        keys_reset: result.keys_reset,
        total_requests_before: result.total_requests_before,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('[CRON] Reset failed:', error)
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// For local testing: `curl http://localhost:3000/api/cron/reset-quotas`
export async function POST(req: Request) {
  return GET(req)
}
