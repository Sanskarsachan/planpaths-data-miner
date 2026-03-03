/**
 * Initialize Quota System
 * Call this once in your app to set up the QuotaManager singleton
 * 
 * Usage in layout.tsx:
 * 
 * import { initializeQuotaSystem } from '@/lib/quota/initialize'
 * 
 * export default function RootLayout({
 *   children,
 * }: {
 *   children: React.ReactNode
 * }) {
 *   // Initialize quota system on server startup
 *   initializeQuotaSystem()
 *   
 *   return (
 *     <html>
 *       <body>{children}</body>
 *     </html>
 *   )
 * }
 */

import { createClient } from '@/lib/supabase/server'
import { initializeQuotaManager } from '@/lib/quota/QuotaManager'

let initialized = false

export function initializeQuotaSystem(): void {
  if (initialized) return

  try {
    const supabase = createClient()
    initializeQuotaManager(supabase)
    initialized = true
    console.log('[QUOTA] System initialized')
  } catch (err) {
    console.error('[QUOTA] Initialization failed:', err)
    // Non-fatal: system will still work with fallback key
  }
}
