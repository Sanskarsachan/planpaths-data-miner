import { Fragment, useEffect, useMemo, useState } from 'react';

type SidebarSchool = {
  name: string;
  extractionId: string | null;
  total: number;
  matched: number;
  pct: number;
  logics: Record<string, number>;
};

type SidebarCounty = {
  name: string;
  isNull: boolean;
  total: number;
  matched: number;
  pct: number;
  schools: SidebarSchool[];
};

type ScopeStats = {
  total: number;
  matched: number;
  unmatched: number;
  terminated: number;
  noCode: number;
  pct: number;
};

type BreakdownItem = {
  logic: string;
  cnt: number;
};

type FloridaRow = {
  srNo: number;
  school: string;
  county: string | null;
  code: string | null;
  name: string;
  category: string | null;
  grade: string | null;
  credit: string | null;
  desc: string | null;
  mappingLogic: string;
  codeMatched: string | null;
  revisedCode: string | null;
  revisedName: string | null;
  revisedAbb: string | null;
  confidence: number;
  priority: number | null;
  extractionId: string | null;
};

const PAGE_SIZE = 200;
const UNASSIGNED = 'Unassigned';
const MONO = { fontFamily: "'DM Mono',monospace" };

const LOGIC: Record<
  string,
  { color: string; bg: string; label: string; short: string; matched: boolean; rank: number }
> = {
  'exact-course-code': {
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.12)',
    label: 'Code Match',
    short: 'CODE',
    matched: true,
    rank: 1,
  },
  'exact-course-name': {
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    label: 'Name Match',
    short: 'NAME',
    matched: true,
    rank: 2,
  },
  'exact-course-name-sorted-word-match': {
    color: '#67e8f9',
    bg: 'rgba(103,232,249,0.12)',
    label: 'Sorted Word',
    short: 'SORT',
    matched: true,
    rank: 3,
  },
  'exact-course-name-ap-transformation': {
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    label: 'AP Transform',
    short: 'AP',
    matched: true,
    rank: 4,
  },
  'exact-8char-course-code-remove-last-match': {
    color: '#c084fc',
    bg: 'rgba(192,132,252,0.12)',
    label: '8-char Trim',
    short: '8CHR',
    matched: true,
    rank: 5,
  },
  'cpalms-terminated': {
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
    label: 'CPALMS Retired',
    short: 'TERM',
    matched: false,
    rank: 6,
  },
  unmatched: {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.12)',
    label: 'Unmatched',
    short: 'NONE',
    matched: false,
    rank: 7,
  },
};

const lcfg = (logic: string) =>
  LOGIC[logic] || {
    color: '#6b7280',
    bg: 'rgba(107,114,128,0.1)',
    label: logic,
    short: '?',
    matched: false,
    rank: 99,
  };

const normCounty = (county: string | null) => county || UNASSIGNED;

