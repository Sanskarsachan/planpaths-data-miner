export type StateCode = 'FL' | 'TX' | 'CA'
export type UploadStatus = 'processing' | 'complete' | 'failed'
export type ReviewStatus = 'auto' | 'needs_review' | 'confirmed' | 'rejected'

export type MatchType =
  | 'cpalms-terminated'
  | 'exact-course-code'
  | 'exact-course-code-remblanks-match'
  | 'exact-8char-course-code-remove-last-match'
  | 'exact-8char-course-code-remove-last-character-match'
  | 'exact-course-name'
  | 'exact-course-name-uppercase'
  | 'exact-course-name-remblanks-match'
  | 'exact-course-name-upper-remblanks-match'
  | 'exact-course-abb-name'
  | 'exact-course-abb-name-uppercase'
  | 'exact-course-abb-name-remblanks-match'
  | 'exact-course-abb-name-upper-remblanks-match'
  | 'exact-roman-course-name-match'
  | 'exact-roman-course-abbreviated-name-match'
  | 'exact-honors-position-roman-match'
  | 'exact-course-name-ap-transformation'
  | 'exact-course-name-ap-ampersand-expansion-remblanks'
  | 'exact-course-name-ib-transformation'
  | 'exact-course-name-symmetric-cambridge-remblanks'
  | 'exact-course-name-skeleton-alphanumeric-match'
  | 'exact-course-name-sorted-word-match'
  | 'exact-course-name-conjunction-roman-strip-v4'
  | 'Expanded Abbreviations (US, Math, M/J) & Removed Spaces'
  | 'Expanded AP and Standardized Honors (H/Hon to Honors)'
  | 'synonym-table-match'
  | 'partial-prefix-match'
  | 'to-be-deleted-k5'
  | 'unmatched'

export interface School {
  id: string
  name: string
  slug: string
  state_code: StateCode
  district: string | null
  city: string | null
  created_at: string
}

export interface Upload {
  id: string
  school_id: string
  school_slug: string
  filename: string
  state_code: StateCode
  status: UploadStatus
  total_chunks: number
  courses_found: number
  dupes_removed: number
  processing_ms: number | null
  error_message: string | null
  uploaded_at: string
  completed_at: string | null
}

export interface MasterCourse {
  id: string
  state_code: StateCode
  course_code: string
  course_name: string
  abbrev_name: string | null
  category: string | null
  sub_category: string | null
  grade_level: string | null
  credit: string | null
  level: string | null
  grad_requirement: string | null
  is_active: boolean
  termination_date: string | null
}

export interface ExtractedCourse {
  id: string
  upload_id: string
  school_slug: string
  state_code: StateCode
  course_name: string
  course_code: string | null
  category: string | null
  grade_level: string | null
  credits: string | null
  course_duration: string | null
  course_term: string | null
  grad_requirement: string | null
  honors_flag: boolean
  confidence_score: number
  field_scores: Record<string, number> | null
  chunk_index: number | null
  is_duplicate: boolean
  content_hash: string | null
  extracted_at: string
}

export interface MappingResult {
  id: string
  extracted_id: string
  state_code: StateCode
  master_course_id: string | null
  match_type: MatchType
  confidence: number
  matched_code: string | null
  matched_name: string | null
  matched_abbrev: string | null
  review_status: ReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  mapped_at: string
}

export interface MappingPassSummary {
  mapping_logic: MatchType
  count: number
}
