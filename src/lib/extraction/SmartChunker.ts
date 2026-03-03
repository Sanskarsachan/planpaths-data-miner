import type { DetectedState, Chunk } from '@/types/extraction'

// Subject section headers to use as chunk boundaries
// Each chunk = one subject area = cleaner AI extraction context
const SECTION_PATTERNS: Record<string, RegExp> = {
  FL:      /^[A-Z][A-Z\s\/&\-]{4,}$/m,       // All-caps lines
  TX:      /^[A-Z][A-Z\s\/&\-]{4,}$/m,
  CA:      /^[A-Z][A-Z\s\/&\-]{4,}$/m,
  UNKNOWN: /^[A-Z][A-Z\s]{5,}$/m,
}

export function createSmartChunks(
  text: string,
  state: DetectedState,
  maxChunkChars = 7000,
  overlapChars = 150
): Chunk[] {
  const pattern = new RegExp(
    (SECTION_PATTERNS[state] || SECTION_PATTERNS.UNKNOWN).source, 'gm'
  )

  // Find section header positions
  const boundaries: number[] = [0]
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > 50) boundaries.push(m.index)  // skip very first header
  }
  boundaries.push(text.length)

  const chunks: Chunk[] = []
  let idx = 0

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end   = boundaries[i + 1]
    const section = text.slice(start, end)
    if (section.trim().length < 100) continue

    const firstLine = section.split('\n')[0].trim()
    const subject_hint = firstLine.length > 3 && firstLine === firstLine.toUpperCase()
      ? firstLine : null

    if (section.length <= maxChunkChars) {
      chunks.push({ text: section, index: idx++, subject_hint, char_start: start, char_end: end })
    } else {
      // Sub-split large sections with overlap
      let pos = 0
      while (pos < section.length) {
        const chunk = section.slice(pos, pos + maxChunkChars)
        chunks.push({
          text: chunk, index: idx++, subject_hint,
          char_start: start + pos, char_end: start + pos + chunk.length,
        })
        pos += maxChunkChars - overlapChars
      }
    }
  }

  return chunks.length > 0 ? chunks : [
    { text, index: 0, subject_hint: null, char_start: 0, char_end: text.length }
  ]
}
