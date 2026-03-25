const NETWORK_ERROR_TOKENS = [
  'fetch failed',
  'failed to fetch',
  'enotfound',
  'econnrefused',
  'econnreset',
  'eai_again',
  'network request failed',
  'timeout',
]

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') {
      return message
    }
  }

  return 'Unknown error'
}

export function isTableNotFoundError(error: unknown): boolean {
  const message = getErrorMessage(error)
  return message.includes('Could not find the table') || message.includes('does not exist')
}

export function isSupabaseNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase()
  return NETWORK_ERROR_TOKENS.some(token => message.includes(token))
}

export function getSupabaseConnectionHint(url = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!url) {
    return 'Supabase URL is missing. Set NEXT_PUBLIC_SUPABASE_URL and try again.'
  }

  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname
    const isLocalHost = host === '127.0.0.1' || host === 'localhost'

    if (isLocalHost) {
      return `Local Supabase at ${parsedUrl.origin} is unreachable. Start it with \`supabase start\` and confirm the URL and keys with \`supabase status\`.`
    }

    return `Supabase host ${host} is unreachable from this environment. Verify NEXT_PUBLIC_SUPABASE_URL is the original hosted project URL from Supabase Settings -> API, then check DNS or network access to that host.`
  } catch {
    return 'Supabase is unreachable. Check NEXT_PUBLIC_SUPABASE_URL and your network or DNS configuration.'
  }
}