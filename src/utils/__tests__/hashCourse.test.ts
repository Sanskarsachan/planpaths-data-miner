import { hashCourse } from '@/utils/hashCourse'

describe('hashCourse Utility', () => {
  it('generates consistent hashes for the same input', () => {
    const schoolSlug = 'test-high-school'
    const courseCode = '6101010'
    const name = 'English I'
    const category = 'English Language Arts'

    const hash1 = hashCourse(schoolSlug, courseCode, name, category)
    const hash2 = hashCourse(schoolSlug, courseCode, name, category)

    expect(hash1).toBe(hash2)
  })

  it('generates different hashes for different inputs', () => {
    const schoolSlug = 'test-high-school'
    const baseCode = '6101010'
    const baseName = 'English I'
    const baseCategory = 'English Language Arts'

    const hash1 = hashCourse(schoolSlug, baseCode, baseName, baseCategory)
    const hash2 = hashCourse(schoolSlug, baseCode, 'English II', baseCategory) // Different name

    expect(hash1).not.toBe(hash2)
  })

  it('returns a 64-character SHA-256 hash', () => {
    const hash = hashCourse(
      'test-school',
      '6101010',
      'English I',
      'English Language Arts'
    )

    // SHA-256 hash in hex is 64 characters
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles special characters in input', () => {
    expect(() => {
      hashCourse(
        'school-with-"quotes"',
        '6101010',
        "O'Brien's English",
        'English & Language'
      )
    }).not.toThrow()
  })

  it('treats whitespace differences as different hashes', () => {
    const hash1 = hashCourse('school', '6101010', 'English I', 'English')
    const hash2 = hashCourse('school', '6101010', 'English  I', 'English') // Extra space

    expect(hash1).not.toBe(hash2)
  })
})
