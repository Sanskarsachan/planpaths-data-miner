import { createHash } from 'crypto'

export function hashCourse(
  courseName: string,
  courseCode: string | null | undefined,
  schoolSlug: string
): string {
  const input = [
    courseName.trim().toUpperCase(),
    (courseCode ?? '').trim().toUpperCase(),
    schoolSlug,
  ].join('|')
  // First 16 hex chars of SHA-256 (64 bits — collision-safe for course volumes)
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
