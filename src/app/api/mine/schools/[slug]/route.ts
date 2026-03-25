import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import { schoolSlug } from '@/utils/slugify';
import {
  getErrorMessage,
  getSupabaseConnectionHint,
  isSupabaseNetworkError,
  isTableNotFoundError,
} from '@/lib/supabase/error-utils';

const unavailableResponse = (slug: string) =>
  NextResponse.json(
    {
      slug,
      total: 0,
      rows: [],
      warning: getSupabaseConnectionHint(),
      connectionStatus: 'unavailable',
    },
    { status: 200 }
  );

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const supabase = createAdminClient();
    let rows: Array<{
      id: string;
      name: string;
      code: string;
      category: string;
      grade: string;
      credit: string;
      duration: string;
      matchType: string;
      matchedCode: string | null;
      confidence: number;
    }> = [];

    // Fetch all courses for this school (paginated, sorted by category then name)
    let courses: any[] = [];
    try {
      const { count, error: countErr } = await supabase
        .from('extractions_v2')
        .select('*', { count: 'exact', head: true })
        .eq('school_slug', slug);

      if (countErr && !isTableNotFoundError(countErr)) throw countErr;

      const total = count ?? 0;
      if (total > 0) {
        const PAGE = 1000;
        const pages = Math.ceil(total / PAGE);
        const results = await Promise.all(
          Array.from({ length: pages }, (_, i) =>
            supabase
              .from('extractions_v2')
              .select('id, course_name, course_code, category, grade_level, credits, course_duration, match_type')
              .eq('school_slug', slug)
              .order('category')
              .order('course_name')
              .range(i * PAGE, (i + 1) * PAGE - 1)
          )
        );
        for (const { data, error } of results) {
          if (error) throw error;
          if (data) courses.push(...data);
        }
      }
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) return unavailableResponse(slug);
      if (!isTableNotFoundError(e)) throw new Error(`courses query failed: ${getErrorMessage(e)}`);
    }

    if (courses.length > 0) {
      // Get mapping results for extracted courses.
      const extractionIds = courses.map((c: any) => c.id);
      const mappingByExtractionId: Record<string, { matchType: string; matchedCode: string | null; confidence: number }> = {};

      if (extractionIds.length > 0) {
        try {
          const mappingRows = await fetchAllRows<any>(supabase, 'mapping_results', 'extracted_id, match_type, matched_code, confidence');
          const idSet = new Set(extractionIds);
          for (const m of mappingRows) {
            if (idSet.has(m.extracted_id)) {
              mappingByExtractionId[m.extracted_id] = {
                matchType: m.match_type,
                matchedCode: m.matched_code ?? null,
                confidence: m.confidence ?? 0,
              };
            }
          }
        } catch (e: any) {
          if (isSupabaseNetworkError(e)) return unavailableResponse(slug);
          // Mapping table may not exist yet — ignore
        }
      }

      rows = courses.map((c: any) => {
        const m = mappingByExtractionId[c.id];
        return {
          id: c.id,
          name: c.course_name,
          code: c.course_code || '—',
          category: c.category || '—',
          grade: c.grade_level || '—',
          credit: c.credits || '—',
          duration: c.course_duration || '—',
          matchType: m?.matchType ?? 'unmatched',
          matchedCode: m?.matchedCode ?? null,
          confidence: m?.confidence ?? 0,
        };
      });
    } else {
      // Fallback: some school rows are derived from florida_final_dump when extracted courses aren't present.
      try {
        const floridaRows = await fetchAllRows<any>(
          supabase,
          'florida_final_dump',
          '"Extraction ID", "School Name", "Course Code", "Course Name", "Category", "Grade Level", "Credit", "Length", "Mapped Code", "Confidence", mapping_logic'
        );

        rows = floridaRows
          .filter((row: any) => schoolSlug((row['School Name'] || '').trim(), 'FL') === slug)
          .map((row: any, index: number) => ({
            id: String(
              row['Extraction ID']
                ? `${row['Extraction ID']}-${row['Course Code'] ?? row['Course Name'] ?? 'course'}-${index}`
                : `${slug}-${row['Course Code'] ?? row['Course Name'] ?? 'course'}-${index}`
            ),
            name: row['Course Name'] || '—',
            code: row['Course Code'] || '—',
            category: row['Category'] || '—',
            grade: row['Grade Level'] || '—',
            credit: row['Credit'] || '—',
            duration: row['Length'] || '—',
            matchType: row.mapping_logic || 'unmatched',
            matchedCode: row['Mapped Code'] && row['Mapped Code'] !== '—' ? row['Mapped Code'] : null,
            confidence: Number(row['Confidence']) || 0,
          }))
          .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
      } catch (e: any) {
        if (isSupabaseNetworkError(e)) return unavailableResponse(slug);
        if (!isTableNotFoundError(e)) {
          throw new Error(`florida_final_dump query failed: ${getErrorMessage(e)}`);
        }
      }
    }

    return NextResponse.json({ slug, total: rows.length, rows });
  } catch (error: any) {
    console.error('[/api/mine/schools/[slug]] Error:', error);
    if (isSupabaseNetworkError(error)) {
      const { slug } = await params;
      return unavailableResponse(slug);
    }
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to fetch school courses' }, { status: 500 });
  }
}
