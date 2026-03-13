import type { SupabaseClient } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

/**
 * Fetches ALL rows from a Supabase table by parallelising paginated requests.
 * Gets the exact row count first (HEAD-only) then fans out pages concurrently.
 * Works around PostgREST's default 1000-row limit.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
): Promise<T[]> {
  // 1. Get exact total count (no data, just the header)
  const { count, error: countError } = await supabase
    .from(table)
    .select(columns, { count: 'exact', head: true })

  if (countError) throw new Error(`[paginate:${table}] count failed: ${countError.message}`)
  if (!count || count === 0) return []

  // 2. Fan out all pages in parallel
  const totalPages = Math.ceil(count / PAGE_SIZE)
  const pageRequests = Array.from({ length: totalPages }, (_, i) => {
    const from = i * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    return supabase.from(table).select(columns).range(from, to)
  })

  const results = await Promise.all(pageRequests)

  const rows: T[] = []
  for (const { data, error } of results) {
    if (error) throw new Error(`[paginate:${table}] page fetch failed: ${error.message}`)
    if (data) rows.push(...(data as T[]))
  }

  return rows
}
