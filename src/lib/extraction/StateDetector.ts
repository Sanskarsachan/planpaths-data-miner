import type { DetectedState } from '@/types/extraction'

const STATE_SIGNALS: Record<string, RegExp[]> = {
  FL: [
    /florida|sunshine state|fldoe|cpalms/i,
    /\b\d{7}\b.{0,30}\d\/[YSQ]/,          // 7-digit code + duration/term pattern
    /Graduation Requirements|Fine Arts Credit|Practical Arts/i,
    /\bM\/J\s+\w/,                          // M/J prefix = Florida middle school
    /\bHOPE\b/,                             // FL-specific PE course
  ],
  TX: [
    /texas|lone star|tea\.state\.tx/i,
    /\bTEKS\b|\bEndorsement\b/i,
    /Foundation.*High School Program/i,
  ],
  CA: [
    /california|UC.*approved|CSU.*approved/i,
    /\bA-G\b|\bag\s+requirement/i,
    /CTE.*Pathway|Career Technical Education/i,
  ],
}

export function detectState(text: string, filename: string): DetectedState {
  const scores: Record<string, number> = { FL: 0, TX: 0, CA: 0 }
  const sample = text.slice(0, 5000)  // check first 5000 chars only

  for (const [state, patterns] of Object.entries(STATE_SIGNALS)) {
    for (const p of patterns) if (p.test(sample)) scores[state]++
  }

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [best, second] = entries
  if (best[1] >= 2 && best[1] > (second?.[1] ?? 0)) return best[0] as DetectedState

  // Fallback: filename
  if (/florida|[-_]fl[-_.]|[-_]fl$/i.test(filename)) return 'FL'
  if (/texas|[-_]tx[-_.]|[-_]tx$/i.test(filename))   return 'TX'
  if (/california|[-_]ca[-_.]|[-_]ca$/i.test(filename)) return 'CA'

  return 'UNKNOWN'
}
