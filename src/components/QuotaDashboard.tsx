/**
 * QuotaDashboard Component
 * Full dashboard showing quota stats, keys, and usage logs
 */

'use client'

import { useQuota } from '@/lib/quota/useQuota'
import { useEffect, useState } from 'react'

export function QuotaDashboard() {
  const {
    quota,
    keys,
    dashboard,
    loading,
    error,
    getDashboard,
    checkQuota,
  } = useQuota({ autoCheck: true, refreshInterval: 60000 })

  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    getDashboard()
  }, [getDashboard])

  if (!isMounted || loading) {
    return <div className="h-96 bg-gray-100 rounded animate-pulse" />
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        <p className="font-semibold">Error loading dashboard</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Quota Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-600 uppercase tracking-wide">Available</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {quota?.remaining ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">of {quota?.limit ?? 20} total</div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-600 uppercase tracking-wide">Used Today</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {quota ? quota.limit - quota.remaining : 0}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {quota?.percentage_used.toFixed(1)}% of daily limit
          </div>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-xs text-gray-600 uppercase tracking-wide">Reset Time</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            {quota ? formatTimeUntilReset(quota.reset_at) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {quota && new Date(quota.reset_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {quota && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-900">Daily Usage</h3>
            <span className="text-sm text-gray-600">
              {quota.percentage_used.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300
                ${quota.percentage_used >= 100 ? 'bg-red-600' : quota.percentage_used >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(quota.percentage_used, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* API Keys Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">API Keys</h3>
        </div>
        {keys && keys.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-900">Key</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-900">Remaining</th>
                  <th className="px-4 py-2 text-right font-semibold text-gray-900">Usage</th>
                  <th className="px-4 py-2 text-center font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{key.nickname}</td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {key.quota_remaining}/{key.quota_limit}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {key.percentage_used.toFixed(0)}%
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium
                        ${key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {key.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-gray-500">
            <p>No API keys found</p>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      {dashboard?.recent_logs && dashboard.recent_logs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
            {dashboard.recent_logs.map((log) => (
              <div key={log.id} className="px-4 py-3 flex items-center justify-between text-sm hover:bg-gray-50">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {log.school_name || log.file_name || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {log.api_key_nickname} • {log.request_type}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium">
                    <span className={`inline-block px-2 py-0.5 rounded
                      ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {log.status}
                    </span>
                  </div>
                  {log.tokens_used && (
                    <div className="text-xs text-gray-500 mt-1">
                      {log.tokens_used} tokens
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => checkQuota()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}

function formatTimeUntilReset(resetAt: string): string {
  const reset = new Date(resetAt)
  const now = new Date()
  const diff = reset.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff / (1000 * 60)) % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}
