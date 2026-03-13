const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log('Testing select_best_available_api_key RPC...')
  const { data: rpcData, error: rpcError } = await sb.rpc('select_best_available_api_key')
  console.log('RPC data:', JSON.stringify(rpcData))
  console.log('RPC error:', rpcError ? rpcError.message : 'none')

  if (rpcData) {
    const { data: key, error: keyErr } = await sb
      .from('api_keys')
      .select('id, nickname, key, is_active, is_deleted')
      .eq('id', rpcData)
      .eq('is_deleted', false)
      .single()
    console.log('Key fetch result:', key ? { id: key.id, nickname: key.nickname, keyLength: key.key?.length } : null)
    console.log('Key fetch error:', keyErr ? keyErr.message : 'none')
  }

  const { data, error } = await sb
    .from('api_keys')
    .select('id, nickname, quota_used_today, quota_daily_limit, is_active, is_deleted')

  if (error) { console.error('Error:', error.message); return }

  console.log('\n--- api_keys table ---')
  data.forEach(k => console.log(JSON.stringify(k)))

  // Check key column length separately
  const { data: keyLengths, error: err2 } = await sb.rpc('check_quota_available')
  if (!err2) console.log('\n--- check_quota_available ---', JSON.stringify(keyLengths))

  // Check if key column has values (using raw query approach)
  const { data: keys2, error: err3 } = await sb
    .from('api_keys')
    .select('id, nickname, key')
    .limit(3)

  if (!err3) {
    console.log('\n--- key column preview (first 10 chars) ---')
    keys2.forEach(k => console.log(k.id, k.nickname, '->', k.key ? `"${k.key.substring(0,10)}..." (${k.key.length} chars)` : 'EMPTY/NULL'))
  }
}

main().catch(console.error)
