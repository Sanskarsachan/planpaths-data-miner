import { hashCourse } from '@/utils/hashCourse'

describe('hashCourse Utility', () => {
  it('generates consistent hashes for the same input', () => {
    const schoolSlug = 'test-high-school'
    const courseCode = '6101010'
    const name = 'English I'

    const hash1 = hashCourse(name, courseCode, schoolSlug)
    const hash2 = hashCourse(name, courseCode, schoolSlug)

    expect(hash1).toBe(hash2)
  })

  it('generates different hashes for different inputs', () => {
    const schoolSlug = 'test-high-school'
    const baseCode = '6101010'
    const baseName = 'English I'

    const hash1 = hashCourse(baseName, baseCode, schoolSlug)
    const hash2 = hashCourse('English II', baseCode, schoolSlug) // Different name

    expect(hash1).not.toBe(hash2)
  })

  it('returns a 16-character truncated SHA-256 hash', () => {
    const hash = hashCourse('English I', '6101010', 'test-school')

    expect(hash).toMatch(/^[a-f0-9]{16}$/)
  })

  it('handles special characters in input', () => {
    expect(() => {
      hashCourse(
        "O'Brien's English",
        '6101010',
        'school-with-"quotes"'
      )
    }).not.toThrow()
  })

  it('treats whitespace differences as different hashes', () => {
    const hash1 = hashCourse('English I', '6101010', 'school')
    const hash2 = hashCourse('English  I', '6101010', 'school') // Extra space

    expect(hash1).not.toBe(hash2)
  })
})
