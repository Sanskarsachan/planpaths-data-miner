import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { fetchAllRows } from '@/lib/supabase/paginate';
import {
  getErrorMessage,
  getSupabaseConnectionHint,
  isSupabaseNetworkError,
  isTableNotFoundError,
} from '@/lib/supabase/error-utils';

const unavailableResponse = () =>
  NextResponse.json(
    {
      rows: [],
      warning: getSupabaseConnectionHint(),
      connectionStatus: 'unavailable',
    },
    { status: 200 }
  );

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Paginate all extracted courses — bypasses PostgREST's 1000-row cap
    let extractedData: any[] = [];
    try {
      extractedData = await fetchAllRows(supabase, 'extractions_v2', 'id, upload_id, school_slug, course_name, course_code, category, grade_level, credits, description');
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) return unavailableResponse();
      if (!isTableNotFoundError(e)) throw new Error(`extractions_v2 query failed: ${getErrorMessage(e)}`);
    }

    // Paginate mapped course IDs to filter unmatched
    let mappingTable: any[] = [];
    try {
      mappingTable = await fetchAllRows(supabase, 'mapping_results', 'extracted_id');
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) return unavailableResponse();
      if (!isTableNotFoundError(e)) throw new Error(`mapping_results query failed: ${getErrorMessage(e)}`);
    }

    // Get schools info for display names (small table)
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('slug, name');

    if (schoolsError && !isTableNotFoundError(schoolsError)) {
      if (isSupabaseNetworkError(schoolsError)) return unavailableResponse();
      throw new Error(`schools query failed: ${getErrorMessage(schoolsError)}`);
    }

    // Build lookup maps
    const mappedIds = new Set(mappingTable.map((m: any) => m.extracted_id));
    const schoolMap = Object.fromEntries(
      (schoolsData || []).map((s: any) => [s.slug, s.name])
    );

    // Filter unmatched courses and format response
    const rows = extractedData
      .filter((e: any) => !mappedIds.has(e.id))
      .map((extracted: any, i: number) => ({
        srNo: i + 1,
        extractionId: extracted.upload_id || 'unknown',
        school: schoolMap[extracted.school_slug] || extracted.school_slug,
        code: extracted.course_code || '—',
        name: extracted.course_name,
        category: extracted.category || '—',
        grade: extracted.grade_level || '—',
        credit: extracted.credits || '—',
        desc: extracted.description || '—',
      }));

    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error('[/api/mine/extracted] Error:', error);
    if (isSupabaseNetworkError(error)) {
      return unavailableResponse();
    }
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to fetch extracted courses' }, { status: 500 });
  }
}
