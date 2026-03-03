/**
 * GET /api/v2/quota/logs?limit=50
 * Get recent API usage logs
 */

import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500)

    const supabase = createClient()
    const logs = await supabase
      .from('api_usage_logs')
      .select(
        `
        id,
        api_key_id,
        api_keys(nickname),
        upload_id,
        request_type,
        status,
        tokens_used,
        estimated_cost_cents,
        school_name,
        file_name,
        processing_ms,
        created_at
        `
      )
      .order('created_at', { ascending: false })
      .limit(limit)

    if (logs.error) {
      throw logs.error
    }

    const formattedLogs = (logs.data || []).map((log: any) => ({
      id: log.id,
      api_key_nickname: (log.api_keys?.[0]?.nickname as string) || 'Unknown',
      upload_id: log.upload_id,
      request_type: log.request_type,
      status: log.status,
      tokens_used: log.tokens_used,
      estimated_cost_cents: log.estimated_cost_cents,
      school_name: log.school_name,
      file_name: log.file_name,
      processing_ms: log.processing_ms,
      created_at: log.created_at,
      created_at_human: formatDate(log.created_at),
    }))

    return Response.json(
      {
        logs: formattedLogs,
        total: formattedLogs.length,
        limit,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Get usage logs error:', error)
    return Response.json(
      { error: 'Failed to fetch usage logs', details: error.message },
      { status: 500 }
    )
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}
