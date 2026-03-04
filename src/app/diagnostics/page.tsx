'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface DiagnosticsData {
  timestamp: string
  supabase_url: string
  supabase_anon_key: string
  supabase_service_role_key: string
  gemini_api_key: string
  node_env: string
  database_connection: string
  api_keys?: any[]
  database_error?: any
  error_details?: any
}

export default function DiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const response = await fetch('/api/diagnostics')
        const data = await response.json()
        setDiagnostics(data)
      } catch (err) {
        console.error('Diagnostics fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDiagnostics()
  }, [])

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading diagnostics...</span>
        </div>
      </div>
    )
  }

  if (!diagnostics) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-red-600 inline mr-2" />
          <span className="text-red-800">Failed to load diagnostics</span>
        </div>
      </div>
    )
  }

  const isConnected = diagnostics.database_connection?.startsWith('✅')
  const isIncomplete = diagnostics.supabase_service_role_key?.includes('incomplete')

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold mb-2">🔍 Supabase Diagnostics</h1>
        <p className="text-gray-600">Checking your database connection and configuration...</p>
      </div>

      {/* Overall Status */}
      <div className={`rounded-lg border-2 p-6 ${
        isConnected 
          ? 'bg-green-50 border-green-300' 
          : 'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {isConnected ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : (
            <AlertCircle className="h-6 w-6 text-red-600" />
          )}
          <h2 className="text-2xl font-bold">
            {isConnected ? '✅ Connected to Supabase' : '❌ Connection Issues'}
          </h2>
        </div>
        <p className={isConnected ? 'text-green-700' : 'text-red-700'}>
          {diagnostics.database_connection}
        </p>
      </div>

      {/* Environment Variables */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4">📋 Environment Configuration</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-semibold">NEXT_PUBLIC_SUPABASE_URL</p>
              <p className="text-sm text-gray-600">Supabase Project URL</p>
            </div>
            <span className={diagnostics.supabase_url.includes('✅') ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {diagnostics.supabase_url}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-semibold">NEXT_PUBLIC_SUPABASE_ANON_KEY</p>
              <p className="text-sm text-gray-600">Anonymous API key for browser</p>
            </div>
            <span className={diagnostics.supabase_anon_key.includes('✅') ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {diagnostics.supabase_anon_key}
            </span>
          </div>

          <div className={`flex items-center justify-between p-3 bg-gray-50 rounded border-2 ${
            isIncomplete ? 'border-red-300 bg-red-50' : 'border-gray-200'
          }`}>
            <div>
              <p className="font-semibold">SUPABASE_SERVICE_ROLE_KEY</p>
              <p className="text-sm text-gray-600">Server-side secret key (backend only)</p>
              {isIncomplete && (
                <p className="text-sm text-red-700 font-bold mt-1">
                  ⚠️ INCOMPLETE - Ends with ... instead of full key
                </p>
              )}
            </div>
            <span className={isIncomplete ? 'text-red-600 font-bold' : diagnostics.supabase_service_role_key.includes('✅') ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>
              {diagnostics.supabase_service_role_key}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div>
              <p className="font-semibold">GEMINI_API_KEY</p>
              <p className="text-sm text-gray-600">Google Gemini API key</p>
            </div>
            <span className={diagnostics.gemini_api_key.includes('✅') ? 'text-green-600 font-bold' : 'text-yellow-600 font-bold'}>
              {diagnostics.gemini_api_key}
            </span>
          </div>
        </div>
      </div>

      {/* Database Connection Details */}
      {diagnostics.database_error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-red-800 mb-3">❌ Database Error</h2>
          <pre className="bg-white p-3 rounded border border-red-300 overflow-auto text-sm">
            {JSON.stringify(diagnostics.database_error, null, 2)}
          </pre>
        </div>
      )}

      {/* API Keys Found */}
      {diagnostics.api_keys && diagnostics.api_keys.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-lg font-bold text-green-800 mb-3">✅ API Keys Found ({diagnostics.api_keys.length})</h2>
          <div className="space-y-2">
            {diagnostics.api_keys.map((key: any, idx: number) => (
              <div key={idx} className="bg-white p-3 rounded border border-green-300">
                <p className="font-semibold">{key.nickname}</p>
                <p className="text-sm text-gray-600">
                  Quota: {key.quota_remaining}/{key.quota_limit} remaining
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fix Instructions */}
      {isIncomplete && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
          <h2 className="text-xl font-bold text-yellow-900 mb-3">🔧 How to Fix</h2>
          <ol className="space-y-3 text-yellow-900">
            <li className="flex gap-3">
              <span className="font-bold">1.</span>
              <div>
                <p className="font-semibold">Get your complete SUPABASE_SERVICE_ROLE_KEY</p>
                <p className="text-sm">Go to: <a href="https://app.supabase.com/project/emowefxzeqkksjnddzip/settings/api" target="_blank" className="underline">Supabase Dashboard → Settings → API</a></p>
                <p className="text-sm">Copy the complete "service_role secret" key (NOT the one ending with ...)</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-bold">2.</span>
              <div>
                <p className="font-semibold">Update your .env.local file</p>
                <p className="text-sm">Replace the incomplete key with the full key from Supabase</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-bold">3.</span>
              <div>
                <p className="font-semibold">Restart the development server</p>
                <p className="text-sm">Kill the running server and run: <code className="bg-yellow-100 px-2 py-1 rounded">pnpm dev</code></p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="font-bold">4.</span>
              <div>
                <p className="font-semibold">Reload this diagnostic page</p>
                <p className="text-sm">Refresh this page to verify the connection works</p>
              </div>
            </li>
          </ol>
        </div>
      )}

      {/* Raw Diagnostics JSON */}
      <div className="bg-gray-900 text-gray-100 rounded-lg p-6 font-mono text-sm overflow-auto max-h-96">
        <p className="text-gray-400 mb-3">Raw Diagnostics Data (for debugging):</p>
        <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
      </div>
    </div>
  )
}
