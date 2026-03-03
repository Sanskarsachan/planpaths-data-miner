/**
 * QuotaManager - Core quota management service
 * Handles all quota logic: checks, key selection, logging, resets
 * 
 * Key Features:
 * - Shared quota pool (all 19 keys share 20 requests/day)
 * - Auto-select best available key
 * - Automatic quota reset at midnight UTC
 * - Comprehensive usage logging
 * - Round-robin fairness
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ApiKey {
  id: string
  nickname: string
  key: string
  is_active: boolean
  is_deleted: boolean
  quota_daily_limit: number
  quota_used_today: number
  quota_remaining: number
  quota_reset_at: string
  total_requests: number
  total_tokens_used: number
  estimated_cost_cents: number
  created_at: string
  last_used_at?: string
}

export interface QuotaStatus {
  available: boolean
  remaining: number
  limit: number
  percentage_used: number
  reset_at: string
  total_keys: number
  active_keys: number
}

export interface ApiUsageLog {
  api_key_id: string
  upload_id?: string
  school_id?: string
  request_type?: string
  status: 'success' | 'error' | 'timeout' | 'rate_limited'
  error_message?: string
  tokens_used?: number
  prompt_tokens?: number
  completion_tokens?: number
  estimated_cost_cents?: number
  school_name?: string
  file_name?: string
  processing_ms?: number
}

export class QuotaManager {
  constructor(
    private supabase: SupabaseClient,
    private logger: (msg: string, level?: 'info' | 'warn' | 'error') => void = console.log
  ) {}

  /**
   * Check if quota is available across all keys
   * Automatically resets quota if past reset_at timestamp
   * Falls back gracefully if quota system unavailable
   */
  async checkQuotaAvailable(): Promise<QuotaStatus> {
    try {
      const { data, error } = await this.supabase.rpc('check_quota_available')

      if (error) {
        this.logger(`Warning: Quota check failed (${error.message}), using fallback`, 'warn')
        // Fallback: assume quota available if system unavailable
        return {
          available: true,
          remaining: 20,
          limit: 20,
          percentage_used: 0,
          reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_keys: 0,
          active_keys: 0,
        }
      }

      if (!data || data.length === 0) {
        this.logger('No active API keys found, using fallback', 'warn')
        return {
          available: true,
          remaining: 20,
          limit: 20,
          percentage_used: 0,
          reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_keys: 0,
          active_keys: 0,
        }
      }

      const status = data[0]
      const percentage_used = status.limit > 0 
        ? Math.round((((status.limit - status.remaining) / status.limit) * 100) * 100) / 100
        : 0

      return {
        available: status.available || status.remaining > 0,
        remaining: status.remaining ?? 0,
        limit: status.limit ?? 0,
        percentage_used,
        reset_at: status.reset_at,
        total_keys: 0,
        active_keys: 0,
      }
    } catch (err: any) {
      this.logger(`Fatal quota check error: ${err.message}`, 'error')
      // Default to allowing request (fail open) to avoid blocking users
      return {
        available: true,
        remaining: 1,
        limit: 20,
        percentage_used: 95,
        reset_at: new Date().toISOString(),
        total_keys: 0,
        active_keys: 0,
      }
    }
  }

  /**
   * Select the best available API key
   * Uses round-robin strategy: picks key with most remaining quota
   * Falls back gracefully if quota system unavailable
   */
  async selectNextApiKey(): Promise<ApiKey | null> {
    try {
      // Use RPC function that handles quota reset
      const { data, error } = await this.supabase.rpc('select_best_available_api_key')

      if (error) {
        this.logger(`Warning: Key selection failed (${error.message}), using fallback`, 'warn')
        // Return mock key that uses GEMINI_API_KEY env var
        return {
          id: 'fallback-default',
          nickname: 'Fallback (env var)',
          key: process.env.GEMINI_API_KEY || '',
          is_active: true,
          is_deleted: false,
          quota_daily_limit: 20,
          quota_used_today: 0,
          quota_remaining: 20,
          quota_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_requests: 0,
          total_tokens_used: 0,
          estimated_cost_cents: 0,
          created_at: new Date().toISOString(),
        }
      }

      if (!data || !data[0]) {
        this.logger('No available API keys, using fallback', 'warn')
        return {
          id: 'fallback-default',
          nickname: 'Fallback (env var)',
          key: process.env.GEMINI_API_KEY || '',
          is_active: true,
          is_deleted: false,
          quota_daily_limit: 20,
          quota_used_today: 0,
          quota_remaining: 20,
          quota_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          total_requests: 0,
          total_tokens_used: 0,
          estimated_cost_cents: 0,
          created_at: new Date().toISOString(),
        }
      }

      const keyId = data[0]

      // Fetch the full key details
      return await this.getApiKey(keyId)
    } catch (err: any) {
      this.logger(`Warning: Key selection error (${err.message}), using fallback`, 'warn')
      // Return fallback key
      return {
        id: 'fallback-default',
        nickname: 'Fallback (env var)',
        key: process.env.GEMINI_API_KEY || '',
        is_active: true,
        is_deleted: false,
        quota_daily_limit: 20,
        quota_used_today: 0,
        quota_remaining: 20,
        quota_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        total_requests: 0,
        total_tokens_used: 0,
        estimated_cost_cents: 0,
        created_at: new Date().toISOString(),
      }
    }
  }

  /**
   * Get a specific API key by ID
   * Returns null if key doesn't exist, is deleted, or is inactive
   */
  async getApiKey(apiKeyId: string): Promise<ApiKey | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('id', apiKeyId)
        .eq('is_deleted', false)
        .single()

      if (error || !data) {
        return null
      }

      return this.formatApiKey(data)
    } catch (err: any) {
      this.logger(`Error fetching API key: ${err.message}`, 'error')
      return null
    }
  }

  /**
   * Get all active API keys with quota info
   * Useful for dropdowns and dashboards
   */
  async getAllActiveKeys(): Promise<ApiKey[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('is_active', true)
        .eq('is_deleted', false)
        .order('quota_used_today', { ascending: true })  // Keys with most quota first

      if (error) {
        this.logger(`Error fetching active keys: ${error.message}`, 'error')
        return []
      }

      return (data || []).map(k => this.formatApiKey(k))
    } catch (err: any) {
      this.logger(`Fatal error fetching keys: ${err.message}`, 'error')
      return []
    }
  }

  /**
   * Log API usage and increment quota counter
   * Only increments quota counter on SUCCESS status
   */
  async logApiUsage(usage: ApiUsageLog): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.rpc('log_api_usage', {
        p_api_key_id: usage.api_key_id,
        p_upload_id: usage.upload_id || null,
        p_school_id: usage.school_id || null,
        p_request_type: usage.request_type || null,
        p_status: usage.status || 'success',
        p_error_message: usage.error_message || null,
        p_tokens_used: usage.tokens_used || 0,
        p_prompt_tokens: usage.prompt_tokens || 0,
        p_completion_tokens: usage.completion_tokens || 0,
        p_estimated_cost_cents: usage.estimated_cost_cents || 0,
        p_school_name: usage.school_name || null,
        p_file_name: usage.file_name || null,
        p_processing_ms: usage.processing_ms || 0,
      })

      if (error) {
        this.logger(`Error logging API usage: ${error.message}`, 'error')
        return null
      }

      const logId = data?.[0]
      this.logger(
        `Logged ${usage.status} request (tokens: ${usage.tokens_used || 0})`,
        'info'
      )

      return logId
    } catch (err: any) {
      this.logger(`Fatal error logging usage: ${err.message}`, 'error')
      return null
    }
  }

  /**
   * Reset daily quotas (call at midnight UTC)
   * Sets quota_used_today = 0 for all keys
   * Logs the reset event
   */
  async resetDailyQuotas(): Promise<{
    success: boolean
    keys_reset: number
    total_requests_before: number
    reset_at: string
  }> {
    try {
      const { data, error } = await this.supabase.rpc('reset_daily_quotas')

      if (error) {
        this.logger(`Error resetting quotas: ${error.message}`, 'error')
        return {
          success: false,
          keys_reset: 0,
          total_requests_before: 0,
          reset_at: new Date().toISOString(),
        }
      }

      const result = data?.[0] || {}
      this.logger(
        `Daily quotas reset: ${result.keys_reset} keys, ${result.total_requests_before} requests before reset`,
        'info'
      )

      return {
        success: !error,
        keys_reset: result.keys_reset || 0,
        total_requests_before: result.total_requests_before || 0,
        reset_at: result.reset_at || new Date().toISOString(),
      }
    } catch (err: any) {
      this.logger(`Fatal error resetting quotas: ${err.message}`, 'error')
      return {
        success: false,
        keys_reset: 0,
        total_requests_before: 0,
        reset_at: new Date().toISOString(),
      }
    }
  }

  /**
   * Get quota statistics for dashboard
   */
  async getQuotaStats(): Promise<{
    total_keys: number
    active_keys: number
    total_requests_today: number
    total_quota_available: number
    quota_remaining: number
    percentage_used: number
    next_reset_at: string
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_quota_status')
        .select('*')
        .single()

      if (error) {
        this.logger(`Error fetching quota stats: ${error.message}`, 'error')
        return null
      }

      return data
    } catch (err: any) {
      this.logger(`Fatal error fetching stats: ${err.message}`, 'error')
      return null
    }
  }

  /**
   * Get recent usage logs
   */
  async getRecentUsageLogs(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_usage_logs')
        .select(
          `
          id,
          api_key_id,
          api_keys(nickname),
          request_type,
          status,
          tokens_used,
          estimated_cost_cents,
          school_name,
          created_at
          `
        )
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        this.logger(`Error fetching usage logs: ${error.message}`, 'error')
        return []
      }

      return data || []
    } catch (err: any) {
      this.logger(`Fatal error fetching logs: ${err.message}`, 'error')
      return []
    }
  }

  /**
   * Get daily usage analytics
   */
  async getDailyUsageStats(days: number = 30): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_daily_usage')
        .select('*')
        .limit(days)

      if (error) {
        this.logger(`Error fetching daily stats: ${error.message}`, 'error')
        return []
      }

      return data || []
    } catch (err: any) {
      this.logger(`Fatal error fetching daily stats: ${err.message}`, 'error')
      return []
    }
  }

  /**
   * Add a new API key to the pool
   */
  async addApiKey(nickname: string, key: string): Promise<ApiKey | null> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .insert({
          nickname,
          key,
          is_active: true,
          is_deleted: false,
          quota_daily_limit: 20,
          quota_used_today: 0,
        })
        .select()
        .single()

      if (error) {
        this.logger(`Error adding API key: ${error.message}`, 'error')
        return null
      }

      this.logger(`Added new API key: ${nickname}`, 'info')
      return this.formatApiKey(data)
    } catch (err: any) {
      this.logger(`Fatal error adding key: ${err.message}`, 'error')
      return null
    }
  }

  /**
   * Deactivate an API key
   */
  async deactivateApiKey(apiKeyId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ is_active: false })
        .eq('id', apiKeyId)

      if (error) {
        this.logger(`Error deactivating key: ${error.message}`, 'error')
        return false
      }

      this.logger(`Deactivated API key: ${apiKeyId}`, 'info')
      return true
    } catch (err: any) {
      this.logger(`Fatal error deactivating key: ${err.message}`, 'error')
      return false
    }
  }

  /**
   * Soft delete an API key
   */
  async deleteApiKey(apiKeyId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({ is_deleted: true, is_active: false })
        .eq('id', apiKeyId)

      if (error) {
        this.logger(`Error deleting key: ${error.message}`, 'error')
        return false
      }

      this.logger(`Deleted API key: ${apiKeyId}`, 'info')
      return true
    } catch (err: any) {
      this.logger(`Fatal error deleting key: ${err.message}`, 'error')
      return false
    }
  }

  /**
   * Private: Format API key response
   */
  private formatApiKey(data: any): ApiKey {
    return {
      id: data.id,
      nickname: data.nickname,
      key: data.key,
      is_active: data.is_active,
      is_deleted: data.is_deleted,
      quota_daily_limit: data.quota_daily_limit,
      quota_used_today: data.quota_used_today,
      quota_remaining: (data.quota_daily_limit - data.quota_used_today) || 0,
      quota_reset_at: data.quota_reset_at,
      total_requests: data.total_requests,
      total_tokens_used: data.total_tokens_used,
      estimated_cost_cents: data.estimated_cost_cents,
      created_at: data.created_at,
      last_used_at: data.last_used_at,
    }
  }
}

/**
 * Singleton instance of QuotaManager
 * Use getQuotaManager() to get instance
 */
let quotaManagerInstance: QuotaManager | null = null

export function initializeQuotaManager(supabase: SupabaseClient): QuotaManager {
  quotaManagerInstance = new QuotaManager(supabase)
  return quotaManagerInstance
}

export function getQuotaManager(): QuotaManager | null {
  return quotaManagerInstance
}
