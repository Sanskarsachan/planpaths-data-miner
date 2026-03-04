import type { UploadStatus } from '@/types/database'

export interface ExtractionCourseRow {
  id: number
  name: string
  code: string
  category: string
  grade: string
  credit: string
  length: 'Y' | 'S'
}

export interface ExtractionJob {
  id: string
  school_slug: string
  status: UploadStatus
  total_chunks: number
  courses_found: number
  dupes_removed: number
  processing_ms: number | null
  error_message: string | null
  uploaded_at: string
  completed_at: string | null
  courses: ExtractionCourseRow[]
  processing_status?: string
  pagesProcessed?: number
}

const globalKey = '__planpathsExtractionJobs'

function getStore(): Map<string, ExtractionJob> {
  const g = globalThis as unknown as Record<string, Map<string, ExtractionJob> | undefined>
  if (!g[globalKey]) g[globalKey] = new Map<string, ExtractionJob>()
  return g[globalKey]!
}

export function createJob(id: string, schoolSlug: string): ExtractionJob {
  const job: ExtractionJob = {
    id,
    school_slug: schoolSlug,
    status: 'processing',
    total_chunks: 0,
    courses_found: 0,
    dupes_removed: 0,
    processing_ms: null,
    error_message: null,
    uploaded_at: new Date().toISOString(),
    completed_at: null,
    courses: [],
  }
  getStore().set(id, job)
  return job
}

export function updateJob(id: string, patch: Partial<ExtractionJob>): ExtractionJob | null {
  const existing = getStore().get(id)
  if (!existing) return null
  const next = { ...existing, ...patch }
  getStore().set(id, next)
  return next
}

export function getJob(id: string): ExtractionJob | null {
  return getStore().get(id) ?? null
}
