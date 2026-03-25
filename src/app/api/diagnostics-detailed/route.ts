import { NextResponse } from 'next/server'

const getSupabaseHost = (url?: string) => {
  if (!url) return null

  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    network_tests: {}
  }

  // Test 1: Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabasePublicKey = supabasePublishableKey || supabaseAnonKey
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseHost = getSupabaseHost(supabaseUrl)

  results.environment = {
    supabase_url_set: !!supabaseUrl,
    supabase_url_value: supabaseUrl,
    supabase_publishable_key_set: !!supabasePublishableKey,
    supabase_anon_key_set: !!supabaseAnonKey,
    supabase_public_key_set: !!supabasePublicKey,
    supabase_service_key_set: !!supabaseServiceKey,
    service_key_length: supabaseServiceKey?.length || 0,
    service_key_complete: supabaseServiceKey && supabaseServiceKey.length > 100 ? 'Complete' : 'Incomplete'
  }

  // Test 2: Simple fetch to Supabase REST API
  try {
    console.log('Testing REST API connection to Supabase...')
    const startTime = Date.now()
    
    const headers: Record<string, string> = {}
    if (supabaseServiceKey) {
      headers['Authorization'] = `Bearer ${supabaseServiceKey}`
    }
    if (supabasePublicKey) {
      headers['apikey'] = supabasePublicKey
    }
    
    const response = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/`, {
        headers
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('REST API test timeout after 15s')), 15000)
      )
    ])

    const elapsed = Date.now() - startTime
    results.network_tests.rest_api = {
      status: 'OK',
      response_time_ms: elapsed,
      status_code: (response as any)?.status
    }
  } catch (err: any) {
    results.network_tests.rest_api = {
      status: 'Failed',
      error: err.message,
      error_code: err.code || 'unknown'
    }
  }

  // Test 3: DNS resolution
  if (!supabaseHost) {
    results.network_tests.dns = {
      status: 'Skipped',
      error: 'Supabase URL is missing or invalid'
    }
  } else if (supabaseHost === '127.0.0.1' || supabaseHost === 'localhost') {
    results.network_tests.dns = {
      status: 'Skipped',
      error: `Local Supabase host ${supabaseHost} does not require external DNS resolution`
    }
  } else {
    try {
      console.log('Testing DNS resolution...')
      const { Resolver } = require('dns').promises
      const resolver = new Resolver()
      const addresses = await resolver.resolve4(supabaseHost)
      results.network_tests.dns = {
        status: 'Resolved',
        host: supabaseHost,
        addresses: addresses
      }
    } catch (err: any) {
      results.network_tests.dns = {
        status: 'Failed',
        host: supabaseHost,
        error: err.message
      }
    }
  }

  // Test 4: Test with service key via supabase-js directly
  try {
    console.log('Testing Supabase JavaScript client...')
    const { createClient } = require('@supabase/supabase-js')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const startTime = Date.now()
    const { error } = await Promise.race([
      supabase.from('api_keys').select('count(*)', { count: 'exact', head: true }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Supabase client test timeout after 15s')), 15000)
      )
    ]) as any

    const elapsed = Date.now() - startTime

    if (error) {
      results.network_tests.supabase_client = {
        status: 'Database Error',
        error: error.message,
        error_code: error.code,
        response_time_ms: elapsed
      }
    } else {
      results.network_tests.supabase_client = {
        status: 'OK',
        response_time_ms: elapsed,
        tables_accessible: true
      }
    }
  } catch (err: any) {
    results.network_tests.supabase_client = {
      status: 'Connection Failed',
      error: err.message,
      error_code: err.code || 'unknown'
    }
  }

  // Test 5: Check Node.js version
  results.node_info = {
    version: process.version,
    platform: process.platform,
    arch: process.arch
  }

  // Test 6: Network info
  try {
    const os = require('os')
    const interfaces = os.networkInterfaces()
    results.network_info = {
      interfaces: Object.keys(interfaces),
      hostname: os.hostname()
    }
  } catch (err) {
    results.network_info = { error: 'Could not get network info' }
  }

  // Test 7: Recommendations
  results.recommendations = []

  if (!results.environment.supabase_service_key_set || results.environment.service_key_complete === 'Incomplete') {
    results.recommendations.push('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is incomplete or missing. Get the full key from Supabase Settings -> API')
  }

  if (results.network_tests.rest_api?.status?.includes('Failed')) {
    results.recommendations.push('Warning: Cannot connect to Supabase REST API. This could be: (1) Network firewall blocking, (2) ISP policy, (3) Wrong Supabase URL, or (4) Server down')
  }

  if (results.network_tests.dns?.status?.includes('Failed')) {
    results.recommendations.push('Warning: DNS resolution to supabase.co is failing. Check your network DNS settings')
  }

  if (results.network_tests.rest_api?.status?.includes('OK') && results.network_tests.supabase_client?.status?.includes('Failed')) {
    results.recommendations.push('Info: REST API works but supabase-js client fails. This suggests an authentication or query issue, not network')
  }

  results.summary = {
    environment_ok: results.environment.service_key_complete === 'Complete' && results.environment.supabase_url_set,
    network_ok: Object.values(results.network_tests).some((test: any) => test.status?.includes('OK')),
    supabase_connected: results.network_tests.supabase_client?.status?.includes('OK') || results.network_tests.rest_api?.status?.includes('OK'),
    all_tests_pass: Object.values(results.network_tests).every((test: any) => test.status?.includes('OK'))
  }

  return NextResponse.json(results, { status: 200 })
}
