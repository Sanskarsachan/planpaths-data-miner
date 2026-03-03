/**
 * Type definitions for Quota System
 */

export interface ApiKeyRecord {
  id: string
  nickname: string
  key: string
  is_active: boolean
  is_deleted: boolean
  quota_daily_limit: number
  quota_used_today: number
  quota_reset_at: string
  total_requests: number
  total_tokens_used: number
  estimated_cost_cents: number
  created_at: string
  last_used_at?: string
  updated_at: string
}

export interface QuotaCheckResult {
  available: boolean
  remaining: number
  limit: number
  percentage_used: number
  reset_at: string
  reset_in_seconds?: number
}

export interface ApiKeyResponse {
  id: string
  nickname: string
  quota_remaining: number
  quota_limit: number
  percentage_used: number
  is_active: boolean
  last_used_at?: string
}

export interface ApiUsageResponse {
  id: string
  api_key_id: string
  api_key_nickname?: string
  upload_id?: string
  request_type?: string
  status: 'success' | 'error' | 'timeout' | 'rate_limited' | 'quota_exceeded'
  tokens_used?: number
  estimated_cost_cents?: number
  school_name?: string
  file_name?: string
  created_at: string
  processing_ms?: number
}

export interface QuotaDashboardData {
  total_keys: number
  active_keys: number
  quota_remaining: number
  quota_limit: number
  percentage_used: number
  total_requests_today: number
  next_reset_at: string
  keys: ApiKeyResponse[]
  recent_logs: ApiUsageResponse[]
  daily_stats: DailyQuotaStats[]
}

export interface DailyQuotaStats {
  usage_date: string
  total_requests: number
  successful_requests: number
  failed_requests: number
  total_tokens: number
  estimated_cost: number
  keys_used: number
}

export interface ExtractorOptions {
  apiKeyId: string
  uploadId?: string
  schoolId?: string
  schoolName?: string
  fileName?: string
  onProgress?: (progress: ExtractionProgress) => void
}

export interface ExtractionProgress {
  status: 'processing' | 'quota_check' | 'key_selection' | 'extracting' | 'complete' | 'error'
  current: number
  total: number
  message: string
  quota_remaining?: number
  tokens_used?: number
}

export interface ExtractorError extends Error {
  code: 'QUOTA_EXHAUSTED' | 'NO_KEYS_AVAILABLE' | 'KEY_INACTIVE' | 'API_ERROR' | 'UNKNOWN'
  statusCode: number
  details?: Record<string, any>
}

export interface TokenEstimate {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_cost_cents: number
}
