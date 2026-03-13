import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

type FloridaColumnSet = {
  school: string;
  county: string;
  extractionId: string;
  logic: string;
  courseCode: string;
  courseName: string;
  category: string;
  grade: string;
  credit: string;
  description: string;
  codeMatched: string;
  revisedCode: string;
  revisedName: string;
  revisedAbb: string;
  srNo: string;
  priority: string;
  confidence: string;
  isSpacedSchema: boolean;
};

const TABLE_NAME = 'florida_final_dump';
const UNASSIGNED = 'Unassigned';
const TERMINATED = 'cpalms-terminated';
const UNMATCHED = 'unmatched';

const SNAKE_COLUMNS: FloridaColumnSet = {
  school: 'school_name',
  county: 'county',
  extractionId: 'extraction_id',
  logic: 'mapping_logic',
  courseCode: 'course_code',
  courseName: 'course_name',
  category: 'category',
  grade: 'grade_level',
  credit: 'credit',
  description: 'description',
  codeMatched: 'exact_course_code_matched',
  revisedCode: 'revised_course_code',
  revisedName: 'revised_course_name',
  revisedAbb: 'revised_course_abb_name',
  srNo: 'sr_no',
  priority: 'priority',
  confidence: 'confidence',
  isSpacedSchema: false,
};

const SPACED_COLUMNS: FloridaColumnSet = {
  school: 'School Name',
  county: 'County',
  extractionId: 'Extraction ID',
  logic: 'mapping_logic',
  courseCode: 'Course Code',
  courseName: 'Course Name',
  category: 'Category',
  grade: 'Grade Level',
  credit: 'Credit',
  description: 'Description',
  codeMatched: 'exact-course-code-matched',
  revisedCode: 'revised_course_code',
  revisedName: 'revised_course_name',
  revisedAbb: 'revised_course_abb_name',
  srNo: 'Sr No',
  priority: 'Priority',
  confidence: 'Confidence',
  isSpacedSchema: true,
};

const isTableNotFoundError = (error: unknown) => {
  const message = String((error as { message?: string })?.message || '');
  return message.includes('Could not find the table') || message.includes('does not exist');
};

const normalizeCounty = (county: string | null) => county || UNASSIGNED;
const isMatchedLogic = (logic: string | null) => logic !== UNMATCHED && logic !== TERMINATED;
const getValue = <T = any>(row: Record<string, any>, key: string): T => row[key] as T;

async function detectColumnSet(supabase: ReturnType<typeof createAdminClient>) {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').limit(1);
  if (error) {
    if (isTableNotFoundError(error)) {
      return SNAKE_COLUMNS;
    }
    throw new Error(`${TABLE_NAME} schema probe failed: ${error.message}`);
  }

  const row = data?.[0] as Record<string, any> | undefined;
  if (!row) {
    return SNAKE_COLUMNS;
  }

  return Object.prototype.hasOwnProperty.call(row, 'School Name') ? SPACED_COLUMNS : SNAKE_COLUMNS;
}

function applyScopeFilters(
  query: any,
  columns: FloridaColumnSet,
  county: string | null,
  school: string | null,
  logic: string | null,
  search: string | null
) {
  let scoped = query;

  if (school) {
    scoped = scoped.eq(columns.school, school);
  } else if (county) {
    if (county === UNASSIGNED) {
      scoped = scoped.is(columns.county, null);
    } else {
      scoped = scoped.eq(columns.county, county);
    }
  }

  if (logic && logic !== 'all') {
    scoped = scoped.eq(columns.logic, logic);
  }

  if (search && !columns.isSpacedSchema) {
    const term = search.trim();
    if (term) {
      const ilike = `%${term}%`;
      scoped = scoped.or(
        [
          `${columns.courseName}.ilike.${ilike}`,
          `${columns.courseCode}.ilike.${ilike}`,
          `${columns.revisedCode}.ilike.${ilike}`,
          `${columns.revisedName}.ilike.${ilike}`,
          `${columns.category}.ilike.${ilike}`,
          `${columns.school}.ilike.${ilike}`,
        ].join(',')
      );
    }
  }

  return scoped;
}

