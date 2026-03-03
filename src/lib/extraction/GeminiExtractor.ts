import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPrompt } from './PromptBuilder'
import { getQuotaManager } from '@/lib/quota/QuotaManager'
import type { DetectedState, Chunk, ChunkResult, RawExtractedCourse } from '@/types/extraction'

// Max concurrent Gemini calls — stay under rate limit
const MAX_CONCURRENT = 5

// Fallback to env variable if quota system not initialized
const FALLBACK_API_KEY = process.env.GEMINI_API_KEY || ''

interface ExtractChunkOptions {
  apiKeyId?: string
  uploadId?: string
  schoolName?: string
}

export async function extractAllChunks(
  chunks: Chunk[],
  state: DetectedState,
  options?: ExtractChunkOptions
): Promise<ChunkResult[]> {
  const results: ChunkResult[] = []

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.allSettled(
      batch.map(chunk => extractChunk(chunk, state, options))
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

async function extractChunk(
  chunk: Chunk,
  state: DetectedState,
  options?: ExtractChunkOptions
): Promise<ChunkResult> {
  const start = Date.now()
  const prompt = buildPrompt(chunk, state)

  try {
    // Get API key from quota manager if available
    let apiKey = FALLBACK_API_KEY
    const quotaMgr = getQuotaManager()
    
    if (options?.apiKeyId && quotaMgr) {
      const keyData = await quotaMgr.getApiKey(options.apiKeyId)
      if (keyData?.key) {
        apiKey = keyData.key
      }
    }

    // Create Gemini client with the selected key
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // Call Gemini API
    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Extract token usage
    const usageMetadata = (result.response as any).usageMetadata
    const promptTokens = usageMetadata?.promptTokenCount || 0
    const completionTokens = usageMetadata?.candidatesTokenCount || 0
    const totalTokens = promptTokens + completionTokens

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

    // Log successful usage
    if (options?.apiKeyId && quotaMgr) {
      await quotaMgr.logApiUsage({
        api_key_id: options.apiKeyId,
        upload_id: options.uploadId,
        request_type: 'extract',
        status: 'success',
        tokens_used: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        estimated_cost_cents: calculateCost(promptTokens, completionTokens),
        school_name: options.schoolName,
        processing_ms: Date.now() - start,
      })
    }

    return {
      courses,
      chunk_index: chunk.index,
      subject_hint: chunk.subject_hint,
      processing_ms: Date.now() - start,
    }
  } catch (err: any) {
    const processing_ms = Date.now() - start

    // Log error
    if (options?.apiKeyId && getQuotaManager()) {
      await getQuotaManager()!.logApiUsage({
        api_key_id: options.apiKeyId,
        upload_id: options.uploadId,
        request_type: 'extract',
        status: 'error',
        error_message: err.message,
        school_name: options.schoolName,
        processing_ms,
      })
    }

    return {
      courses: [],
      chunk_index: chunk.index,
      subject_hint: chunk.subject_hint,
      processing_ms,
      error: err.message,
    }
  }
}

/**
 * Calculate estimated cost in cents
 * Gemini 2.5 Flash pricing: $0.00001 per input token, $0.00004 per output token
 */
function calculateCost(promptTokens: number, completionTokens: number): number {
  const INPUT_COST_PER_TOKEN = 0.00001
  const OUTPUT_COST_PER_TOKEN = 0.00004
  const cost = (promptTokens * INPUT_COST_PER_TOKEN + completionTokens * OUTPUT_COST_PER_TOKEN) * 100
  return Math.round(cost * 100) / 100  // Round to 2 decimals (cents)
}
