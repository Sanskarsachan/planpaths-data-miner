import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPrompt } from './PromptBuilder'
import type { DetectedState, Chunk, ChunkResult, RawExtractedCourse } from '@/types/extraction'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

// Max concurrent Gemini calls — stay under rate limit
const MAX_CONCURRENT = 5

export async function extractAllChunks(
  chunks: Chunk[],
  state: DetectedState
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = []

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(chunk => extractChunk(chunk, state))
    )
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value)
      else results.push({
        courses: [], chunk_index: -1, subject_hint: null,
        processing_ms: 0, error: r.reason?.message ?? 'Unknown error'
      })
    }
  }

  return results
}

async function extractChunk(chunk: Chunk, state: DetectedState): Promise<ChunkResult> {
  const start = Date.now()
  const prompt = buildPrompt(chunk, state)

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Strip any accidental markdown fences
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let courses: RawExtractedCourse[]
    try {
      const parsed = JSON.parse(cleaned)
      courses = Array.isArray(parsed) ? parsed : []
    } catch {
      // Sometimes Gemini returns a single object instead of array
      try {
        const obj = JSON.parse(cleaned)
        courses = [obj]
      } catch {
        courses = []
      }
    }

    // Filter out low-confidence or empty course names
    courses = courses.filter(c =>
      c.CourseName &&
      typeof c.CourseName === 'string' &&
      c.CourseName.trim().length > 2 &&
      (c._confidence === undefined || c._confidence >= 0.5)
    )

    return {
      courses,
      chunk_index: chunk.index,
      subject_hint: chunk.subject_hint,
      processing_ms: Date.now() - start,
    }
  } catch (err: any) {
    return {
      courses: [],
      chunk_index: chunk.index,
      subject_hint: chunk.subject_hint,
      processing_ms: Date.now() - start,
      error: err.message,
    }
  }
}