async function getSidebarData(
  supabase: ReturnType<typeof createAdminClient>,
  columns: FloridaColumnSet
) {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*');

  if (error) {
    if (isTableNotFoundError(error)) {
      return {
        totals: { rows: 0, counties: 0, schools: 0, matched: 0 },
        counties: [],
      };
    }
    throw new Error(`${TABLE_NAME} sidebar query failed: ${error.message}`);
  }

  const rows = (data || []) as Record<string, any>[];
  const countyMap: Record<
    string,
    {
      name: string;
      isNull: boolean;
      total: number;
      matched: number;
      schoolMap: Record<
        string,
        {
          name: string;
          extractionId: string | null;
          total: number;
          matched: number;
          logics: Record<string, number>;
        }
      >;
    }
  > = {};

  let matchedTotal = 0;
  const schoolSet = new Set<string>();

  for (const row of rows) {
    const county = normalizeCounty(getValue<string | null>(row, columns.county));
    const schoolName = getValue<string | null>(row, columns.school) || 'Unknown School';
    const logic = getValue<string | null>(row, columns.logic) || 'unknown';
    const isMatched = isMatchedLogic(getValue<string | null>(row, columns.logic));

    schoolSet.add(schoolName);
    if (isMatched) {
      matchedTotal += 1;
    }

    if (!countyMap[county]) {
      countyMap[county] = {
        name: county,
        isNull: !getValue<string | null>(row, columns.county),
        total: 0,
        matched: 0,
        schoolMap: {},
      };
    }

    countyMap[county].total += 1;
    if (isMatched) {
      countyMap[county].matched += 1;
    }

    if (!countyMap[county].schoolMap[schoolName]) {
      countyMap[county].schoolMap[schoolName] = {
        name: schoolName,
        extractionId: getValue<string | null>(row, columns.extractionId),
        total: 0,
        matched: 0,
        logics: {},
      };
    }

    const schoolNode = countyMap[county].schoolMap[schoolName];
    schoolNode.total += 1;
    if (isMatched) {
      schoolNode.matched += 1;
    }
    schoolNode.logics[logic] = (schoolNode.logics[logic] || 0) + 1;
  }

  const counties = Object.values(countyMap)
    .map(countyNode => {
      const schools = Object.values(countyNode.schoolMap)
        .map(schoolNode => ({
          ...schoolNode,
          pct: schoolNode.total > 0 ? Math.round((schoolNode.matched / schoolNode.total) * 100) : 0,
        }))
        .sort((a, b) => b.total - a.total || b.matched - a.matched);

      return {
        name: countyNode.name,
        isNull: countyNode.isNull,
        total: countyNode.total,
        matched: countyNode.matched,
        pct: countyNode.total > 0 ? Math.round((countyNode.matched / countyNode.total) * 100) : 0,
        schools,
      };
    })
    .sort((a, b) => {
      if (a.isNull !== b.isNull) {
        return a.isNull ? 1 : -1;
      }
      return b.total - a.total;
    });

  return {
    totals: {
      rows: rows.length,
      counties: counties.length,
      schools: schoolSet.size,
      matched: matchedTotal,
    },
    counties,
  };
}

async function getScopeData(
  supabase: ReturnType<typeof createAdminClient>,
  columns: FloridaColumnSet,
  county: string | null,
  school: string | null
) {
  const base = supabase.from(TABLE_NAME).select('*');
  const scoped = applyScopeFilters(base, columns, county, school, null, null);
  const { data, error } = await scoped;

  if (error) {
    if (isTableNotFoundError(error)) {
      return {
        stats: { total: 0, matched: 0, unmatched: 0, terminated: 0, noCode: 0, pct: 0 },
        logicBreakdown: [],
      };
    }
    throw new Error(`${TABLE_NAME} scope query failed: ${error.message}`);
  }

  const rows = (data || []) as Record<string, any>[];
  const total = rows.length;
  const matched = rows.filter(r => isMatchedLogic(getValue<string | null>(r, columns.logic))).length;
  const unmatched = rows.filter(r => getValue<string | null>(r, columns.logic) === UNMATCHED).length;
  const terminated = rows.filter(r => getValue<string | null>(r, columns.logic) === TERMINATED).length;
  const noCode = rows.filter(r => {
    const code = getValue<string | null>(r, columns.courseCode);
    return !code || code === '—';
  }).length;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;

  const logicMap = rows.reduce<Record<string, number>>((acc, row) => {
    const logic = getValue<string | null>(row, columns.logic) || 'unknown';
    acc[logic] = (acc[logic] || 0) + 1;
    return acc;
  }, {});

  const logicBreakdown = Object.entries(logicMap)
    .map(([logic, cnt]) => ({ logic, cnt }))
    .sort((a, b) => b.cnt - a.cnt);

  return {
    stats: { total, matched, unmatched, terminated, noCode, pct },
    logicBreakdown,
  };
}

