import { detectState } from '@/lib/extraction/StateDetector'

describe('StateDetector', () => {
  it('detects Florida state code', () => {
    const text = 'Florida Department of Education course catalog. Course 6101010.'
    const stateCode = detectState(text, 'florida-high-school.pdf')

    expect(stateCode).toBe('FL')
  })

  it('detects Texas state code', () => {
    const text = 'Texas Education Agency course offerings. PEIMS course code format.'
    const stateCode = detectState(text, 'file.pdf')

    expect(stateCode).toBe('TX')
  })

  it('detects California state code', () => {
    const text = 'California Department of Education catalog. CA course numbering system.'
    const stateCode = detectState(text, 'file.pdf')

    expect(stateCode).toBe('CA')
  })

  it('falls back to filename detection', () => {
    const text = 'Generic course catalog'
    const stateCode = detectState(text, 'florida_courses.pdf')

    expect(stateCode).toBe('FL')
  })

  it('returns UNKNOWN when unable to detect', () => {
    const text = 'Generic school courses'
    const stateCode = detectState(text, 'untitled.pdf')

    expect(stateCode).toBe('UNKNOWN')
  })

  it('is case-insensitive', () => {
    const text1 = 'FLORIDA course catalog'
    const text2 = 'florida course catalog'
    const text3 = 'Florida course catalog'

    const state1 = detectState(text1, 'file.pdf')
    const state2 = detectState(text2, 'file.pdf')
    const state3 = detectState(text3, 'file.pdf')

    expect(state1).toBe(state2)
    expect(state2).toBe(state3)
    expect(state1).toBe('FL')
  })
})

describe('StateDetector Edge Cases', () => {
  it('handles empty text', () => {
    const stateCode = detectState('', 'file.pdf')
    expect(stateCode).toBeDefined()
    expect(stateCode).toBe('UNKNOWN')
  })

  it('handles very long text', () => {
    const longText = 'Florida '.repeat(1000) + 'course catalog'
    const stateCode = detectState(longText, 'file.pdf')
    expect(stateCode).toBe('FL')
  })

  it('prioritizes content over filename', () => {
    const text = 'Texas Education Agency content'
    const stateCode = detectState(text, 'florida_file.pdf')

    // Should detect Texas from content, not Florida from filename
    expect(stateCode).toBe('TX')
  })
})
