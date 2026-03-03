export type DetectedState = 'FL' | 'TX' | 'CA' | 'UNKNOWN'

export interface RawExtractedCourse {
  CourseName: string
  CourseCode?: string | null
  Category?: string | null
  GradeLevel?: string | null
  Credits?: string | null
  CourseDuration?: string | null
  CourseTerm?: string | null
  Prerequisite?: string | null
  Description?: string | null
  GraduationRequirement?: string | null
  _confidence?: number
  _field_confidence?: {
    CourseName: number
    CourseCode: number
    Credits: number
    GradeLevel: number
  }
}

export interface ChunkResult {
  courses: RawExtractedCourse[]
  chunk_index: number
  subject_hint: string | null
  tokens_used?: number
  processing_ms: number
  error?: string
}

export interface Chunk {
  text: string
  index: number
  subject_hint: string | null
  char_start: number
  char_end: number
}

export interface ExtractionJob {
  upload_id: string
  school_slug: string
  state_code: DetectedState
  total_chunks: number
  completed_chunks: number
  courses_found: number
  status: 'processing' | 'complete' | 'failed'
  error?: string
}
