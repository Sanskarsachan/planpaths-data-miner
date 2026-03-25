import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { schoolSlug } from '@/utils/slugify';
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
      schools: [],
      warning: getSupabaseConnectionHint(),
      connectionStatus: 'unavailable',
    },
    { status: 200 }
  );

const isMatchedLogic = (logic: string | null | undefined) =>
  logic !== 'unmatched' && logic !== 'cpalms-terminated';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Fetch all schools (schools table is small, direct query is fine)
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (schoolsError) {
      if (isTableNotFoundError(schoolsError)) {
        // Allow fallback below.
      } else if (isSupabaseNetworkError(schoolsError)) {
        return unavailableResponse();
      } else {
        throw new Error(`schools query failed: ${getErrorMessage(schoolsError)}`);
      }
    }

    // Fallback path: derive schools directly from florida_final_dump if schools table is empty.
    if ((schoolsData || []).length === 0) {
      let floridaData: any[] = [];
      try {
        floridaData = await fetchAllRows(
          supabase,
          'florida_final_dump',
          '"School Name", "County", mapping_logic'
        );
      } catch (e: any) {
        if (isSupabaseNetworkError(e)) return unavailableResponse();
        if (!isTableNotFoundError(e)) throw new Error(`florida_final_dump query failed: ${getErrorMessage(e)}`);
      }

      const schoolMap: Record<
        string,
        { name: string; county: string; total: number; matched: number }
      > = {};

      for (const row of floridaData) {
        const schoolName = row.school_name || row['School Name'] || 'Unknown School';
        const county = row.county || row.County || 'Unassigned';
        const mappingLogic = row.mapping_logic || row['mapping_logic'] || null;

        if (!schoolMap[schoolName]) {
          schoolMap[schoolName] = {
            name: schoolName,
            county,
            total: 0,
            matched: 0,
          };
        }

        schoolMap[schoolName].total += 1;
        if (isMatchedLogic(mappingLogic)) {
          schoolMap[schoolName].matched += 1;
        }
      }

      const schools = Object.values(schoolMap)
        .map((school, index) => {
          const unmatched = Math.max(school.total - school.matched, 0);
          const pct = school.total > 0 ? Math.round((school.matched / school.total) * 100) : 0;
          return {
            id: `fl-${index + 1}`,
            slug: schoolSlug(school.name, 'FL'),
            name: school.name,
            city: school.county,
            state: 'FL',
            courses: school.total,
            mapped: school.matched,
            unmatched,
            pct,
          };
        })
        .sort((a, b) => b.courses - a.courses || a.name.localeCompare(b.name));

      return NextResponse.json({ schools });
    }

    // Preferred path: build from schools + extraction + mapping tables.
    let extractionsTable: any[] = [];
    try {
      extractionsTable = await fetchAllRows(supabase, 'extractions_v2', 'id, school_slug');
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) return unavailableResponse();
      if (!isTableNotFoundError(e)) throw new Error(`extractions_v2 query failed: ${getErrorMessage(e)}`);
    }

    let mappingTable: any[] = [];
    try {
      mappingTable = await fetchAllRows(supabase, 'mapping_results', 'extracted_id, match_type');
    } catch (e: any) {
      if (isSupabaseNetworkError(e)) return unavailableResponse();
      if (!isTableNotFoundError(e)) throw new Error(`mapping_results query failed: ${getErrorMessage(e)}`);
    }

    const mappedExtractedIds = new Set(
      mappingTable
        .filter((m: any) => isMatchedLogic(m.match_type))
        .map((m: any) => m.extracted_id)
    );

    const schoolExtractionMap: Record<string, string[]> = {};
    for (const extraction of extractionsTable) {
      if (!schoolExtractionMap[extraction.school_slug]) {
        schoolExtractionMap[extraction.school_slug] = [];
      }
      schoolExtractionMap[extraction.school_slug].push(extraction.id);
    }

    const schools = (schoolsData || []).map((school: any) => {
      const extractedIds = schoolExtractionMap[school.slug] || [];
      const totalCourses = extractedIds.length;
      const mapped = extractedIds.filter(id => mappedExtractedIds.has(id)).length;
      const unmatched = Math.max(totalCourses - mapped, 0);
      const pct = totalCourses > 0 ? Math.round((mapped / totalCourses) * 100) : 0;

      return {
        id: school.id,
        slug: school.slug,
        name: school.name,
        city: school.city || '',
        state: school.state_code || 'FL',
        courses: totalCourses,
        mapped,
        unmatched,
        pct,
      };
    });

    return NextResponse.json({ schools });
  } catch (error: any) {
    console.error('[/api/mine/schools] Error:', error);
    if (isSupabaseNetworkError(error)) {
      return unavailableResponse();
    }
    return NextResponse.json({ error: getErrorMessage(error) || 'Failed to fetch schools' }, { status: 500 });
  }
}