async function getRows(
  supabase: ReturnType<typeof createAdminClient>,
  columns: FloridaColumnSet,
  county: string | null,
  school: string | null,
  logic: string | null,
  search: string | null,
  page: number,
  pageSize: number
) {
  const offset = (page - 1) * pageSize;

  if (columns.isSpacedSchema && search?.trim()) {
    const base = supabase.from(TABLE_NAME).select('*');
    const scoped = applyScopeFilters(base, columns, county, school, logic, null);
    const { data, error } = await scoped;

    if (error) {
      if (isTableNotFoundError(error)) {
        return { rows: [], total: 0, page, pageSize };
      }
      throw new Error(`${TABLE_NAME} rows query failed: ${error.message}`);
    }

    const term = search.toLowerCase();
    const filtered = (data || []).filter((row: Record<string, any>) => {
      const values = [
        getValue<string | null>(row, columns.courseName) || '',
        getValue<string | null>(row, columns.courseCode) || '',
        getValue<string | null>(row, columns.revisedCode) || '',
        getValue<string | null>(row, columns.revisedName) || '',
        getValue<string | null>(row, columns.category) || '',
        getValue<string | null>(row, columns.school) || '',
      ];
      return values.some(value => value.toLowerCase().includes(term));
    });

    const paged = filtered
      .sort((a: Record<string, any>, b: Record<string, any>) => {
        return Number(getValue<number | string>(a, columns.srNo) || 0) - Number(getValue<number | string>(b, columns.srNo) || 0);
      })
      .slice(offset, offset + pageSize);

    const rows = paged.map((row: Record<string, any>) => ({
      srNo: Number(getValue<number | string>(row, columns.srNo) || 0),
      school: getValue<string | null>(row, columns.school),
      county: getValue<string | null>(row, columns.county),
      code: getValue<string | null>(row, columns.courseCode),
      name: getValue<string | null>(row, columns.courseName) || '',
      category: getValue<string | null>(row, columns.category),
      grade: getValue<string | null>(row, columns.grade),
      credit: getValue<string | null>(row, columns.credit),
      desc: getValue<string | null>(row, columns.description),
      mappingLogic: getValue<string | null>(row, columns.logic) || 'unknown',
      codeMatched: getValue<string | null>(row, columns.codeMatched),
      revisedCode: getValue<string | null>(row, columns.revisedCode),
      revisedName: getValue<string | null>(row, columns.revisedName),
      revisedAbb: getValue<string | null>(row, columns.revisedAbb),
      confidence: Number(getValue<number | string>(row, columns.confidence) || 0),
      priority: getValue<number | null>(row, columns.priority),
      extractionId: getValue<string | null>(row, columns.extractionId),
    }));

    return {
      rows,
      total: filtered.length,
      page,
      pageSize,
    };
  }

  const base = supabase
    .from(TABLE_NAME)
    .select('*', { count: 'exact' })
    .order(columns.srNo, { ascending: true })
    .range(offset, offset + pageSize - 1);

  const scoped = applyScopeFilters(base, columns, county, school, logic, search);
  const { data, error, count } = await scoped;

  if (error) {
    if (isTableNotFoundError(error)) {
      return { rows: [], total: 0, page, pageSize };
    }
    throw new Error(`${TABLE_NAME} rows query failed: ${error.message}`);
  }

  const rows = (data || []).map((row: Record<string, any>) => ({
    srNo: Number(getValue<number | string>(row, columns.srNo) || 0),
    school: getValue<string | null>(row, columns.school),
    county: getValue<string | null>(row, columns.county),
    code: getValue<string | null>(row, columns.courseCode),
    name: getValue<string | null>(row, columns.courseName) || '',
    category: getValue<string | null>(row, columns.category),
    grade: getValue<string | null>(row, columns.grade),
    credit: getValue<string | null>(row, columns.credit),
    desc: getValue<string | null>(row, columns.description),
    mappingLogic: getValue<string | null>(row, columns.logic) || 'unknown',
    codeMatched: getValue<string | null>(row, columns.codeMatched),
    revisedCode: getValue<string | null>(row, columns.revisedCode),
    revisedName: getValue<string | null>(row, columns.revisedName),
    revisedAbb: getValue<string | null>(row, columns.revisedAbb),
    confidence: Number(getValue<number | string>(row, columns.confidence) || 0),
    priority: getValue<number | null>(row, columns.priority),
    extractionId: getValue<string | null>(row, columns.extractionId),
  }));

  return {
    rows,
    total: count || 0,
    page,
    pageSize,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const columns = await detectColumnSet(supabase);
    const { searchParams } = new URL(request.url);

    const mode = searchParams.get('mode') || 'sidebar';
    const county = searchParams.get('county');
    const school = searchParams.get('school');
    const logic = searchParams.get('logic');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') || 1);
    const pageSize = Number(searchParams.get('pageSize') || 200);

    if (mode === 'sidebar') {
      const payload = await getSidebarData(supabase, columns);
      return NextResponse.json(payload);
    }

    if (mode === 'scope') {
      const payload = await getScopeData(supabase, columns, county, school);
      return NextResponse.json(payload);
    }

    if (mode === 'rows') {
      const payload = await getRows(supabase, columns, county, school, logic, search, page, pageSize);
      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: `Unsupported mode: ${mode}` }, { status: 400 });
  } catch (error: any) {
    console.error('[/api/mine/florida] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch Florida data' }, { status: 500 });
  }
}