export function FloridaDBSection() {
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selCounty, setSelCounty] = useState<string | null>(null);
  const [selSchool, setSelSchool] = useState<string | null>(null);
  const [logicFilter, setLogicFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<'table' | 'breakdown'>('table');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(1);

  const [totals, setTotals] = useState({ rows: 0, counties: 0, schools: 0, matched: 0 });
  const [counties, setCounties] = useState<SidebarCounty[]>([]);
  const [stats, setStats] = useState<ScopeStats>({
    total: 0,
    matched: 0,
    unmatched: 0,
    terminated: 0,
    noCode: 0,
    pct: 0,
  });
  const [logicBreakdown, setLogicBreakdown] = useState<BreakdownItem[]>([]);
  const [rows, setRows] = useState<FloridaRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);

  useEffect(() => {
    const loadSidebar = async () => {
      try {
        setSidebarLoading(true);
        const response = await fetch('/api/mine/florida?mode=sidebar', { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok || json.error) {
          throw new Error(json.error || 'Failed to load florida sidebar');
        }

        setTotals(json.totals || { rows: 0, counties: 0, schools: 0, matched: 0 });
        setCounties(json.counties || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load florida sidebar');
      } finally {
        setSidebarLoading(false);
      }
    };

    loadSidebar();
  }, []);

  useEffect(() => {
    const loadScope = async () => {
      try {
        setScopeLoading(true);
        const params = new URLSearchParams({ mode: 'scope' });
        if (selCounty) params.set('county', selCounty);
        if (selSchool) params.set('school', selSchool);

        const response = await fetch(`/api/mine/florida?${params.toString()}`, { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok || json.error) {
          throw new Error(json.error || 'Failed to load florida scope');
        }

        setStats(json.stats || { total: 0, matched: 0, unmatched: 0, terminated: 0, noCode: 0, pct: 0 });
        const sorted = (json.logicBreakdown || []).sort(
          (a: BreakdownItem, b: BreakdownItem) => lcfg(a.logic).rank - lcfg(b.logic).rank
        );
        setLogicBreakdown(sorted);
      } catch (err: any) {
        setError(err.message || 'Failed to load florida scope');
      } finally {
        setScopeLoading(false);
      }
    };

    loadScope();
  }, [selCounty, selSchool]);

  useEffect(() => {
    const loadRows = async () => {
      try {
        setRowsLoading(true);
        const params = new URLSearchParams({
          mode: 'rows',
          page: String(page),
          pageSize: String(PAGE_SIZE),
          logic: logicFilter,
        });

        if (selCounty) params.set('county', selCounty);
        if (selSchool) params.set('school', selSchool);
        if (search.trim()) params.set('search', search.trim());

        const response = await fetch(`/api/mine/florida?${params.toString()}`, { cache: 'no-store' });
        const json = await response.json();

        if (!response.ok || json.error) {
          throw new Error(json.error || 'Failed to load florida rows');
        }

        setRows(json.rows || []);
        setRowsTotal(json.total || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to load florida rows');
      } finally {
        setRowsLoading(false);
      }
    };

    loadRows();
  }, [selCounty, selSchool, logicFilter, search, page]);

  const go = (county: string | null, school?: string | null) => {
    setSelCounty(county);
    setSelSchool(school || null);
    setLogicFilter('all');
    setSearch('');
    setExpandedRow(null);
    setPage(1);

    if (county) {
      setExpanded(prev => ({ ...prev, [county]: true }));
    }
  };

  const scopeLabel = selSchool
    ? selSchool
    : selCounty
      ? `${selCounty}${selCounty === UNASSIGNED ? '' : ' County'}`
      : 'All Florida Schools';

  const allSchools = useMemo(() => counties.flatMap(c => c.schools), [counties]);
  const schoolsInScope = useMemo(() => {
    if (selSchool) return [];
    if (selCounty) {
      return counties.find(c => c.name === selCounty)?.schools || [];
    }
    return allSchools;
  }, [allSchools, counties, selCounty, selSchool]);

  const totalPages = Math.max(1, Math.ceil(rowsTotal / PAGE_SIZE));

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#f87171',
          background: '#0d0b14',
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        background: '#0d0b14',
        color: '#e2e0ea',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:2px}
        button,input{font-family:inherit}
      `}</style>

      <div
        style={{
          width: 248,
          flexShrink: 0,
          background: '#110e1c',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '13px 14px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.2 }}>
            FLORIDA DB
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', ...MONO, marginTop: 2 }}>
            public.florida_final_dump
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            {[
              [totals.rows, 'rows'],
              [totals.counties, 'counties'],
              [totals.schools, 'schools'],
            ].map(([value, label]) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 6,
                  padding: '5px 0',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', ...MONO }}>{value}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => go(null)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 14px',
            border: 'none',
            textAlign: 'left',
            borderLeft: !selCounty ? '2px solid #603AC8' : '2px solid transparent',
            background: !selCounty ? 'rgba(96,58,200,0.1)' : 'transparent',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: !selCounty ? '#c4b5fd' : 'rgba(255,255,255,0.55)' }}>
              All Counties
            </div>
            <div style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
              {totals.counties} counties | {totals.rows} courses
            </div>
          </div>
          <Pill pct={totals.rows ? Math.round((totals.matched / totals.rows) * 100) : 0} />
        </button>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarLoading && (
            <div style={{ padding: 12, fontSize: 10, ...MONO, color: 'rgba(255,255,255,0.3)' }}>
              Loading counties...
            </div>
          )}
          {!sidebarLoading &&
            counties.map(county => {
              const countyActive = selCounty === county.name && !selSchool;
              const isOpen = expanded[county.name];
              return (
                <div key={county.name}>
                  <div style={{ display: 'flex' }}>
                    <button
                      onClick={() => go(county.name)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '9px 14px',
                        border: 'none',
                        textAlign: 'left',
                        borderLeft: countyActive ? '2px solid #603AC8' : '2px solid transparent',
                        background: countyActive ? 'rgba(96,58,200,0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: countyActive ? 600 : 400,
                              color: countyActive ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {county.isNull ? `Unassigned` : `${county.name} County`}
                          </span>
                          <Pill pct={county.pct} small />
                        </div>
                        <div style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                          {county.schools.length} schools | {county.total} courses
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [county.name]: !prev[county.name] }))}
                      style={{
                        width: 22,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.25)',
                        fontSize: 9,
                      }}
                    >
                      {isOpen ? 'v' : '>'}
                    </button>
                  </div>

                  {isOpen &&
                    county.schools.map(school => {
                      const schoolActive = selSchool === school.name;
                      const entries = Object.entries(school.logics).sort(
                        (a, b) => lcfg(a[0]).rank - lcfg(b[0]).rank
                      );

                      return (
                        <button
                          key={school.name}
                          onClick={() => go(county.name, school.name)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'flex-start',
                            padding: '8px 14px 8px 28px',
                            border: 'none',
                            textAlign: 'left',
                            borderLeft: schoolActive ? '2px solid #a78bfa' : '2px solid rgba(255,255,255,0.04)',
                            background: schoolActive ? 'rgba(167,139,250,0.09)' : 'rgba(255,255,255,0.01)',
                            borderBottom: '1px solid rgba(255,255,255,0.02)',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: schoolActive ? 600 : 400,
                                  color: schoolActive ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {school.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 9,
                                  ...MONO,
                                  color: school.pct >= 90 ? '#4ade80' : school.pct >= 70 ? '#67e8f9' : '#f87171',
                                  flexShrink: 0,
                                }}
                              >
                                {school.pct}%
                              </span>
                            </div>
                            <div
                              style={{
                                marginTop: 5,
                                display: 'flex',
                                height: 4,
                                borderRadius: 2,
                                overflow: 'hidden',
                                gap: '1px',
                                background: 'rgba(255,255,255,0.04)',
                              }}
                            >
                              {entries.map(([logic, count]) => (
                                <div key={logic} title={`${logic}: ${count}`} style={{ flex: count, background: lcfg(logic).color, opacity: 0.82 }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 8, ...MONO, color: 'rgba(255,255,255,0.2)', marginTop: 3 }}>
                              {school.total} courses
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              );
            })}
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
            <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.3)' }}>Supabase | public</span>
          </div>
          <div style={{ fontSize: 9, ...MONO, color: '#a78bfa', marginTop: 4 }}>florida_final_dump</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            padding: '11px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: '#0f0c1a',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, ...MONO, fontSize: 9, color: 'rgba(255,255,255,0.2)', marginBottom: 3 }}>
              <span>florida_final_dump</span>
              {selCounty && (
                <Fragment>
                  <span>{'>'}</span>
                  <span style={{ color: '#a78bfa' }}>{selCounty === UNASSIGNED ? UNASSIGNED : `${selCounty} County`}</span>
                </Fragment>
              )}
              {selSchool && (
                <Fragment>
                  <span>{'>'}</span>
                  <span style={{ color: '#c4b5fd' }}>{selSchool}</span>
                </Fragment>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scopeLabel}
            </div>
          </div>

          {[
            { l: 'Total', v: stats.total, c: '#a78bfa' },
            { l: 'Matched', v: stats.matched, c: '#4ade80' },
            { l: 'Unmatched', v: stats.unmatched, c: '#f87171' },
            { l: 'Retired', v: stats.terminated, c: '#fb923c' },
            { l: 'No Code', v: stats.noCode, c: '#94a3b8' },
            {
              l: 'Rate',
              v: `${stats.pct}%`,
              c: stats.pct >= 90 ? '#4ade80' : stats.pct >= 70 ? '#67e8f9' : '#fbbf24',
            },
          ].map(stat => (
            <div key={stat.l} style={{ textAlign: 'center', padding: '0 10px', borderLeft: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: stat.c, ...MONO, lineHeight: 1 }}>{stat.v}</div>
              <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.28)', marginTop: 3, letterSpacing: 0.5 }}>
                {stat.l.toUpperCase()}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 3 }}>
            {[
              ['table', 'Table'],
              ['breakdown', 'Breakdown'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setView(id as 'table' | 'breakdown')}
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: view === id ? 'rgba(96,58,200,0.4)' : 'transparent',
                  color: view === id ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                  fontSize: 11,
                  fontWeight: view === id ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>search</span>
            <input
              value={search}
              onChange={event => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="course, code, category"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#e2e0ea', fontSize: 12, width: 170, ...MONO }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 0 }}>
                x
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '6px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.01)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setLogicFilter('all');
              setPage(1);
            }}
            style={{
              padding: '3px 10px',
              borderRadius: 5,
              border: '1px solid',
              borderColor: logicFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
              background: logicFilter === 'all' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: logicFilter === 'all' ? '#fff' : 'rgba(255,255,255,0.35)',
              fontSize: 10,
              ...MONO,
              fontWeight: 600,
            }}
          >
            ALL <span style={{ opacity: 0.5 }}>{stats.total}</span>
          </button>

          {logicBreakdown.map(item => {
            const cfg = lcfg(item.logic);
            const active = logicFilter === item.logic;
            return (
              <button
                key={item.logic}
                onClick={() => {
                  setLogicFilter(active ? 'all' : item.logic);
                  setPage(1);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 5,
                  border: '1px solid',
                  borderColor: active ? `${cfg.color}55` : 'rgba(255,255,255,0.06)',
                  background: active ? cfg.bg : 'transparent',
                  color: active ? cfg.color : 'rgba(255,255,255,0.35)',
                  fontSize: 10,
                  ...MONO,
                  fontWeight: active ? 700 : 400,
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                {cfg.short} <span style={{ opacity: 0.6 }}>{item.cnt}</span>
              </button>
            );
          })}

          <div style={{ marginLeft: 'auto', fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.2)' }}>
            {rowsTotal} rows
            {rowsLoading && ' | loading...'}
            {scopeLoading && ' | updating scope...'}
          </div>
        </div>

        {view === 'table' && (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr style={{ background: '#14101f', borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                  {['#', 'ORIG CODE', 'COURSE NAME', 'CATEGORY', 'GRADE', 'CREDIT', 'MAPPING LOGIC', 'CODE', 'REVISED CODE', 'RESOLVED NAME', 'CONF'].map((header, index) => (
                    <th
                      key={header}
                      style={{
                        padding: '9px 11px',
                        textAlign: index >= 10 ? 'right' : 'left',
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.28)',
                        ...MONO,
                        letterSpacing: 0.8,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!rowsLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ padding: 48, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                      No courses match your filter
                    </td>
                  </tr>
                )}

                {rows.map((row, index) => {
                  const cfg = lcfg(row.mappingLogic);
                  const isExpanded = expandedRow === row.srNo;
                  const resolved = Boolean(row.revisedCode);
                  const hasDesc = row.desc && row.desc !== '—';
                  return (
                    <Fragment key={row.srNo}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : row.srNo)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          background: isExpanded ? 'rgba(96,58,200,0.06)' : index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.007)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '9px 11px', ...MONO, fontSize: 9, color: 'rgba(255,255,255,0.18)' }}>{row.srNo}</td>
                        <td style={{ padding: '9px 11px', ...MONO, fontSize: 10, fontWeight: 600, color: row.code ? '#fbbf24' : 'rgba(255,255,255,0.18)' }}>
                          {row.code || <span style={{ opacity: 0.3 }}>-</span>}
                        </td>
                        <td style={{ padding: '9px 11px', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }} title={row.name}>
                          {row.name}
                        </td>
                        <td style={{ padding: '9px 11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>
                          <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.38)' }} title={row.category || ''}>
                            {row.category || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 11px', ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{row.grade || '-'}</td>
                        <td style={{ padding: '9px 11px', ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{row.credit || '-'}</td>
                        <td style={{ padding: '9px 11px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: cfg.bg, color: cfg.color, ...MONO, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {cfg.label}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 11px', textAlign: 'center', fontSize: 12, color: row.codeMatched === 'yes' ? '#4ade80' : 'rgba(255,255,255,0.15)' }}>
                          {row.codeMatched === 'yes' ? 'y' : '-'}
                        </td>
                        <td style={{ padding: '9px 11px', ...MONO, fontSize: 10, fontWeight: 600, color: resolved ? '#4ade80' : 'rgba(255,255,255,0.18)' }}>
                          {resolved ? row.revisedCode : <span style={{ opacity: 0.3 }}>-</span>}
                        </td>
                        <td style={{ padding: '9px 11px', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0, color: resolved ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.2)' }} title={row.revisedName || ''}>
                          {row.revisedName ? (
                            <>
                              <span style={{ fontSize: 8, ...MONO, color: cfg.color, marginRight: 5, opacity: 0.75 }}>{row.revisedAbb}</span>
                              {row.revisedName}
                            </>
                          ) : (
                            <span style={{ opacity: 0.3 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 11px', textAlign: 'right' }}>
                          {row.confidence > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <div style={{ width: 30, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                <div
                                  style={{
                                    height: '100%',
                                    borderRadius: 2,
                                    width: `${row.confidence * 100}%`,
                                    background: row.confidence >= 0.95 ? '#4ade80' : row.confidence >= 0.85 ? '#67e8f9' : '#fbbf24',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.5)' }}>{Math.round(row.confidence * 100)}%</span>
                            </div>
                          ) : (
                            <span style={{ ...MONO, fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>-</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr style={{ background: 'rgba(96,58,200,0.04)', borderBottom: '1px solid rgba(96,58,200,0.18)' }}>
                          <td colSpan={11} style={{ padding: '0 0 0 44px' }}>
                            <div style={{ padding: '12px 18px 14px 0', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                              <div style={{ flex: 2, minWidth: 200 }}>
                                <div style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.22)', marginBottom: 5, letterSpacing: 0.8 }}>
                                  DESCRIPTION
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)', lineHeight: 1.65 }}>
                                  {hasDesc ? row.desc : <em style={{ opacity: 0.4 }}>No description in source</em>}
                                </div>
                              </div>
                              <div style={{ flex: 1, minWidth: 210 }}>
                                <div style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.22)', marginBottom: 7, letterSpacing: 0.8 }}>
                                  MAPPING DETAIL
                                </div>
                                {[
                                  ['extraction_id', row.extractionId],
                                  ['school_name', row.school],
                                  ['county', normCounty(row.county)],
                                  ['mapping_logic', row.mappingLogic],
                                  ['code_matched', row.codeMatched],
                                  ['revised_code', row.revisedCode || 'null'],
                                  ['revised_abb', row.revisedAbb || 'null'],
                                  ['priority', row.priority != null ? String(row.priority) : 'null'],
                                ].map(([key, value]) => (
                                  <div key={key} style={{ display: 'flex', gap: 10, marginBottom: 4, alignItems: 'baseline' }}>
                                    <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.22)', minWidth: 118, flexShrink: 0 }}>{key}</span>
                                    <span style={{ fontSize: 10, ...MONO, color: 'rgba(255,255,255,0.6)', wordBreak: 'break-all' }}>{value || 'null'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>

            <div style={{ padding: '8px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
              <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.2)' }}>
                {rowsTotal} rows | public.florida_final_dump
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page <= 1}
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: page <= 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 10,
                    ...MONO,
                  }}
                >
                  Prev
                </button>
                <span style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.22)' }}>
                  page {page}/{totalPages}
                </span>
                <button
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages}
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: page >= totalPages ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)',
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: 10,
                    ...MONO,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'breakdown' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                {
                  l: 'Match Rate',
                  v: `${stats.pct}%`,
                  sub: `${stats.matched} of ${stats.total} resolved`,
                  c: stats.pct >= 90 ? '#4ade80' : stats.pct >= 70 ? '#67e8f9' : '#fbbf24',
                },
                {
                  l: 'Need Review',
                  v: stats.unmatched + stats.terminated,
                  sub: `${stats.unmatched} unmatched | ${stats.terminated} CPALMS retired`,
                  c: '#f87171',
                },
                {
                  l: 'No Original Code',
                  v: stats.noCode,
                  sub: `${stats.total ? Math.round((stats.noCode / stats.total) * 100) : 0}% have blank source code`,
                  c: '#94a3b8',
                },
              ].map(card => (
                <div key={card.l} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px', borderTop: `2px solid ${card.c}` }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: card.c, ...MONO, lineHeight: 1 }}>{card.v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 5, fontWeight: 600 }}>{card.l}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', ...MONO, marginTop: 2 }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Logic Distribution</div>
                <div style={{ fontSize: 10, ...MONO, color: 'rgba(255,255,255,0.25)' }}>{scopeLabel}</div>
              </div>

              {logicBreakdown.map(item => {
                const cfg = lcfg(item.logic);
                const pct = stats.total ? Math.round((item.cnt / stats.total) * 100) : 0;
                return (
                  <div key={item.logic} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                    <div style={{ width: 175, flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: cfg.color, ...MONO, fontWeight: 600 }}>{cfg.label}</div>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)', ...MONO, marginTop: 1 }}>
                        {cfg.matched ? 'contributes to match rate' : 'needs review'}
                      </div>
                    </div>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: cfg.color, opacity: 0.75 }} />
                    </div>
                    <div style={{ width: 28, textAlign: 'right', fontSize: 12, ...MONO, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{item.cnt}</div>
                    <div style={{ width: 34, textAlign: 'right', fontSize: 10, ...MONO, color: 'rgba(255,255,255,0.3)' }}>{pct}%</div>
                  </div>
                );
              })}
            </div>

            {!selSchool && schoolsInScope.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                  School-Level Breakdown
                </div>
                {schoolsInScope.map((school, index) => {
                  return (
                    <div key={`${school.name}-${index}`} style={{ padding: '12px 18px', borderBottom: index < schoolsInScope.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e0ea' }}>{school.name}</div>
                          <div style={{ fontSize: 9, ...MONO, color: 'rgba(255,255,255,0.22)', marginTop: 1 }}>{school.extractionId}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, ...MONO, color: school.pct >= 90 ? '#4ade80' : school.pct >= 70 ? '#67e8f9' : '#f87171' }}>
                            {school.pct}%
                          </div>
                          <div style={{ fontSize: 8, ...MONO, color: 'rgba(255,255,255,0.2)' }}>{school.matched}/{school.total}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Pill({ pct, small }: { pct: number; small?: boolean }) {
  const color = pct >= 90 ? '#4ade80' : pct >= 70 ? '#67e8f9' : '#f87171';
  return (
    <span
      style={{
        fontSize: small ? 8 : 9,
        fontFamily: "'DM Mono',monospace",
        padding: '1px 5px',
        borderRadius: 3,
        background: `${color}18`,
        color,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {pct}%
    </span>
  );
}
