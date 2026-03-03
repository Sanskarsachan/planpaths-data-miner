/**
 * React hook for quota management
 * Use in components to check quota, select keys, and track usage
 */

'use client'

import { useCallback, useState, useEffect } from 'react'
import type { QuotaCheckResult, ApiKeyResponse, QuotaDashboardData } from '@/types/quota'

interface UseQuotaOptions {
  autoCheck?: boolean
  refreshInterval?: number  // milliseconds
}

export function useQuota(options: UseQuotaOptions = {}) {
  const { autoCheck = true, refreshInterval = 30000 } = options

  const [quota, setQuota] = useState<QuotaCheckResult | null>(null)
  const [keys, setKeys] = useState<ApiKeyResponse[]>([])
  const [dashboard, setDashboard] = useState<QuotaDashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check quota availability
  const checkQuota = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/v2/quota/status')

      if (!response.ok) {
        throw new Error(`Quota check failed: ${response.statusText}`)
      }

      const data = await response.json() as QuotaCheckResult
      setQuota(data)
      return data
    } catch (err: any) {
      const message = err.message || 'Failed to check quota'
      setError(message)
      console.error('Quota check error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Get all available keys
  const getAvailableKeys = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/v2/quota/keys')

      if (!response.ok) {
        throw new Error(`Failed to fetch keys: ${response.statusText}`)
      }

      const data = await response.json() as ApiKeyResponse[]
      setKeys(data)
      return data
    } catch (err: any) {
      const message = err.message || 'Failed to fetch API keys'
      setError(message)
      console.error('Keys fetch error:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Get dashboard data
  const getDashboard = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/v2/quota/dashboard')

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard: ${response.statusText}`)
      }

      const data = await response.json() as QuotaDashboardData
      setDashboard(data)
      return data
    } catch (err: any) {
      const message = err.message || 'Failed to fetch dashboard'
      setError(message)
      console.error('Dashboard fetch error:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  // Check quota on mount and interval
  useEffect(() => {
    if (!autoCheck) return

    const checkQuotaAsync = async () => {
      await checkQuota()
    }

    // Initial check
    checkQuotaAsync()

    // Set up interval for auto-refresh
    if (refreshInterval > 0) {
      const interval = setInterval(checkQuotaAsync, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoCheck, refreshInterval, checkQuota])

  return {
    // State
    quota,
    keys,
    dashboard,
    loading,
    error,

    // Methods
    checkQuota,
    getAvailableKeys,
    getDashboard,

    // Derived state
    isQuotaAvailable: quota?.available ?? false,
    remainingRequests: quota?.remaining ?? 0,
    quotaPercentageUsed: quota?.percentage_used ?? 0,
    resetAt: quota?.reset_at ? new Date(quota.reset_at) : null,
    hasActiveKeys: keys.length > 0,
  }
}

/**
 * Hook to handle extraction with quota checks
 */
export function useExtraction() {
  const quota = useQuota()
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  const startExtraction = useCallback(
    async (
      uploadedFile: File,
      schoolName: string,
      stateCode: string,
      selectedApiKeyId: string
    ) => {
      try {
        // Check quota first
        const currentQuota = await quota.checkQuota()

        if (!currentQuota?.available) {
          throw new Error(
            `Quota exhausted. Your limit resets on ${currentQuota?.reset_at || 'unknown date'}`
          )
        }

        setExtracting(true)
        setExtractError(null)

        const formData = new FormData()
        formData.append('file', uploadedFile)
        formData.append('school_name', schoolName)
        formData.append('state_code', stateCode)
        formData.append('api_key_id', selectedApiKeyId)

        const response = await fetch('/api/extract', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Extraction failed: ${response.statusText}`)
        }

        // Refresh quota after successful extraction
        await quota.checkQuota()

        return await response.json()
      } catch (err: any) {
        const message = err.message || 'Extraction failed'
        setExtractError(message)
        console.error('Extraction error:', err)
        throw err
      } finally {
        setExtracting(false)
      }
    },
    [quota]
  )

  return {
    ...quota,
    extracting,
    extractError,
    startExtraction,
  }
}
