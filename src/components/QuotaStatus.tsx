/**
 * QuotaStatus Component
 * Display quota remaining and usage percentage
 * Shows warning when approaching limit
 */

'use client'

import { useQuota } from '@/lib/quota/useQuota'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'

interface QuotaStatusProps {
  compact?: boolean
  refreshInterval?: number
}

export function QuotaStatus({ compact = false, refreshInterval = 30000 }: QuotaStatusProps) {
  const quota = useQuota({ autoCheck: true, refreshInterval })
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || !quota.quota) {
    return compact ? null : <div className="h-16 bg-gray-100 rounded animate-pulse" />
  }

  const percentage = quota.quota.percentage_used
  const isWarning = percentage > 70
  const isExhausted = percentage >= 100

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
        ${isExhausted ? 'bg-red-100 text-red-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
        <div className="w-2 h-2 rounded-full bg-current" />
        {quota.quota.remaining}/{quota.quota.limit} remaining
      </div>
    )
  }

  return (
    <div className="w-full p-4 border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">API Quota</h3>
        <span className={`text-sm font-medium
          ${isExhausted ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-green-600'}`}>
          {quota.quota.remaining}/{quota.quota.limit} requests
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300
            ${isExhausted ? 'bg-red-600' : isWarning ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Status text */}
      <div className="mt-3 space-y-1">
        <p className="text-xs text-gray-600">
          {percentage.toFixed(1)}% used
        </p>

        {isExhausted && (
          <p className="text-xs font-medium text-red-600 inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Quota exhausted. Resets {new Date(quota.quota.reset_at).toLocaleString()}
          </p>
        )}
        {isWarning && !isExhausted && (
          <p className="text-xs font-medium text-amber-600 inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Approaching limit. Resets {new Date(quota.quota.reset_at).toLocaleString()}
          </p>
        )}
        {!isWarning && (
          <p className="text-xs text-gray-500">
            Resets {new Date(quota.quota.reset_at).toLocaleString()}
          </p>
        )}
      </div>

      {/* Disabled state for extraction button */}
      {isExhausted && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>Cannot extract:</strong> Your daily quota has been exhausted. Please wait for the reset or contact support to add more keys.
        </div>
      )}
    </div>
  )
}
