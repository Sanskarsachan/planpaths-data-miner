import { hashCourse } from '@/utils/hashCourse'
import type { RawExtractedCourse } from '@/types/extraction'

export interface DedupeResult {
  unique: (RawExtractedCourse & { _hash: string })[]
  duplicateCount: number
}

export function deduplicateWithinUpload(
  courses: RawExtractedCourse[],
  schoolSlug: string
): DedupeResult {
  const seen = new Map<string, RawExtractedCourse & { _hash: string }>()

  for (const course of courses) {
    const hash = hashCourse(course.CourseName, course.CourseCode, schoolSlug)
    if (!seen.has(hash)) {
      seen.set(hash, { ...course, _hash: hash })
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicateCount: courses.length - seen.size,
  }
}
