import type { DetectedState, Chunk } from '@/types/extraction'

export function buildPrompt(chunk: Chunk, state: DetectedState): string {
  const stateContext: Record<string, string> = {
    FL: `Florida school catalog. Course codes are 6 or 7 digits (e.g. "100300" or "1200710").
Duration/Term appears as "X/Y" (e.g. "1/S" = 1 semester, "1/Y" = 1 year).
Split it: CourseDuration = "1", CourseTerm = "S".
Graduation requirement codes: PF, ELA, MATH, SCI, SS, PE, etc.`,
    TX: `Texas school catalog. Courses may have TEA codes and Endorsement labels.`,
    CA: `California school catalog. Note UC/CSU a-g approval status and CTE pathways.`,
    UNKNOWN: `School course catalog.`,
  }

  return `You are extracting courses from a ${stateContext[state] || stateContext.UNKNOWN}
${chunk.subject_hint ? `Subject area: "${chunk.subject_hint}"\n` : ''}
Return a JSON array ONLY — no markdown fences, no explanation, no preamble.

Each course object must use EXACTLY these field names (use null if not found):
{
  "CourseName": "string — required, full course name",
  "CourseCode": "string or null",
  "Category": "string or null — subject area",
  "GradeLevel": "string or null — e.g. '9-12', '10'",
  "Credits": "string or null — e.g. '1', '0.5'",
  "CourseDuration": "string or null — FL only: number part of duration",
  "CourseTerm": "string or null — FL only: Y/S/Q part",
  "Prerequisite": "string or null",
  "Description": "string or null",
  "GraduationRequirement": "string or null",
  "_confidence": 0.95
}

RULES:
- Never invent data. If a field is not present, use null.
- Do not extract page numbers, school names, headers, or footers as courses.
- _confidence = how certain this is a real course (1.0 = certain, 0.5 = unsure).
- Return [] if no courses found.

TEXT:
---
${chunk.text}
---`
}
