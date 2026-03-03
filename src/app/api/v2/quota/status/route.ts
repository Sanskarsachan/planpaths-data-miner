/**
 * GET /api/v2/quota/status
 * Check current quota availability
 */

import { createClient } from '@/lib/supabase/server'
import { QuotaManager } from '@/lib/quota/QuotaManager'

export async function GET() {
  try {
    const supabase = createClient()
    const quotaMgr = new QuotaManager(supabase)

    const status = await quotaMgr.checkQuotaAvailable()

    // Calculate reset time details
    const resetTime = new Date(status.reset_at)
    const now = new Date()
    const resetInSeconds = Math.floor((resetTime.getTime() - now.getTime()) / 1000)

    return Response.json(
      {
        available: status.available,
        remaining: status.remaining,
        limit: status.limit,
        percentage_used: status.percentage_used,
        reset_at: status.reset_at,
        reset_in_seconds: Math.max(0, resetInSeconds),
        reset_in_hours: parseFloat((Math.max(0, resetInSeconds) / 3600).toFixed(2)),
        message: status.available
          ? `${status.remaining} of ${status.limit} requests available`
          : `Quota exhausted. Resets in ${formatTime(resetInSeconds)}`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Quota status error:', error)
    return Response.json(
      { error: 'Failed to check quota', details: error.message },
      { status: 500 }
    )
  }
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return 'now'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h`
}
