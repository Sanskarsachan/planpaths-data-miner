import { StateDetector } from '@/lib/extraction/StateDetector'

describe('StateDetector', () => {
  const detector = new StateDetector()

  it('detects Florida state code', () => {
    const text = 'Florida Department of Education course catalog. Course 6101010.'
    const stateCode = detector.detect(text, 'florida-high-school.pdf')

    expect(stateCode).toBe('FL')
  })

  it('detects Texas state code', () => {
    const text = 'Texas Education Agency course offerings. PEIMS course code format.'
    const stateCode = detector.detect(text, 'file.pdf')

    expect(stateCode).toBe('TX')
  })

  it('detects California state code', () => {
    const text = 'California Department of Education catalog. CA course numbering system.'
    const stateCode = detector.detect(text, 'file.pdf')

    expect(stateCode).toBe('CA')
  })

  it('falls back to filename detection', () => {
    const text = 'Generic course catalog'
    const stateCode = detector.detect(text, 'florida_courses.pdf')

    expect(stateCode).toBe('FL')
  })

  it('returns default state when unable to detect', () => {
    const text = 'Generic school courses'
    const stateCode = detector.detect(text, 'untitled.pdf')

    // Should return a valid state code, likely default
    expect(['FL', 'TX', 'CA']).toContain(stateCode)
  })

  it('is case-insensitive', () => {
    const text1 = 'FLORIDA course catalog'
    const text2 = 'florida course catalog'
    const text3 = 'Florida course catalog'

    const state1 = detector.detect(text1, 'file.pdf')
    const state2 = detector.detect(text2, 'file.pdf')
    const state3 = detector.detect(text3, 'file.pdf')

    expect(state1).toBe(state2)
    expect(state2).toBe(state3)
    expect(state1).toBe('FL')
  })
})

describe('StateDetector Edge Cases', () => {
  const detector = new StateDetector()

  it('handles empty text', () => {
    const stateCode = detector.detect('', 'file.pdf')
    expect(stateCode).toBeDefined()
    expect(['FL', 'TX', 'CA']).toContain(stateCode)
  })

  it('handles very long text', () => {
    const longText = 'Florida '.repeat(1000) + 'course catalog'
    const stateCode = detector.detect(longText, 'file.pdf')
    expect(stateCode).toBe('FL')
  })

  it('prioritizes content over filename', () => {
    const text = 'Texas Education Agency content'
    const stateCode = detector.detect(text, 'florida_file.pdf')

    // Should detect Texas from content, not Florida from filename
    expect(stateCode).toBe('TX')
  })
})
