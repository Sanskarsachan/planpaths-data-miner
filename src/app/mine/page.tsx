'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { FloridaDBSection } from '@/components/FloridaDBSection';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Database,
  FolderKanban,
  Link2,
  Network,
  School,
  Send,
  Table2,
  X,
  Search,
  Type,
} from 'lucide-react';

// ─── DATA TYPES ─────────────────────────────────────────────────────────────
interface School {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  courses: number;
  mapped: number;
  unmatched: number;
  pct: number;
}

interface MappingRow {
  id: string;
  school: string;
  course: string;
  code: string;
  matchType: string;
  conf: number;
  status: string;
}

// ─── MATCH CONFIDENCE CONFIG ─────────────────────────────────────────────
const MATCH_CONF = {
  "exact-course-code": { color: '#4ade80', bg: 'rgba(22,163,74,0.15)', label: 'Code Exact' },
  "exact-course-name": { color: '#34d399', bg: 'rgba(16,185,129,0.12)', label: 'Name Exact' },
  "exact-course-abb-name": { color: '#67e8f9', bg: 'rgba(8,145,178,0.12)', label: 'Abbrev Match' },
  "exact-roman-course-name": { color: '#a78bfa', bg: 'rgba(96,58,200,0.15)', label: 'Roman Norm' },
  "synonym": { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: 'Synonym' },
  "unmatched": { color: '#f87171', bg: 'rgba(239,68,68,0.12)', label: 'Unmatched' },
} as const;

const DB_TABLES = [
  {
    name: 'schools',
    color: '#603AC8',
    rows: 0,
    desc: 'One row per school. Slug is the stable identifier across all joins.',
    cols: [
      { n: 'id', uuid: true },
      { n: 'slug', pk: true },
      { n: 'name' },
      { n: 'city' },
      { n: 'state_code', fk: 'states' },
      { n: 'created_at' },
    ],
  },
  {
    name: 'uploads',
    color: '#0891b2',
    rows: 0,
    desc: 'Each PDF extraction job. Tracks status, course count, processing time.',
    cols: [
      { n: 'id', uuid: true },
      { n: 'school_id', fk: 'schools' },
      { n: 'school_slug' },
      { n: 'filename' },
      { n: 'state_code', fk: 'states' },
      { n: 'status' },
      { n: 'total_chunks' },
      { n: 'courses_found' },
      { n: 'dupes_removed' },
      { n: 'processing_ms' },
      { n: 'uploaded_at' },
    ],
  },
  {
    name: 'extractions_v2',
    color: '#059669',
    rows: 0,
    desc: 'Raw AI-extracted courses. One row per course per upload. UNIQUE (school_slug, content_hash).',
    cols: [
      { n: 'id', uuid: true },
      { n: 'upload_id', fk: 'uploads', nullable: true },
      { n: 'school_slug', notNull: true },
      { n: 'state_code', fk: 'states', notNull: true },
      { n: 'course_name', notNull: true },
      { n: 'course_code' },
      { n: 'category' },
      { n: 'grade_level' },
      { n: 'credits' },
      { n: 'course_duration' },
      { n: 'course_term' },
      { n: 'grad_requirement' },
      { n: 'description' },
      { n: 'chunk_index' },
      { n: 'content_hash' },
      { n: 'created_at', default: 'NOW()' },
    ],
    constraints: [
      { type: 'PRIMARY KEY', cols: 'id', default: 'gen_random_uuid()' },
      { type: 'UNIQUE', cols: 'school_slug, content_hash' },
      { type: 'FOREIGN KEY', cols: 'upload_id → uploads(id)', onDelete: 'CASCADE' },
      { type: 'FOREIGN KEY', cols: 'state_code → states(code)' },
    ],
    indexes: [
      { name: 'idx_ev2_upload', on: 'upload_id' },
      { name: 'idx_ev2_school', on: 'school_slug' },
      { name: 'idx_ev2_state', on: 'state_code' },
      { name: 'idx_ev2_code', on: 'course_code' },
      { name: 'idx_ev2_category', on: 'category' },
    ],
  },
  {
    name: 'master_courses',
    color: '#d97706',
    rows: 0,
    desc: 'State master database. FL CPALMS + TX TEA + CA CDE.',
    cols: [
      { n: 'id', uuid: true },
      { n: 'state_code', fk: 'states' },
      { n: 'course_code', pk: true },
      { n: 'course_name' },
      { n: 'abbrev_name' },
      { n: 'category' },
      { n: 'grade_level' },
      { n: 'credit' },
      { n: 'level_length' },
      { n: 'grad_requirement' },
      { n: 'is_active' },
    ],
  },
  {
    name: 'mapping_results',
    color: '#db2777',
    rows: 0,
    desc: 'Output of the 27-pass mapping engine. One row per extracted course.',
    cols: [
      { n: 'id', uuid: true },
      { n: 'extracted_id', fk: 'extractions_v2', uniq: true },
      { n: 'state_code', fk: 'states' },
      { n: 'master_course_id', fk: 'master_courses' },
      { n: 'match_type' },
      { n: 'confidence' },
      { n: 'matched_code' },
      { n: 'matched_name' },
      { n: 'review_status' },
      { n: 'reviewed_by' },
      { n: 'mapped_at' },
    ],
  },
  {
    name: 'course_synonyms',
    color: '#7c3aed',
    rows: 0,
    desc: 'Curated alias table. Maps school spelling variants to master course codes.',
    cols: [
      { n: 'id', uuid: true },
      { n: 'state_code', fk: 'states' },
      { n: 'alias_name', pk: true },
      { n: 'alias_upper' },
      { n: 'master_code' },
      { n: 'verified_by' },
      { n: 'created_at' },
    ],
  },
];

