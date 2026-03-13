import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/paginate';

const PREVIEW_LIMIT = 200;
const BREAKDOWN_CACHE_TTL_MS = 5 * 60 * 1000;

let breakdownCache: {
  expiresAt: number;
  totalRows: number;
  data: Record<string, number>;
} | null = null;

const isTableNotFoundError = (error: any) =>
  error?.message?.includes('Could not find the table') ||
  error?.message?.includes('does not exist');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeRows = searchParams.get('includeRows') !== '0';
    const includeBreakdown = searchParams.get('includeBreakdown') === '1';
    const supabase = createAdminClient();

    // ── 1. Total row count (HEAD only — zero data transfer) ──────────────────
    let totalRows = 0;
    try {
      const { count } = await supabase
        .from('mapping_results')
        .select('*', { count: 'exact', head: true });
      totalRows = count ?? 0;
    } catch (e: any) {
      if (!isTableNotFoundError(e)) throw new Error(`mapping count failed: ${e.message}`);
    }

    // ── 2. Match-type breakdown (optional, cached) ─────────────────────────────
    let matchBreakdown: Record<string, number> = {};
    if (includeBreakdown) {
      const now = Date.now();
      if (breakdownCache && breakdownCache.expiresAt > now && breakdownCache.totalRows === totalRows) {
        matchBreakdown = breakdownCache.data;
      } else {
        try {
          const allTypes = await fetchAllRows<{ match_type: string }>(supabase, 'mapping_results', 'match_type');
          for (const { match_type } of allTypes) {
            matchBreakdown[match_type] = (matchBreakdown[match_type] ?? 0) + 1;
          }
          breakdownCache = {
            expiresAt: now + BREAKDOWN_CACHE_TTL_MS,
            totalRows,
            data: matchBreakdown,
          };
        } catch (e: any) {
          if (!isTableNotFoundError(e)) console.warn('[mapping] breakdown fetch skipped:', e.message);
        }
      }
    }

    // ── 3. Preview rows (optional, first PREVIEW_LIMIT only) ──────────────────
    let previewMapping: any[] = [];
    if (includeRows) {
      try {
        const { data, error } = await supabase
          .from('mapping_results')
          .select('id, extracted_id, match_type, matched_code, confidence, review_status')
          .range(0, PREVIEW_LIMIT - 1);
        if (error && !isTableNotFoundError(error)) throw error;
        previewMapping = data ?? [];
      } catch (e: any) {
        if (!isTableNotFoundError(e)) throw new Error(`mapping preview failed: ${e.message}`);
      }
    }

    // ── 4. Resolve extraction + school names for preview rows only ────────────
    const previewExtIds = previewMapping.map((m: any) => m.extracted_id).filter(Boolean);
    let extractedData: any[] = [];
    if (previewExtIds.length > 0) {
      try {
        const { data, error } = await supabase
          .from('extractions_v2')
          .select('id, school_slug, course_name')
          .in('id', previewExtIds);
        if (error && !isTableNotFoundError(error)) throw error;
        extractedData = data ?? [];
      } catch (e: any) {
        if (!isTableNotFoundError(e)) console.warn('[mapping] extraction lookup skipped:', e.message);
      }
    }

    const { data: schoolsData } = includeRows
      ? await supabase.from('schools').select('slug, name')
      : { data: [] as any[] };
    const extractedMap = Object.fromEntries(
      extractedData.map((e: any) => [e.id, { school_slug: e.school_slug, course_name: e.course_name }])
    );
    const schoolMap = Object.fromEntries(
      (schoolsData ?? []).map((s: any) => [s.slug, s.name])
    );

    const rows = previewMapping.map((mapping: any) => {
      const extracted = extractedMap[mapping.extracted_id];
      const schoolName = extracted ? (schoolMap[extracted.school_slug] ?? extracted.school_slug) : 'unknown';
      return {
        id: mapping.id,
        school: schoolName,
        course: extracted?.course_name ?? 'Unknown',
        code: mapping.matched_code ?? '—',
        matchType: mapping.match_type,
        conf: mapping.confidence ?? 0,
        status: mapping.review_status ?? 'auto',
      };
    });

    return NextResponse.json({ rows, totalRows, matchBreakdown });
  } catch (error: any) {
    console.error('[/api/mine/mapping] Error:', error);
    return NextResponse.json({ error: error.message ?? 'Failed to fetch mapping results' }, { status: 500 });
  }
}
