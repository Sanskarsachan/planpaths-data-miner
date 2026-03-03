import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

interface Cookie {
  name: string
  value: string
  options?: Record<string, unknown>
}

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return (await cookieStore).getAll()
        },
        async setAll(cookiesToSet: Cookie[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              (await cookieStore).set(name, value, options as Record<string, unknown>)
            }
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