// ─── MINE SECTION ─────────────────────────────────────────────────────────
function MineSection() {
  const [mineSection, setMineSection] = useState('overview');
  const [mapFilter, setMapFilter] = useState('all');
  const [selectedTable, setSelectedTable] = useState('extractions_v2');

  const [schools, setSchools] = useState<School[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [totalMappingCount, setTotalMappingCount] = useState(0);
  const [serverMatchBreakdown, setServerMatchBreakdown] = useState<Record<string, number>>({});
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingLoaded, setMappingLoaded] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownLoaded, setBreakdownLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch schools summary first so the page can render quickly.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const schoolsRes = await fetch('/api/mine/schools').then(r => r.json());

        if (schoolsRes.error) throw new Error(schoolsRes.error);

        setSchools(schoolsRes.schools || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch data');
        console.error('[Mine] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Load match breakdown lazily for overview, without blocking the page shell.
  useEffect(() => {
    let cancelled = false;

    if (mineSection !== 'overview' || breakdownLoaded || breakdownLoading) {
      return () => {
        cancelled = true;
      };
    }

    const fetchBreakdown = async () => {
      try {
        setBreakdownLoading(true);
        const mappingRes = await fetch('/api/mine/mapping?includeRows=0&includeBreakdown=1').then(r => r.json());
        if (cancelled) return;
        if (mappingRes.error) throw new Error(mappingRes.error);

        setTotalMappingCount(prev => prev > 0 ? prev : (mappingRes.totalRows ?? 0));
        setServerMatchBreakdown(mappingRes.matchBreakdown ?? {});
        setBreakdownLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[Mine] Breakdown fetch error:', err);
        }
      } finally {
        if (!cancelled) {
          setBreakdownLoading(false);
        }
      }
    };

    void fetchBreakdown();

    return () => {
      cancelled = true;
    };
  }, [mineSection, breakdownLoaded, breakdownLoading]);

  // Load mapping preview only when user opens the Mapping tab.
  useEffect(() => {
    let cancelled = false;

    if (mineSection !== 'mapping' || mappingLoaded || mappingLoading) {
      return () => {
        cancelled = true;
      };
    }

    const fetchMapping = async () => {
      try {
        setMappingLoading(true);
        const mappingRes = await fetch('/api/mine/mapping?includeRows=1&includeBreakdown=0').then(r => r.json());
        if (cancelled) return;
        if (mappingRes.error) throw new Error(mappingRes.error);

        setMappingRows(mappingRes.rows || []);
        setTotalMappingCount(mappingRes.totalRows ?? (mappingRes.rows?.length ?? 0));
        setMappingLoaded(true);
      } catch (err) {
        if (!cancelled) {
          console.error('[Mine] Mapping fetch error:', err);
        }
      } finally {
        if (!cancelled) {
          setMappingLoading(false);
        }
      }
    };

    void fetchMapping();

    return () => {
      cancelled = true;
    };
  }, [mineSection, mappingLoaded, mappingLoading]);

  const nav = [
    { id: 'overview', icon: BarChart3, label: 'Overview' },
    { id: 'schools', icon: School, label: 'Schools' },
    { id: 'florida', icon: FolderKanban, label: 'Florida DB' },
    { id: 'mapping', icon: Link2, label: 'Mapping' },
    { id: 'entity', icon: Network, label: 'Entity Diagram' },
    { id: 'schema', icon: Table2, label: 'Table Schema' },
  ];

  const totalCourses = schools.reduce((a, s) => a + s.courses, 0);
  const totalMapped = schools.reduce((a, s) => a + s.mapped, 0);
  const totalUnmatched = schools.reduce((a, s) => a + s.unmatched, 0);
  const mapPct = totalCourses > 0 ? Math.round((totalMapped / totalCourses) * 100) : 0;

  const filteredMap = mappingRows.filter(m =>
    mapFilter === 'all'
      ? true
      : mapFilter === 'unmatched'
        ? m.matchType === 'unmatched'
        : mapFilter === 'review'
          ? m.status === 'needs_review'
          : mapFilter === 'confirmed'
            ? m.status === 'confirmed'
            : true
  );

  // Use server-computed breakdown (avoids iterating 52k rows in browser)
  const matchBreakdown: [string, number][] = Object.entries(
    Object.keys(serverMatchBreakdown).length > 0 ? serverMatchBreakdown :
      mappingRows.reduce((acc, m) => { acc[m.matchType] = (acc[m.matchType] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 60px)',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0b14',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        Loading mine data...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 60px)',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0b14',
          color: '#f87171',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14 }}>Error loading data</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', background: '#0d0b14' }}>
      {/* ── MINE SIDEBAR ── */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          background: '#110e1c',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 12px',
          gap: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.25)',
            letterSpacing: 1.2,
            marginBottom: 10,
            paddingLeft: 8,
          }}
        >
          MINE
        </div>
        {nav.map(n => {
          const isActive = mineSection === n.id;
          const NavIcon = n.icon;
          return (
            <button
              key={n.id}
              onClick={() => setMineSection(n.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 9,
                padding: '9px 10px',
                borderRadius: 8,
                border: 'none',
                background: isActive ? 'rgba(96,58,200,0.2)' : 'transparent',
                borderLeft: isActive ? '2px solid #603AC8' : '2px solid transparent',
                color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <NavIcon size={14} strokeWidth={2.2} />
              </span>
              {n.label}
            </button>
          );
        })}

        {/* DB status */}
        <div
          style={{
            marginTop: 'auto',
            padding: '12px 10px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.25)',
              fontFamily: "'DM Mono',monospace",
              marginBottom: 8,
            }}
          >
            SUPABASE
          </div>
          {[
            { label: 'schools', color: '#4ade80' },
            { label: 'extractions_v2', color: '#4ade80' },
            { label: 'master_courses', color: '#4ade80' },
            { label: 'mapping_results', color: '#fbbf24' },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <div
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: t.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: "'DM Mono',monospace",
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── MINE CONTENT ── */}
      <div
        style={{
          flex: 1,
          overflowY: mineSection === 'florida' ? 'hidden' : 'auto',
          padding: mineSection === 'florida' ? 0 : 24,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ══ OVERVIEW ══ */}
        {mineSection === 'overview' && (
          <OverviewSection
            schools={schools}
            totalCourses={totalCourses}
            totalMapped={totalMapped}
            totalUnmatched={totalUnmatched}
            mapPct={mapPct}
            matchBreakdown={matchBreakdown}
            totalMappingCount={totalMappingCount}
            mappingLoading={mappingLoading || breakdownLoading}
          />
        )}

        {/* ══ SCHOOLS ══ */}
        {mineSection === 'schools' && (
          <SchoolsSection
            schools={schools}
            selectedSchool={selectedSchool}
            onSchoolSelect={setSelectedSchool}
          />
        )}

        {/* ══ FLORIDA DATA ══ */}
        {mineSection === 'florida' && (
          <FloridaSection />
        )}

        {/* ══ MAPPING ══ */}
        {mineSection === 'mapping' && (
          <MappingSection
            mappingRows={filteredMap}
            mapFilter={mapFilter}
            setMapFilter={setMapFilter}
            totalMappingRows={totalMappingCount}
            loading={mappingLoading}
          />
        )}

        {/* ══ ENTITY DIAGRAM ══ */}
        {mineSection === 'entity' && <EntityDiagramSection />}

        {/* ══ SCHEMA ══ */}
        {mineSection === 'schema' && (
          <SchemaSection selectedTable={selectedTable} setSelectedTable={setSelectedTable} dbTables={DB_TABLES} />
        )}
      </div>
    </div>
  );
}

// ─── OVERVIEW SECTION ───────────────────────────────────────────────────────
function OverviewSection({
  schools,
  totalCourses,
  totalMapped,
  totalUnmatched,
  mapPct,
  matchBreakdown,
  totalMappingCount,
  mappingLoading,
}: {
  schools: School[];
  totalCourses: number;
  totalMapped: number;
  totalUnmatched: number;
  mapPct: number;
  matchBreakdown: [string, number][];
  totalMappingCount: number;
  mappingLoading: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
          Data Overview
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Across all schools and extractions in your Supabase instance
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          {
            label: 'Schools',
            value: schools.length,
            sub: 'in database',
            color: '#603AC8',
            icon: School,
          },
          { label: 'Total Courses', value: totalCourses, sub: 'extracted', color: '#0891b2', icon: BookOpen },
          {
            label: 'Mapped',
            value: `${mapPct}%`,
            sub: `${totalMapped} matched`,
            color: '#059669',
            icon: CheckCircle2,
          },
          {
            label: 'Unmatched',
            value: totalUnmatched,
            sub: 'need review',
            color: '#f87171',
            icon: AlertTriangle,
          },
        ].map(s => (
          <div
            key={s.label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '16px 18px',
              borderTop: `2px solid ${s.color}`,
            }}
          >
            <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center' }}>
              <s.icon size={22} color={s.color} strokeWidth={2.1} />
            </div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#fff',
                fontFamily: "'DM Mono',monospace",
                lineHeight: 1,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Mono',monospace" }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* School performance bars */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            School Mapping Performance
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.25)',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            sorted by match rate
          </div>
        </div>
        {[...schools].sort((a, b) => b.pct - a.pct).map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: '12px 18px',
              borderBottom: i < schools.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'rgba(96,58,200,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontFamily: "'DM Mono',monospace",
                color: '#a78bfa',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {s.state}
            </div>
            <div style={{ minWidth: 180 }}>
              <div style={{ fontSize: 13, color: '#e2e0ea', fontWeight: 500 }}>
                {s.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.3)',
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                {s.city} · {s.courses} courses
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    background:
                      s.pct >= 90
                        ? 'linear-gradient(90deg,#059669,#4ade80)'
                        : s.pct >= 80
                          ? 'linear-gradient(90deg,#0891b2,#67e8f9)'
                          : 'linear-gradient(90deg,#d97706,#fbbf24)',
                    width: `${s.pct}%`,
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'DM Mono',monospace",
                color: s.pct >= 90 ? '#4ade80' : s.pct >= 80 ? '#67e8f9' : '#fbbf24',
                minWidth: 40,
                textAlign: 'right',
              }}
            >
              {s.pct}%
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.2)',
                minWidth: 80,
                textAlign: 'right',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {s.unmatched} unmatched
            </div>
          </div>
        ))}
      </div>

      {/* Match type breakdown */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: '16px 18px',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            marginBottom: 14,
          }}
        >
          27-Pass Engine — Match Type Breakdown
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mappingLoading && matchBreakdown.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
              Loading mapping breakdown...
            </div>
          )}
          {matchBreakdown.map(([type, count]) => {
            const cfg = (MATCH_CONF as any)[type] || {
              color: '#888',
              bg: 'rgba(0,0,0,0.2)',
              label: type,
            };
            const pct = totalMappingCount > 0 ? Math.round((count / totalMappingCount) * 100) : 0;
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 120,
                    fontSize: 11,
                    color: cfg.color,
                    fontFamily: "'DM Mono',monospace",
                    flexShrink: 0,
                  }}
                >
                  {cfg.label}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 5,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct * 3}%`,
                      background: cfg.color,
                      borderRadius: 3,
                      opacity: 0.8,
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 30,
                    fontSize: 11,
                    fontFamily: "'DM Mono',monospace",
                    color: 'rgba(255,255,255,0.5)',
                    textAlign: 'right',
                  }}
                >
                  {count}
                </div>
                <div
                  style={{
                    width: 35,
                    fontSize: 10,
                    fontFamily: "'DM Mono',monospace",
                    color: 'rgba(255,255,255,0.25)',
                    textAlign: 'right',
                  }}
                >
                  {pct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SCHOOLS SECTION ───────────────────────────────────────────────────────
type SchoolCourse = {
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
};

function SchoolsSection({
  schools,
  selectedSchool,
  onSchoolSelect,
}: {
  schools: School[];
  selectedSchool: School | null;
  onSchoolSelect: (s: School | null) => void;
}) {
  const [courses, setCourses] = useState<SchoolCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    if (!selectedSchool) { setCourses([]); return; }
    setLoadingCourses(true);
    setCourseSearch('');
    fetch(`/api/mine/schools/${encodeURIComponent(selectedSchool.slug)}`)
      .then(r => r.json())
      .then(d => setCourses(d.rows || []))
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, [selectedSchool]);

  const filteredCourses = courses.filter(c =>
    !courseSearch ||
    c.name.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.code.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const MATCH_COLORS: Record<string, string> = {
    'exact-course-code': '#4ade80',
    'exact-course-name': '#34d399',
    'exact-course-abb-name': '#67e8f9',
    'exact-roman-course-name': '#a78bfa',
    synonym: '#fbbf24',
    unmatched: '#f87171',
  };

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>
      {/* Schools list */}
      <div
        style={{
          flex: selectedSchool ? '0 0 360px' : '1',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflow: 'hidden',
          transition: 'flex 0.2s ease',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>Schools</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            schools table · {schools.length} rows — click a row to view courses
          </div>
        </div>
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            overflow: 'auto',
            flex: 1,
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {(selectedSchool
                  ? ['name', 'courses']
                  : ['slug', 'name', 'city', 'state', 'courses', 'mapped', 'unmatched', 'rate']
                ).map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: "'DM Mono',monospace",
                      letterSpacing: 0.8,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schools.map((s, i) => {
                const isSelected = selectedSchool?.id === s.id;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onSchoolSelect(isSelected ? null : s)}
                    style={{
                      borderBottom: i < schools.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: isSelected ? 'rgba(96,58,200,0.15)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {!selectedSchool && (
                      <>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#a78bfa' }}>{s.slug}</td>
                        <td style={{ padding: '12px 14px', fontSize: 13, color: '#e2e0ea', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.name}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{s.city}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: 'rgba(96,58,200,0.2)', color: '#a78bfa', fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", padding: '2px 7px', borderRadius: 4 }}>{s.state}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{s.courses.toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#4ade80' }}>{s.mapped.toLocaleString()}</td>
                        <td style={{ padding: '12px 14px', fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#f87171' }}>{s.unmatched.toLocaleString()}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                              <div style={{ height: '100%', width: `${s.pct}%`, background: s.pct >= 90 ? '#4ade80' : s.pct >= 80 ? '#67e8f9' : '#fbbf24', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: s.pct >= 90 ? '#4ade80' : s.pct >= 80 ? '#67e8f9' : '#fbbf24' }}>{s.pct}%</span>
                          </div>
                        </td>
                      </>
                    )}
                    {selectedSchool && (
                      <>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: isSelected ? '#c4b5fd' : '#e2e0ea', fontWeight: isSelected ? 700 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{s.name}</td>
                        <td style={{ padding: '10px 14px', fontFamily: "'DM Mono',monospace", fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{s.courses.toLocaleString()}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course drill-down panel */}
      {selectedSchool && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            paddingLeft: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{selectedSchool.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                {selectedSchool.slug} · {loadingCourses ? 'loading…' : `${courses.length.toLocaleString()} courses`}
              </div>
            </div>
            <button
              onClick={() => onSchoolSelect(null)}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: 'rgba(255,255,255,0.5)', padding: '5px 10px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <X size={12} strokeWidth={2.2} /> Close
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'rgba(255,255,255,0.04)', padding: '7px 12px', flexShrink: 0 }}>
            <Search size={12} color='rgba(255,255,255,0.5)' strokeWidth={2.2} />
            <input
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              placeholder='Search name, code, category…'
              style={{ border: 'none', outline: 'none', background: 'none', color: '#e2e0ea', fontSize: 12, width: '100%' }}
            />
            {courseSearch && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>
                {filteredCourses.length} of {courses.length}
              </span>
            )}
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
            {loadingCourses ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading courses…</div>
            ) : filteredCourses.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>No courses found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#1a1229', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Category', 'Course Name', 'Code', 'Grade', 'Credit', 'Match'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((c, index) => (
                    <tr key={`${c.id}-${index}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(96,58,200,0.15)', color: '#c4b5fd', whiteSpace: 'nowrap' }}>{c.category}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#e2e0ea' }}>{c.name}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.45)', fontFamily: "'DM Mono',monospace" }}>{c.code}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)' }}>{c.grade}</td>
                      <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontFamily: "'DM Mono',monospace" }}>{c.credit}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          fontSize: 10,
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontFamily: "'DM Mono',monospace",
                          color: MATCH_COLORS[c.matchType] || '#888',
                          background: `${MATCH_COLORS[c.matchType] || '#888'}18`,
                        }}>
                          {c.matchedCode || c.matchType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FLORIDA SECTION ───────────────────────────────────────────────────────
function FloridaSection() {
  return <FloridaDBSection />;
}

// ─── MAPPING SECTION ────────────────────────────────────────────────────────
function MappingSection({
  mappingRows,
  mapFilter,
  setMapFilter,
  totalMappingRows,
  loading,
}: {
  mappingRows: MappingRow[];
  mapFilter: string;
  setMapFilter: (v: string) => void;
  totalMappingRows: number;
  loading: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
            Mapping Results
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            mapping_results · 27-pass engine output
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'All', count: totalMappingRows },
            {
              id: 'review',
              label: 'Needs Review',
              count: totalMappingRows,
            },
            {
              id: 'unmatched',
              label: 'Unmatched',
              count: mappingRows.filter(m => m.matchType === 'unmatched').length,
            },
            { id: 'confirmed', label: 'Confirmed', count: totalMappingRows },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setMapFilter(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid',
                borderColor:
                  mapFilter === f.id ? 'rgba(96,58,200,0.5)' : 'rgba(255,255,255,0.08)',
                background:
                  mapFilter === f.id ? 'rgba(96,58,200,0.2)' : 'rgba(255,255,255,0.03)',
                color: mapFilter === f.id ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: mapFilter === f.id ? 600 : 400,
              }}
            >
              {f.label} <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, opacity: 0.7 }}>({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Confidence legend */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(MATCH_CONF).map(([type, cfg]: any) => (
          <div
            key={type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              background: cfg.bg,
              border: `1px solid ${cfg.color}33`,
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: cfg.color,
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: cfg.color,
                fontFamily: "'DM Mono',monospace",
                fontWeight: 600,
              }}
            >
              {cfg.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {loading && mappingRows.length === 0 ? (
          <div style={{ padding: 24, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            Loading mapping preview...
          </div>
        ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {['school', 'extracted course', 'matched code', 'match type', 'confidence', 'review status'].map(
                h => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {mappingRows.map((m, i) => {
              const cfg = (MATCH_CONF as any)[m.matchType] || {
                color: '#888',
                label: m.matchType,
              };
              const statusCfg = {
                auto: { color: '#67e8f9', label: 'auto' },
                confirmed: { color: '#4ade80', label: 'confirmed' },
                needs_review: { color: '#fbbf24', label: 'needs review' },
                unmatched: { color: '#f87171', label: 'unmatched' },
              }[m.status] || { color: '#888', label: m.status };
              return (
                <tr
                  key={m.id}
                  style={{
                    borderBottom:
                      i < mappingRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background:
                      m.status === 'needs_review'
                        ? 'rgba(251,191,36,0.03)'
                        : m.matchType === 'unmatched'
                          ? 'rgba(239,68,68,0.03)'
                          : 'transparent',
                  }}
                >
                  <td
                    style={{
                      padding: '10px 14px',
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.45)',
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {m.school}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#e2e0ea', fontWeight: 500 }}>
                    {m.course}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12,
                      color: m.code ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                    }}
                  >
                    {m.code || '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontWeight: 600,
                        fontFamily: "'DM Mono',monospace",
                        background: cfg.bg,
                        color: cfg.color,
                      }}
                    >
                      {cfg.label}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {m.conf > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div
                          style={{
                            width: 40,
                            height: 3,
                            background: 'rgba(255,255,255,0.06)',
                            borderRadius: 2,
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${m.conf * 100}%`,
                              background: cfg.color,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            color: 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {(m.conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontFamily: "'DM Mono',monospace",
                        fontWeight: 600,
                        color: statusCfg.color,
                        background: `${statusCfg.color}18`,
                      }}
                    >
                      {statusCfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}

// ─── ENTITY DIAGRAM ────────────────────────────────────────────────────────
function EntityDiagramSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
          Entity Relationship Diagram
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Supabase schema — 6 tables, FK relationships, normalized columns
        </div>
      </div>
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          overflow: 'auto',
          padding: 24,
        }}
      >
        <svg width="860" height="540" viewBox="0 0 860 540" style={{ display: 'block', minWidth: 860 }}>
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="rgba(255,255,255,0.2)" />
            </marker>
            <marker id="arr-g" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#4ade80" />
            </marker>
            <marker id="arr-b" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#67e8f9" />
            </marker>
            <marker id="arr-p" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#a78bfa" />
            </marker>
            <marker id="arr-y" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#fbbf24" />
            </marker>
          </defs>

          {/* Connection lines */}
          <line
            x1="120"
            y1="100"
            x2="80"
            y2="200"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            markerEnd="url(#arr)"
            strokeDasharray="4,3"
          />
          <line
            x1="150"
            y1="100"
            x2="580"
            y2="175"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1.5"
            markerEnd="url(#arr)"
            strokeDasharray="4,3"
          />
          <line
            x1="110"
            y1="290"
            x2="200"
            y2="340"
            stroke="#4ade80"
            strokeWidth="1.5"
            markerEnd="url(#arr-g)"
            opacity="0.5"
          />
          <line
            x1="280"
            y1="390"
            x2="310"
            y2="390"
            stroke="#67e8f9"
            strokeWidth="1.5"
            markerEnd="url(#arr-b)"
            opacity="0.5"
          />
          <line
            x1="530"
            y1="390"
            x2="560"
            y2="390"
            stroke="#a78bfa"
            strokeWidth="1.5"
            markerEnd="url(#arr-p)"
            opacity="0.5"
          />
          <line
            x1="680"
            y1="340"
            x2="680"
            y2="260"
            stroke="#fbbf24"
            strokeWidth="1.5"
            markerEnd="url(#arr-y)"
            opacity="0.5"
          />

          {/* Relationship labels */}
          <text x="140" y="240" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">
            1:N
          </text>
          <text x="230" y="375" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">
            1:N
          </text>
          <text x="535" y="380" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">
            1:1
          </text>
          <text x="690" y="305" fill="rgba(255,255,255,0.25)" fontSize="9" fontFamily="monospace">
            N:1
          </text>
        </svg>
      </div>
    </div>
  );
}

// ─── SCHEMA SECTION ────────────────────────────────────────────────────────
function SchemaSection({
  selectedTable,
  setSelectedTable,
  dbTables,
}: {
  selectedTable: string;
  setSelectedTable: (v: string) => void;
  dbTables: any[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
            Table Schema
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
            Click a table to inspect columns, constraints, and indexes
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {dbTables.map(t => (
            <button
              key={t.name}
              onClick={() => setSelectedTable(t.name)}
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                border: '1px solid',
                borderColor: selectedTable === t.name ? t.color : 'rgba(255,255,255,0.07)',
                background: selectedTable === t.name ? `${t.color}22` : 'rgba(255,255,255,0.02)',
                color: selectedTable === t.name ? t.color : 'rgba(255,255,255,0.4)',
                fontSize: 11,
                fontFamily: "'DM Mono',monospace",
                cursor: 'pointer',
                fontWeight: selectedTable === t.name ? 700 : 400,
                transition: 'all 0.15s',
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {dbTables
        .filter(t => t.name === selectedTable)
        .map(table => (
          <div key={table.name}>
            <div
              style={{
                background: `${table.color}10`,
                border: `1px solid ${table.color}40`,
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: `${table.color}25`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {table.name === 'schools' ? (
                  <School size={20} color={table.color} strokeWidth={2.2} />
                ) : table.name === 'uploads' ? (
                  <Send size={20} color={table.color} strokeWidth={2.2} />
                ) : table.name === 'extractions_v2' ? (
                  <Database size={20} color={table.color} strokeWidth={2.2} />
                ) : table.name === 'master_courses' ? (
                  <FolderKanban size={20} color={table.color} strokeWidth={2.2} />
                ) : table.name === 'mapping_results' ? (
                  <Link2 size={20} color={table.color} strokeWidth={2.2} />
                ) : (
                  <Type size={20} color={table.color} strokeWidth={2.2} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#fff',
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {table.name}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  {table.desc}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    color: table.color,
                  }}
                >
                  {table.rows.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.3)',
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  rows (sample)
                </div>
              </div>
            </div>

            {/* Columns */}
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
                overflow: 'hidden',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  display: 'grid',
                  gridTemplateColumns: '200px 100px 80px auto',
                  gap: 8,
                }}
              >
                {['column_name', 'type', 'flags', 'notes'].map(h => (
                  <div
                    key={h}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: "'DM Mono',monospace",
                      letterSpacing: 0.8,
                    }}
                  >
                    {h.toUpperCase()}
                  </div>
                ))}
              </div>
              {table.cols.map((col: any, i: number) => (
                <div
                  key={col.n}
                  style={{
                    padding: '10px 14px',
                    borderBottom:
                      i < table.cols.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '200px 100px 80px auto',
                    gap: 8,
                    alignItems: 'center',
                    background: col.pk
                      ? 'rgba(251,191,36,0.04)'
                      : col.uuid
                        ? 'rgba(255,255,255,0.01)'
                        : 'transparent',
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12,
                      color: col.pk ? '#fbbf24' : col.fk ? '#67e8f9' : col.uuid ? 'rgba(255,255,255,0.35)' : '#e2e0ea',
                      fontWeight: col.pk || col.fk ? 700 : 400,
                    }}
                  >
                    {col.n}
                  </div>
                  <div
                    style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.35)' }}
                  >
                    {col.uuid ? 'uuid' : col.fk ? 'uuid' : col.pk ? 'text' : 'text'}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {col.pk && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(251,191,36,0.2)',
                          color: '#fbbf24',
                          fontWeight: 700,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        PK
                      </span>
                    )}
                    {col.fk && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(8,145,178,0.2)',
                          color: '#67e8f9',
                          fontWeight: 700,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        FK
                      </span>
                    )}
                    {col.uuid && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(255,255,255,0.06)',
                          color: 'rgba(255,255,255,0.3)',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        UUID
                      </span>
                    )}
                    {col.notNull && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(239,68,68,0.15)',
                          color: '#f87171',
                          fontWeight: 700,
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        NOT NULL
                      </span>
                    )}
                    {col.nullable && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(156,163,175,0.15)',
                          color: '#9ca3af',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        NULLABLE
                      </span>
                    )}
                    {col.default && (
                      <span
                        style={{
                          fontSize: 8,
                          padding: '1px 5px',
                          borderRadius: 3,
                          background: 'rgba(34,211,238,0.15)',
                          color: '#06b6d4',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {col.default}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                    {col.fk
                      ? `→ ${col.fk}.id`
                      : col.pk
                        ? 'primary key'
                        : col.uuid
                          ? 'gen_random_uuid()'
                          : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Constraints */}
            {table.constraints && table.constraints.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  Constraints
                </div>
                {table.constraints.map((constraint: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderBottom:
                        i < table.constraints.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(96,58,200,0.15)',
                        color: '#a78bfa',
                        fontWeight: 700,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {constraint.type}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Mono',monospace",
                        color: '#e2e0ea',
                        wordBreak: 'break-all',
                      }}
                    >
                      {constraint.cols}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "'DM Mono',monospace",
                        color: 'rgba(255,255,255,0.3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {constraint.onDelete && `ON DELETE ${constraint.onDelete}`}
                      {constraint.default && constraint.default}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Indexes */}
            {table.indexes && table.indexes.length > 0 && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  Indexes
                </div>
                {table.indexes.map((index: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      borderBottom:
                        i < table.indexes.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background: 'rgba(34,211,238,0.15)',
                        color: '#06b6d4',
                        fontWeight: 700,
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      INDEX
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: "'DM Mono',monospace",
                        color: '#e2e0ea',
                      }}
                    >
                      {index.name} on {index.on}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

export default function MinePage() {
  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: '#0d0b14', minHeight: '100vh', display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }`}</style>
      <Header />
      <MineSection />
    </div>
  );
}
