import { useState, useEffect, useRef, useCallback } from "react";

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
const MOCK_BATCHES = [
  {
    pages: "1–5", courses: [
      { id:1, name:"AP Art History", code:"0100300", category:"Visual Arts", grade:"PF", credit:"1.0", length:"Y" },
      { id:2, name:"Introduction to Art", code:"0101300", category:"Visual Arts", grade:"6-8", credit:"0.5", length:"S" },
      { id:3, name:"Drawing & Painting I", code:"0101320", category:"Visual Arts", grade:"9-12", credit:"0.5", length:"S" },
      { id:4, name:"Ceramics I", code:"0101400", category:"Visual Arts", grade:"9-12", credit:"0.5", length:"S" },
      { id:5, name:"Photography I", code:"0101800", category:"Visual Arts", grade:"9-12", credit:"0.5", length:"S" },
      { id:6, name:"Digital Art I", code:"0102300", category:"Visual Arts", grade:"9-12", credit:"0.5", length:"S" },
    ]
  },
  {
    pages: "6–10", courses: [
      { id:7, name:"AP Music Theory", code:"1300340", category:"Performing Arts", grade:"9-12", credit:"1.0", length:"Y" },
      { id:8, name:"Band I", code:"1301300", category:"Performing Arts", grade:"6-8", credit:"1.0", length:"Y" },
      { id:9, name:"Chorus I", code:"1302300", category:"Performing Arts", grade:"6-8", credit:"1.0", length:"Y" },
      { id:10, name:"Orchestra I", code:"1303300", category:"Performing Arts", grade:"9-12", credit:"1.0", length:"Y" },
      { id:11, name:"Drama I", code:"1400300", category:"Performing Arts", grade:"9-12", credit:"0.5", length:"S" },
    ]
  },
  {
    pages: "11–15", courses: [
      { id:12, name:"Algebra I", code:"1200310", category:"Mathematics", grade:"8-9", credit:"1.0", length:"Y" },
      { id:13, name:"Geometry", code:"1206310", category:"Mathematics", grade:"9-10", credit:"1.0", length:"Y" },
      { id:14, name:"Algebra II", code:"1200330", category:"Mathematics", grade:"10-11", credit:"1.0", length:"Y" },
      { id:15, name:"Pre-Calculus", code:"1202310", category:"Mathematics", grade:"11-12", credit:"1.0", length:"Y" },
      { id:16, name:"AP Calculus AB", code:"1202300", category:"Mathematics", grade:"11-12", credit:"1.0", length:"Y" },
      { id:17, name:"Statistics", code:"1210300", category:"Mathematics", grade:"10-12", credit:"0.5", length:"S" },
    ]
  },
  {
    pages: "16–20", courses: [
      { id:18, name:"English I", code:"1001310", category:"Language Arts", grade:"9", credit:"1.0", length:"Y" },
      { id:19, name:"English II", code:"1001320", category:"Language Arts", grade:"10", credit:"1.0", length:"Y" },
      { id:20, name:"AP English Language", code:"1001420", category:"Language Arts", grade:"11", credit:"1.0", length:"Y" },
      { id:21, name:"AP English Literature", code:"1001430", category:"Language Arts", grade:"12", credit:"1.0", length:"Y" },
      { id:22, name:"Creative Writing", code:"1005310", category:"Language Arts", grade:"10-12", credit:"0.5", length:"S" },
    ]
  },
];

const MOCK_RECHECK_NEW = [
  { id:23, name:"Sculpture I", code:"0101450", category:"Visual Arts", grade:"9-12", credit:"0.5", length:"S" },
  { id:24, name:"AP Statistics", code:"1210320", category:"Mathematics", grade:"11-12", credit:"1.0", length:"Y" },
  { id:25, name:"Journalism I", code:"1006300", category:"Language Arts", grade:"9-12", credit:"0.5", length:"S" },
];

const STATUS = { IDLE:"idle", EXTRACTING:"extracting", DONE:"done", RECHECKING:"rechecking", RECHECK_DONE:"recheck_done" };

const MOCK_RECENT_FILES = [
  { id:"f1", name:"lincoln-high-catalog-2025.pdf", courses:142, status:"completed", pages:48, ts: Date.now() - 1000*60*12 },
  { id:"f2", name:"kennedy-high-courses.pdf",      courses:98,  status:"completed", pages:32, ts: Date.now() - 1000*60*60*2 },
  { id:"f3", name:"miami-arts-catalog.pdf",         courses:0,   status:"failed",    pages:0,  ts: Date.now() - 1000*60*60*5 },
  { id:"f4", name:"broward-district-full.pdf",      courses:211, status:"completed", pages:72, ts: Date.now() - 1000*60*60*24 },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Visual Arts": "#7c3aed",
  "Performing Arts": "#db2777",
  "Mathematics": "#0891b2",
  "Language Arts": "#059669",
  "Science": "#d97706",
  "Social Studies": "#dc2626",
};

function categoryColor(cat: string) {
  return CATEGORY_COLORS[cat] || "#6b7280";
}

// ─── ICONS ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size=16, stroke="#fff", fill="none" }: { d: string, size?: number, stroke?: string, fill?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
  </svg>
);

const UploadIcon = () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor"/>;
const KeyIcon = () => <Icon d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor"/>;
const SearchIcon = () => <Icon d="M11 17.25a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5zm5.25-1.25L22 22" stroke="currentColor"/>;
const DownloadIcon = () => <Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor"/>;
const RefreshIcon = () => <Icon d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" stroke="currentColor"/>;
const XIcon = () => <Icon d="M18 6L6 18M6 6l12 12" stroke="currentColor"/>;
const SparkleIcon = () => <Icon d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="currentColor"/>;

// ─── PROGRESS PIPELINE ──────────────────────────────────────────────────────
function BatchPipeline({ batches, currentBatch, totalBatches }: { batches: any[], currentBatch: number, totalBatches: number }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, marginBottom:20, overflowX:"auto", paddingBottom:4 }}>
      {Array.from({ length: totalBatches }, (_, i) => {
        const done = i < currentBatch;
        const active = i === currentBatch;
        const label = batches[i] ? `${batches[i].pages}` : `${i*5+1}–${(i+1)*5}`;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", flexShrink:0 }}>
            <div style={{
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
            }}>
              <div style={{
                width:36, height:36, borderRadius:"50%",
                background: done ? "#603AC8" : active ? "#fff" : "rgba(255,255,255,0.1)",
                border: active ? "2px solid #603AC8" : done ? "none" : "2px solid rgba(255,255,255,0.2)",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.4s",
                boxShadow: active ? "0 0 0 4px rgba(96,58,200,0.25)" : "none",
              }}>
                {done
                  ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                  : active
                    ? <div style={{ width:10, height:10, borderRadius:"50%", background:"#603AC8", animation:"pulse 1s infinite" }}/>
                    : <div style={{ width:8, height:8, borderRadius:"50%", background:"rgba(255,255,255,0.3)" }}/>
                }
              </div>
              <span style={{
                fontSize:10, fontFamily:"'DM Mono', monospace",
                color: done ? "#a78bfa" : active ? "#fff" : "rgba(255,255,255,0.35)",
                whiteSpace:"nowrap",
              }}>
                pg {label}
              </span>
            </div>
            {i < totalBatches - 1 && (
              <div style={{
                width:32, height:2, margin:"0 2px", marginBottom:20,
                background: done ? "#603AC8" : "rgba(255,255,255,0.12)",
                transition:"background 0.4s",
              }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── RECHECK DIFF BANNER ────────────────────────────────────────────────────
function RecheckBanner({ newCourses, onAccept, onDismiss }: { newCourses: any[], onAccept: () => void, onDismiss: () => void }) {
  return (
    <div style={{
      background:"linear-gradient(135deg, #052e16 0%, #064e3b 100%)",
      border:"1px solid #166534",
      borderRadius:12,
      padding:"16px 20px",
      marginBottom:16,
      display:"flex", alignItems:"flex-start", gap:12,
    }}>
      <div style={{
        width:36, height:36, borderRadius:8,
        background:"#16a34a", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>
        <SparkleIcon />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, color:"#86efac", fontSize:14, marginBottom:4 }}>
          Recheck found {newCourses.length} missed course{newCourses.length !== 1 ? "s" : ""}
        </div>
        <div style={{ fontSize:12, color:"#4ade80", marginBottom:12 }}>
          Rows highlighted in green below are newly discovered. Review and accept to add them.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onAccept} style={{
            padding:"6px 14px", borderRadius:6, border:"none",
            background:"#16a34a", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer",
          }}>
            ✓ Accept all {newCourses.length}
          </button>
          <button onClick={onDismiss} style={{
            padding:"6px 14px", borderRadius:6, border:"1px solid #166534",
            background:"transparent", color:"#86efac", fontSize:12, cursor:"pointer",
          }}>
            Dismiss
          </button>
        </div>
      </div>
      <button onClick={onDismiss} style={{ background:"none", border:"none", color:"#4ade80", cursor:"pointer", padding:4 }}>
        <XIcon />
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function CourseExtractor() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [completedBatches, setCompletedBatches] = useState<any[]>([]);
  const [currentBatch, setCurrentBatch] = useState(-1);
  const [recheckNew, setRecheckNew] = useState<any[]>([]);
  const [acceptedNew, setAcceptedNew] = useState<any[]>([]);
  const [showRecheck, setShowRecheck] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [fileName, setFileName] = useState("florida-course-catalog.pdf");
  const [totalPages] = useState(20);
  const [apiKey, setApiKey] = useState("key-001");
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("extract");
  const [recentFiles, setRecentFiles] = useState(MOCK_RECENT_FILES);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startRef = useRef(0);

  // All accepted courses (batches + accepted new)
  const allCourses = [
    ...completedBatches.flatMap(b => b.courses),
    ...acceptedNew,
  ];

  const filtered = allCourses.filter(c =>
    !searchQ ||
    c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQ.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQ.toLowerCase())
  );

  // Start timer
  useEffect(() => {
    if (status === STATUS.EXTRACTING || status === STATUS.RECHECKING) {
      startRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, elapsed]);

  // Scroll table to bottom as rows arrive
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
  }, [completedBatches]);

  const startExtraction = useCallback(async () => {
    setStatus(STATUS.EXTRACTING);
    setCompletedBatches([]);
    setCurrentBatch(0);
    setRecheckNew([]);
    setAcceptedNew([]);
    setShowRecheck(false);
    setElapsed(0);

    for (let i = 0; i < MOCK_BATCHES.length; i++) {
      setCurrentBatch(i);
      await new Promise(r => setTimeout(r, 1400));
      setCompletedBatches(prev => [...prev, MOCK_BATCHES[i]]);
    }

    setCurrentBatch(MOCK_BATCHES.length);
    setStatus(STATUS.DONE);

    // Push to recent files queue
    setRecentFiles(prev => [{
      id: `f-${Date.now()}`,
      name: fileName,
      courses: MOCK_BATCHES.reduce((n, b) => n + b.courses.length, 0),
      status: "completed",
      pages: totalPages,
      ts: Date.now(),
    }, ...prev.slice(0, 9)]);
    setActiveFileId(`f-${Date.now() - 1}`);
  }, [fileName, totalPages]);

  const startRecheck = useCallback(async () => {
    setStatus(STATUS.RECHECKING);
    setElapsed(0);
    await new Promise(r => setTimeout(r, 2200));
    setRecheckNew(MOCK_RECHECK_NEW);
    setShowRecheck(true);
    setStatus(STATUS.RECHECK_DONE);
  }, []);

  const acceptAll = () => {
    setAcceptedNew(recheckNew);
    setShowRecheck(false);
  };

  const dismissRecheck = () => {
    setShowRecheck(false);
    setRecheckNew([]);
  };

  const downloadCSV = () => {
    const rows = [["#","Course Name","Code","Category","Grade","Credit","Length"]];
    allCourses.forEach((c, i) => {
      rows.push([String(i+1), c.name, c.code, c.category, c.grade, c.credit, c.length]);
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([csv], { type:"text/csv" })),
      download: "courses.csv",
    });
    a.click();
  };

  const isRunning = status === STATUS.EXTRACTING || status === STATUS.RECHECKING;

  const relTime = (ts: number) => {
    const d = Math.floor((Date.now() - ts) / 1000);
    if (d < 60) return "just now";
    if (d < 3600) return `${Math.floor(d/60)}m ago`;
    if (d < 86400) return `${Math.floor(d/3600)}h ago`;
    return `${Math.floor(d/86400)}d ago`;
  };

  const fileExt = (name: string) => (name.split(".").pop() || "").toUpperCase();
  const trimName = (name: string, max=26) => name.length > max ? name.slice(0, max) + "…" : name;

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:"100vh",
      background:"#0d0b14",
      fontFamily:"'DM Sans', 'Segoe UI', sans-serif",
      color:"#e2e0ea",
      display:"flex", flexDirection:"column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin:0; padding:0; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes slideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .batch-row-new { animation: slideIn 0.35s ease; }
        .row-new { background: rgba(22,163,74,0.12) !important; }
        .row-accepted { background: rgba(22,163,74,0.07) !important; }
        .tag { display:inline-flex; align-items:center; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600; font-family:'DM Mono',monospace; }
        input::placeholder { color: rgba(255,255,255,0.3); }
        button:hover { opacity:.88; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius:3px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background:"linear-gradient(135deg, #1a1229 0%, #0d0b14 100%)",
        borderBottom:"1px solid rgba(255,255,255,0.07)",
        padding:"0 24px",
        height:60,
        display:"grid",
        gridTemplateColumns:"1fr auto 1fr",
        alignItems:"center",
        flexShrink:0,
      }}>

        {/* LEFT — logo + name */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{
            width:30, height:30, borderRadius:7,
            background:"linear-gradient(135deg, #603AC8, #31225C)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, flexShrink:0,
          }}>📚</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#fff", letterSpacing:"-0.3px", lineHeight:1.2 }}>
              Planpaths
            </div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'DM Mono',monospace" }}>
              Gemini 2.5 Flash
            </div>
          </div>
        </div>

        {/* CENTER — pill tabs */}
        <div style={{
          display:"flex", alignItems:"center", gap:2,
          background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:12, padding:3,
        }}>
          {[
            { id:"ask",     label:"Ask",     icon:"💬", desc:"Query your data" },
            { id:"extract", label:"Extract", icon:"⚡", desc:"Harvest courses from PDFs" },
            { id:"mine",    label:"Mine",    icon:"⛏",  desc:"Analyze & map courses" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.desc}
                style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"7px 18px", borderRadius:9, border:"none",
                  background: isActive
                    ? "linear-gradient(135deg, #603AC8, #31225C)"
                    : "transparent",
                  color: isActive ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize:13, fontWeight: isActive ? 700 : 500,
                  cursor:"pointer", transition:"all 0.2s",
                  fontFamily:"'DM Sans', sans-serif",
                  letterSpacing: isActive ? "-0.2px" : "0",
                  position:"relative",
                  boxShadow: isActive ? "0 2px 12px rgba(96,58,200,0.4)" : "none",
                }}
              >
                <span style={{ fontSize:13, lineHeight:1 }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && (
                  <span style={{
                    position:"absolute", bottom:-14, left:"50%", transform:"translateX(-50%)",
                    width:4, height:4, borderRadius:"50%",
                    background:"#a78bfa",
                  }}/>
                )}
              </button>
            );
          })}
        </div>

        {/* RIGHT — context actions */}
        <div style={{ display:"flex", alignItems:"center", gap:10, justifyContent:"flex-end" }}>
          {activeTab === "extract" && allCourses.length > 0 && (
            <>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#a78bfa", fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                  {allCourses.length}
                </div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", letterSpacing:0.5 }}>COURSES</div>
              </div>
              <div style={{ width:1, height:24, background:"rgba(255,255,255,0.08)" }}/>
              <button onClick={downloadCSV} style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"7px 13px", borderRadius:8,
                background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)",
                color:"#e2e0ea", fontSize:12, fontWeight:600, cursor:"pointer",
              }}>
                <DownloadIcon /> Export CSV
              </button>
            </>
          )}
          {activeTab === "ask" && (
            <div style={{
              fontSize:11, color:"rgba(255,255,255,0.25)",
              fontFamily:"'DM Mono',monospace",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(255,255,255,0.15)" }}/>
              coming soon
            </div>
          )}
          {activeTab === "mine" && (
            <div style={{
              fontSize:11, color:"rgba(255,255,255,0.25)",
              fontFamily:"'DM Mono',monospace",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"rgba(255,255,255,0.15)" }}/>
              coming soon
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      {activeTab === "ask" && <AskPlaceholder />}
      {activeTab === "mine" && <MinePlaceholder />}
      {activeTab === "extract" && <div style={{ flex:1, display:"flex", gap:0, overflow:"hidden", height:"calc(100vh - 60px)" }}>

        {/* ── LEFT PANEL ── */}
        <div style={{
          width:300, flexShrink:0,
          borderRight:"1px solid rgba(255,255,255,0.07)",
          background:"#110e1c",
          display:"flex", flexDirection:"column",
          overflowY:"auto", padding:20, gap:16,
        }}>

          {/* File Upload */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:8 }}>
              SOURCE FILE
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if(f) setFileName(f.name); }}
              style={{
                border:`2px dashed ${isDragging ? "#603AC8" : "rgba(255,255,255,0.1)"}`,
                borderRadius:10, padding:"16px 12px",
                textAlign:"center", cursor:"pointer",
                background: isDragging ? "rgba(96,58,200,0.1)" : "rgba(255,255,255,0.02)",
                transition:"all 0.2s",
              }}
              onClick={() => {}}
            >
              <div style={{ color:"rgba(255,255,255,0.3)", marginBottom:6 }}><UploadIcon /></div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", fontWeight:500, marginBottom:4 }}>
                {fileName || "Drop PDF here"}
              </div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>PDF · DOC · TXT · max 10MB</div>
            </div>
          </div>

          {/* API Key */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:8 }}>
              API KEY
            </div>
            <div style={{
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:8, padding:"10px 12px",
              display:"flex", alignItems:"center", gap:8,
            }}>
              <KeyIcon />
              <select
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                style={{
                  flex:1, background:"none", border:"none", color:"#e2e0ea",
                  fontSize:13, outline:"none", cursor:"pointer",
                }}
              >
                <option value="key-001">✓ Primary Key (17/20)</option>
                <option value="key-002">✓ Backup Key (20/20)</option>
              </select>
            </div>
            <div style={{
              marginTop:6, padding:"6px 10px", borderRadius:6,
              background:"rgba(22,163,74,0.1)", border:"1px solid rgba(22,163,74,0.2)",
              fontSize:11, color:"#4ade80", display:"flex", alignItems:"center", gap:6,
            }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#4ade80" }}/>
              17 of 20 requests remaining today
            </div>
          </div>

          {/* Page Range */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:8 }}>
              PAGE RANGE
            </div>
            <select style={{
              width:"100%", padding:"9px 12px",
              background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)",
              borderRadius:8, color:"#e2e0ea", fontSize:13, outline:"none", cursor:"pointer",
            }}>
              <option>All pages (1–{totalPages})</option>
              <option>Pages 1–5</option>
              <option>Pages 6–10</option>
              <option>Pages 11–15</option>
              <option>Pages 16–20</option>
            </select>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:6 }}>
              ~{Math.ceil(totalPages/5)} API calls · 5 pages/batch
            </div>
          </div>

          {/* Stats */}
          {(status !== STATUS.IDLE) && (
            <div style={{
              background:"rgba(96,58,200,0.08)", border:"1px solid rgba(96,58,200,0.2)",
              borderRadius:10, padding:14,
            }}>
              <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:12 }}>
                SESSION STATS
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[
                  { label:"Courses", value: allCourses.length, color:"#a78bfa" },
                  { label:"Pages", value: `${completedBatches.length * 5}/${totalPages}`, color:"#67e8f9" },
                  { label:"Batches", value: `${completedBatches.length}/${MOCK_BATCHES.length}`, color:"#86efac" },
                  { label:"Elapsed", value: `${elapsed}s`, color:"#fbbf24" },
                ].map(s => (
                  <div key={s.label} style={{
                    background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"10px 10px",
                    textAlign:"center",
                  }}>
                    <div style={{ fontSize:18, fontWeight:700, color:s.color, fontFamily:"'DM Mono',monospace" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RECENT FILES QUEUE ── */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              RECENT FILES
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.2)", fontWeight:400 }}>
                {recentFiles.length} extractions
              </span>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {/* "Processing" entry — shown while extracting */}
              {status === STATUS.EXTRACTING && (
                <div style={{
                  borderRadius:8, padding:"9px 10px",
                  background:"rgba(96,58,200,0.15)",
                  border:"1px solid rgba(96,58,200,0.35)",
                  display:"flex", alignItems:"center", gap:10,
                  animation:"slideIn 0.3s ease",
                }}>
                  <div style={{
                    width:30, height:30, borderRadius:6, flexShrink:0,
                    background:"rgba(96,58,200,0.3)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace", color:"#a78bfa",
                  }}>
                    PDF
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:"#e2e0ea", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {trimName(fileName)}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:3 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", border:"1.5px solid #a78bfa", borderTopColor:"transparent", animation:"spin 0.7s linear infinite" }}/>
                      <span style={{ fontSize:10, color:"#a78bfa", fontFamily:"'DM Mono',monospace" }}>
                        extracting · batch {currentBatch + 1}/{MOCK_BATCHES.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {recentFiles.map(f => {
                const isActive = activeFileId === f.id;
                const statusCfg = {
                  completed: { dot:"#4ade80", label:"done",    bg:"rgba(22,163,74,0.15)",   border:"rgba(22,163,74,0.3)",   text:"#4ade80" },
                  failed:    { dot:"#f87171", label:"failed",  bg:"rgba(239,68,68,0.1)",    border:"rgba(239,68,68,0.25)",  text:"#f87171" },
                  queued:    { dot:"#fbbf24", label:"queued",  bg:"rgba(251,191,36,0.08)",  border:"rgba(251,191,36,0.2)",  text:"#fbbf24" },
                }[f.status] || { dot:"#888", label:"unknown", bg:"rgba(0,0,0,0.1)", border:"rgba(0,0,0,0.2)", text:"#888" };

                return (
                  <div
                    key={f.id}
                    onClick={() => { if(f.status === "completed") setActiveFileId(isActive ? null : f.id); }}
                    style={{
                      borderRadius:8, padding:"9px 10px",
                      background: isActive ? "rgba(96,58,200,0.18)" : "rgba(255,255,255,0.03)",
                      border: isActive ? "1px solid rgba(96,58,200,0.4)" : "1px solid rgba(255,255,255,0.07)",
                      display:"flex", alignItems:"center", gap:10,
                      cursor: f.status === "completed" ? "pointer" : "default",
                      transition:"all 0.18s",
                    }}
                    onMouseEnter={e => { if(!isActive && f.status==="completed") e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
                  >
                    {/* File type badge */}
                    <div style={{
                      width:30, height:30, borderRadius:6, flexShrink:0,
                      background: f.status==="failed" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:9, fontWeight:700, fontFamily:"'DM Mono',monospace",
                      color: f.status==="failed" ? "#f87171" : "rgba(255,255,255,0.4)",
                    }}>
                      {fileExt(f.name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color: f.status==="failed" ? "rgba(255,255,255,0.4)" : "#e2e0ea", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {trimName(f.name)}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
                        {/* Status dot + label */}
                        <div style={{ display:"flex", alignItems:"center", gap:3 }}>
                          <div style={{ width:5, height:5, borderRadius:"50%", background:statusCfg.dot, flexShrink:0 }}/>
                          <span style={{ fontSize:10, color:statusCfg.text, fontFamily:"'DM Mono',monospace" }}>
                            {statusCfg.label}
                          </span>
                        </div>
                        {f.courses > 0 && (
                          <>
                            <span style={{ color:"rgba(255,255,255,0.15)", fontSize:10 }}>·</span>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontFamily:"'DM Mono',monospace" }}>
                              {f.courses} courses
                            </span>
                          </>
                        )}
                        <span style={{ color:"rgba(255,255,255,0.15)", fontSize:10 }}>·</span>
                        <span style={{ fontSize:10, color:"rgba(255,255,255,0.25)" }}>{relTime(f.ts)}</span>
                      </div>
                    </div>

                    {/* Active check / load indicator */}
                    {f.status === "completed" && (
                      <div style={{
                        width:18, height:18, borderRadius:4, flexShrink:0,
                        background: isActive ? "#603AC8" : "transparent",
                        border: isActive ? "none" : "1px solid rgba(255,255,255,0.12)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        transition:"all 0.15s",
                      }}>
                        {isActive && (
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        )}
                      </div>
                    )}
                    {f.status === "failed" && (
                      <div style={{ width:18, height:18, borderRadius:4, background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}

              {recentFiles.length === 0 && status !== STATUS.EXTRACTING && (
                <div style={{ textAlign:"center", padding:"16px 8px", color:"rgba(255,255,255,0.2)", fontSize:12 }}>
                  No recent extractions
                </div>
              )}
            </div>
          </div>

          {/* ── ACTION BUTTONS ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:"auto" }}>
            <button
              onClick={startExtraction}
              disabled={isRunning}
              style={{
                padding:"12px 0", borderRadius:10, border:"none",
                background: isRunning ? "rgba(96,58,200,0.3)" : "linear-gradient(135deg, #603AC8, #31225C)",
                color:"#fff", fontSize:14, fontWeight:700, cursor: isRunning ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                transition:"all 0.2s",
              }}
            >
              {status === STATUS.EXTRACTING ? (
                <>
                  <div style={{ width:14, height:14, border:"2px solid #fff", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                  Extracting…
                </>
              ) : "⚡ Extract Courses"}
            </button>

            {(status === STATUS.DONE || status === STATUS.RECHECK_DONE) && (
              <button
                onClick={startRecheck}
                disabled={status === STATUS.RECHECKING}
                style={{
                  padding:"10px 0", borderRadius:10,
                  border:"1px solid rgba(96,58,200,0.5)",
                  background:"rgba(96,58,200,0.12)",
                  color:"#a78bfa", fontSize:13, fontWeight:600, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}
              >
                {status === STATUS.RECHECKING ? (
                  <>
                    <div style={{ width:12, height:12, border:"2px solid #a78bfa", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }}/>
                    Rechecking…
                  </>
                ) : (
                  <><RefreshIcon /> Recheck for Missed</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", padding:20, gap:16 }}>

          {/* ── PIPELINE + BATCH INSIGHTS ── */}
          {status !== STATUS.IDLE && (
            <div style={{
              background:"#1a1229", border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:12, padding:"16px 20px",
            }}>
              {/* Pipeline header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.5)", letterSpacing:0.5 }}>
                  {status === STATUS.RECHECKING ? "RECHECKING ALL PAGES" : "EXTRACTION PIPELINE"}
                </div>
                <div style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.3)" }}>
                  {completedBatches.length} / {MOCK_BATCHES.length} batches · {allCourses.length} courses
                </div>
              </div>

              {/* Dot-step pipeline */}
              <BatchPipeline
                batches={MOCK_BATCHES}
                currentBatch={currentBatch}
                totalBatches={MOCK_BATCHES.length}
              />

              {/* Overall progress bar */}
              <div style={{ height:3, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden", marginBottom:16 }}>
                <div style={{
                  height:"100%", borderRadius:2,
                  background:"linear-gradient(90deg, #603AC8, #a78bfa)",
                  width:`${(completedBatches.length / MOCK_BATCHES.length) * 100}%`,
                  transition:"width 0.5s ease",
                }}/>
              </div>

              {/* ── BATCH INSIGHT CARDS ── */}
              {(() => {
                const maxCourses = Math.max(...completedBatches.map(b => b.courses.length), 1);
                const totalC = completedBatches.reduce((n,b) => n + b.courses.length, 0);
                return (
                  <div style={{
                    display:"flex", gap:8, overflowX:"auto", paddingBottom:4,
                  }}>
                    {MOCK_BATCHES.map((batch, i) => {
                      const done = i < completedBatches.length;
                      const active = i === currentBatch && status === STATUS.EXTRACTING;
                      const batchData = completedBatches[i];
                      const count = batchData ? batchData.courses.length : 0;
                      const pct = done && totalC > 0 ? Math.round((count / totalC) * 100) : 0;
                      const fillPct = done ? Math.round((count / maxCourses) * 100) : 0;

                      return (
                        <div key={i} style={{
                          flexShrink:0, width:110,
                          borderRadius:10,
                          border:`1px solid ${
                            active ? "rgba(96,58,200,0.5)"
                            : done ? "rgba(255,255,255,0.08)"
                            : "rgba(255,255,255,0.04)"
                          }`,
                          background: active
                            ? "rgba(96,58,200,0.14)"
                            : done
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(255,255,255,0.02)",
                          padding:"10px 10px 8px",
                          transition:"all 0.3s",
                          animation: done && i === completedBatches.length - 1 ? "slideIn 0.35s ease" : "none",
                        }}>
                          {/* Page range label */}
                          <div style={{
                            fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700,
                            color: active ? "#a78bfa" : done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
                            marginBottom:6, letterSpacing:0.3,
                          }}>
                            PG {batch.pages}
                          </div>

                          {/* Course count — big number */}
                          {active ? (
                            <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:6 }}>
                              <div style={{ width:10, height:10, border:"1.5px solid #a78bfa", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite", flexShrink:0 }}/>
                              <span style={{ fontSize:11, color:"#a78bfa", fontFamily:"'DM Mono',monospace" }}>scanning…</span>
                            </div>
                          ) : done ? (
                            <div style={{ marginBottom:6 }}>
                              <span style={{ fontSize:22, fontWeight:700, color:"#e2e0ea", fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                                {count}
                              </span>
                              <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginLeft:3 }}>courses</span>
                            </div>
                          ) : (
                            <div style={{ marginBottom:6, height:28, display:"flex", alignItems:"center" }}>
                              <div style={{
                                height:6, width:"100%", borderRadius:3,
                                background:"rgba(255,255,255,0.05)",
                                overflow:"hidden",
                              }}>
                                <div style={{ width:"30%", height:"100%", borderRadius:3, background:"rgba(255,255,255,0.07)", animation:"shimmer 1.5s infinite", backgroundImage:"linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", backgroundSize:"200px 100%" }}/>
                              </div>
                            </div>
                          )}

                          {/* Fill bar — shows relative density vs other batches */}
                          {done && (
                            <>
                              <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden", marginBottom:5 }}>
                                <div style={{
                                  height:"100%", borderRadius:2,
                                  background:`linear-gradient(90deg, #603AC8, #a78bfa)`,
                                  width:`${fillPct}%`,
                                  transition:"width 0.6s ease",
                                }}/>
                              </div>
                              {/* % share of total */}
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <span style={{ fontSize:9, color:"rgba(255,255,255,0.25)", fontFamily:"'DM Mono',monospace" }}>
                                  {pct}% of total
                                </span>
                                <span style={{ fontSize:9, color:"#603AC8", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>
                                  ✓
                                </span>
                              </div>
                            </>
                          )}

                          {!done && !active && (
                            <div style={{ fontSize:9, color:"rgba(255,255,255,0.15)", fontFamily:"'DM Mono',monospace", marginTop:2 }}>
                              pending
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Summary card — shown after all done */}
                    {status === STATUS.DONE && completedBatches.length === MOCK_BATCHES.length && (
                      <div style={{
                        flexShrink:0, width:110,
                        borderRadius:10,
                        border:"1px solid rgba(96,58,200,0.3)",
                        background:"linear-gradient(135deg, rgba(96,58,200,0.15), rgba(49,34,92,0.2))",
                        padding:"10px 10px 8px",
                        animation:"slideIn 0.4s ease",
                      }}>
                        <div style={{ fontSize:10, fontFamily:"'DM Mono',monospace", fontWeight:700, color:"rgba(255,255,255,0.4)", marginBottom:6, letterSpacing:0.3 }}>
                          TOTAL
                        </div>
                        <div style={{ marginBottom:6 }}>
                          <span style={{ fontSize:22, fontWeight:700, color:"#a78bfa", fontFamily:"'DM Mono',monospace", lineHeight:1 }}>
                            {totalC}
                          </span>
                          <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginLeft:3 }}>courses</span>
                        </div>
                        <div style={{ height:4, background:"rgba(96,58,200,0.2)", borderRadius:2, overflow:"hidden", marginBottom:5 }}>
                          <div style={{ height:"100%", width:"100%", borderRadius:2, background:"linear-gradient(90deg,#603AC8,#a78bfa)" }}/>
                        </div>
                        <div style={{ fontSize:9, color:"#a78bfa", fontFamily:"'DM Mono',monospace" }}>
                          {completedBatches.length} batches
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Recheck banner */}
          {showRecheck && recheckNew.length > 0 && (
            <RecheckBanner
              newCourses={recheckNew}
              onAccept={acceptAll}
              onDismiss={dismissRecheck}
            />
          )}

          {/* Table Header + Search */}
          {(completedBatches.length > 0 || recheckNew.length > 0) && (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{
                display:"flex", alignItems:"center", gap:8,
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8, padding:"8px 12px", flex:1, maxWidth:320,
              }}>
                <SearchIcon />
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search courses, codes, categories…"
                  style={{
                    background:"none", border:"none", outline:"none",
                    color:"#e2e0ea", fontSize:13, width:"100%",
                  }}
                />
                {searchQ && (
                  <button onClick={() => setSearchQ("")} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", cursor:"pointer", padding:0 }}>
                    <XIcon />
                  </button>
                )}
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>
                {filtered.length} of {allCourses.length} shown
                {searchQ && ` · filtered`}
              </div>
            </div>
          )}

          {/* Live Table */}
          <div ref={tableRef} style={{ flex:1, overflowY:"auto", borderRadius:12, border:"1px solid rgba(255,255,255,0.07)" }}>
            {completedBatches.length === 0 && status === STATUS.IDLE && (
              <div style={{ padding:60, textAlign:"center", color:"rgba(255,255,255,0.2)", fontSize:14 }}>
                <div style={{ fontSize:40, marginBottom:16 }}>📄</div>
                Select a file and click Extract to begin
              </div>
            )}

            {completedBatches.length === 0 && status === STATUS.EXTRACTING && (
              <div style={{ padding:60, textAlign:"center", color:"rgba(255,255,255,0.3)", fontSize:13 }}>
                <div style={{ width:32, height:32, border:"3px solid rgba(96,58,200,0.3)", borderTopColor:"#603AC8", borderRadius:"50%", margin:"0 auto 16px", animation:"spin 0.8s linear infinite" }}/>
                Processing pages {MOCK_BATCHES[currentBatch]?.pages}…
              </div>
            )}

            {completedBatches.length > 0 && (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead style={{ position:"sticky", top:0, zIndex:10 }}>
                  <tr style={{ background:"#1a1229", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
                    {["#","Category","Course Name","Code","Grade","Credit","Length"].map(h => (
                      <th key={h} style={{
                        padding:"10px 14px", textAlign:"left",
                        fontSize:10, fontWeight:700,
                        color:"rgba(255,255,255,0.35)", letterSpacing:0.8,
                        fontFamily:"'DM Mono',monospace",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let rowNum = 0;
                    const rows: JSX.Element[] = [];
                    // Batched rows
                    completedBatches.forEach((batch, bi) => {
                      const batchCourses = batch.courses.filter((c: any) =>
                        !searchQ ||
                        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
                        c.code.toLowerCase().includes(searchQ.toLowerCase()) ||
                        c.category.toLowerCase().includes(searchQ.toLowerCase())
                      );
                      if (batchCourses.length === 0 && searchQ) return;

                      // Batch label row
                      rows.push(
                        <tr key={`batch-${bi}`} className="batch-row-new">
                          <td colSpan={7} style={{
                            padding:"8px 14px",
                            background:"rgba(255,255,255,0.025)",
                            borderTop: bi > 0 ? "1px solid rgba(255,255,255,0.05)" : "none",
                            borderBottom:"1px solid rgba(255,255,255,0.05)",
                          }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{
                                fontFamily:"'DM Mono',monospace", fontSize:10,
                                color:"#603AC8", fontWeight:700, letterSpacing:0.5,
                              }}>
                                BATCH {bi+1} · PAGES {batch.pages}
                              </span>
                              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.05)" }}/>
                              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)" }}>
                                {batchCourses.length} courses
                              </span>
                            </div>
                          </td>
                        </tr>
                      );

                      batchCourses.forEach((c: any) => {
                        rowNum++;
                        const isNew = recheckNew.some(r => r.id === c.id) && !acceptedNew.some(a => a.id === c.id);
                        const isAcc = acceptedNew.some(a => a.id === c.id);
                        rows.push(
                          <tr key={c.id}
                            className={`batch-row-new ${isNew ? "row-new" : isAcc ? "row-accepted" : ""}`}
                            style={{
                              borderBottom:"1px solid rgba(255,255,255,0.03)",
                              background: isNew ? "rgba(22,163,74,0.12)" : isAcc ? "rgba(22,163,74,0.06)" : "transparent",
                              transition:"background 0.3s",
                            }}
                          >
                            <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>{rowNum}</td>
                            <td style={{ padding:"9px 14px" }}>
                              <span className="tag" style={{ background:`${categoryColor(c.category)}22`, color:categoryColor(c.category), border:`1px solid ${categoryColor(c.category)}44` }}>
                                {c.category}
                              </span>
                            </td>
                            <td style={{ padding:"9px 14px", fontWeight:500, color:"#e2e0ea" }}>
                              {c.name}
                              {(isNew || isAcc) && (
                                <span style={{ marginLeft:6, background:"rgba(22,163,74,0.25)", color:"#4ade80", fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>
                                  {isNew ? "NEW ✦" : "ADDED ✓"}
                                </span>
                              )}
                            </td>
                            <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.4)", fontSize:11 }}>{c.code}</td>
                            <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.5)" }}>{c.grade}</td>
                            <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.5)" }}>{c.credit}</td>
                            <td style={{ padding:"9px 14px" }}>
                              <span style={{
                                fontFamily:"'DM Mono',monospace", fontSize:10,
                                color: c.length === "Y" ? "#67e8f9" : "#fbbf24",
                              }}>
                                {c.length === "Y" ? "Full Year" : "Semester"}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    });

                    // Accepted new courses as their own section
                    if (acceptedNew.length > 0) {
                      const accFiltered = acceptedNew.filter(c =>
                        !searchQ ||
                        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
                        c.code.toLowerCase().includes(searchQ.toLowerCase())
                      );
                      if (accFiltered.length > 0) {
                        rows.push(
                          <tr key="recheck-batch">
                            <td colSpan={7} style={{ padding:"8px 14px", background:"rgba(22,163,74,0.06)", borderTop:"1px solid rgba(22,163,74,0.2)", borderBottom:"1px solid rgba(22,163,74,0.1)" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#4ade80", fontWeight:700, letterSpacing:0.5 }}>
                                  RECHECK ADDITIONS · {acceptedNew.length} COURSES
                                </span>
                                <div style={{ flex:1, height:1, background:"rgba(22,163,74,0.2)" }}/>
                              </div>
                            </td>
                          </tr>
                        );
                        accFiltered.forEach(c => {
                          rowNum++;
                          rows.push(
                            <tr key={`acc-${c.id}`} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:"rgba(22,163,74,0.06)" }}>
                              <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>{rowNum}</td>
                              <td style={{ padding:"9px 14px" }}>
                                <span className="tag" style={{ background:`${categoryColor(c.category)}22`, color:categoryColor(c.category), border:`1px solid ${categoryColor(c.category)}44` }}>
                                  {c.category}
                                </span>
                              </td>
                              <td style={{ padding:"9px 14px", fontWeight:500, color:"#e2e0ea" }}>
                                {c.name}
                                <span style={{ marginLeft:6, background:"rgba(22,163,74,0.25)", color:"#4ade80", fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>
                                  ADDED ✓
                                </span>
                              </td>
                              <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.4)", fontSize:11 }}>{c.code}</td>
                              <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.5)" }}>{c.grade}</td>
                              <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.5)" }}>{c.credit}</td>
                              <td style={{ padding:"9px 14px" }}>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color: c.length === "Y" ? "#67e8f9" : "#fbbf24" }}>
                                  {c.length === "Y" ? "Full Year" : "Semester"}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      }
                    }

                    // Pending recheck new courses (not yet accepted)
                    if (showRecheck && recheckNew.length > 0) {
                      const pendFiltered = recheckNew.filter(c =>
                        !acceptedNew.some(a => a.id === c.id) && (!searchQ ||
                        c.name.toLowerCase().includes(searchQ.toLowerCase()) ||
                        c.code.toLowerCase().includes(searchQ.toLowerCase()))
                      );
                      if (pendFiltered.length > 0) {
                        rows.push(
                          <tr key="pending-batch">
                            <td colSpan={7} style={{ padding:"8px 14px", background:"rgba(22,163,74,0.06)", borderTop:"1px solid rgba(22,163,74,0.2)", borderBottom:"1px solid rgba(22,163,74,0.1)" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"#86efac", fontWeight:700, letterSpacing:0.5 }}>
                                  ✦ MISSED COURSES FOUND · PENDING REVIEW
                                </span>
                                <div style={{ flex:1, height:1, background:"rgba(22,163,74,0.2)" }}/>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)" }}>
                                  {pendFiltered.length} courses
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                        pendFiltered.forEach(c => {
                          rowNum++;
                          rows.push(
                            <tr key={`new-${c.id}`} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:"rgba(22,163,74,0.12)" }}>
                              <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.2)", fontFamily:"'DM Mono',monospace", fontSize:11 }}>{rowNum}</td>
                              <td style={{ padding:"9px 14px" }}>
                                <span className="tag" style={{ background:`${categoryColor(c.category)}22`, color:categoryColor(c.category), border:`1px solid ${categoryColor(c.category)}44` }}>
                                  {c.category}
                                </span>
                              </td>
                              <td style={{ padding:"9px 14px", fontWeight:500, color:"#e2e0ea" }}>
                                {c.name}
                                <span style={{ marginLeft:6, background:"rgba(22,163,74,0.3)", color:"#4ade80", fontSize:9, padding:"1px 6px", borderRadius:3, fontWeight:700, fontFamily:"'DM Mono',monospace" }}>
                                  NEW ✦
                                </span>
                              </td>
                              <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.4)", fontSize:11 }}>{c.code}</td>
                              <td style={{ padding:"9px 14px", color:"rgba(255,255,255,0.5)" }}>{c.grade}</td>
                              <td style={{ padding:"9px 14px", fontFamily:"'DM Mono',monospace", color:"rgba(255,255,255,0.5)" }}>{c.credit}</td>
                              <td style={{ padding:"9px 14px" }}>
                                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:10, color: c.length === "Y" ? "#67e8f9" : "#fbbf24" }}>
                                  {c.length === "Y" ? "Full Year" : "Semester"}
                                </span>
                              </td>
                            </tr>
                          );
                        });
                      }
                    }

                    return rows;
                  })()}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}

// ─── ASK PLACEHOLDER ─────────────────────────────────────────────────────────
function AskPlaceholder() {
  const suggestions = [
    "Which schools offer AP Calculus but not AP Statistics?",
    "What % of courses in Lincoln High are STEM?",
    "Show me all courses with missing credit values",
    "Compare course offerings between two districts",
  ];
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"#0d0b14", padding:40, gap:32,
      height:"calc(100vh - 60px)",
    }}>
      {/* Glow orb */}
      <div style={{
        width:72, height:72, borderRadius:"50%",
        background:"linear-gradient(135deg, #603AC8 0%, #31225C 100%)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:32,
        boxShadow:"0 0 0 12px rgba(96,58,200,0.1), 0 0 0 28px rgba(96,58,200,0.05)",
      }}>💬</div>

      <div style={{ textAlign:"center", maxWidth:480 }}>
        <div style={{ fontSize:24, fontWeight:700, color:"#fff", marginBottom:10, letterSpacing:"-0.5px" }}>
          Ask anything about your courses
        </div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.7 }}>
          Query your extracted course data in plain English. Filter, compare, and surface insights across all your schools and districts.
        </div>
      </div>

      {/* Fake search bar */}
      <div style={{
        width:"100%", maxWidth:540,
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:14, padding:"14px 18px",
        display:"flex", alignItems:"center", gap:10,
        opacity:0.5, cursor:"not-allowed",
      }}>
        <span style={{ fontSize:16 }}>💬</span>
        <span style={{ fontSize:14, color:"rgba(255,255,255,0.25)", fontStyle:"italic" }}>
          Ask a question about your course data…
        </span>
        <div style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:7, background:"rgba(96,58,200,0.3)", fontSize:11, color:"#a78bfa", fontWeight:600 }}>
          Enter ↵
        </div>
      </div>

      {/* Suggestion chips */}
      <div style={{ display:"flex", flexDirection:"column", gap:8, width:"100%", maxWidth:540 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", letterSpacing:0.8, fontFamily:"'DM Mono',monospace", marginBottom:2 }}>
          EXAMPLE QUERIES
        </div>
        {suggestions.map((s, i) => (
          <div key={i} style={{
            padding:"10px 14px", borderRadius:9,
            background:"rgba(255,255,255,0.03)",
            border:"1px solid rgba(255,255,255,0.06)",
            fontSize:13, color:"rgba(255,255,255,0.35)",
            cursor:"not-allowed",
            display:"flex", alignItems:"center", gap:10,
          }}>
            <span style={{ fontSize:12, color:"rgba(96,58,200,0.5)" }}>→</span>
            {s}
          </div>
        ))}
      </div>

      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"8px 16px", borderRadius:20,
        background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)",
        fontSize:12, color:"#fbbf24",
      }}>
        <span>🚧</span> This module is under development — extract data first
      </div>
    </div>
  );
}

// ─── MINE DATA (See continuation in next message due to length) ──────────────
function MinePlaceholder() {
  return (
    <div style={{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      background:"#0d0b14", padding:40, gap:32,
      height:"calc(100vh - 60px)",
    }}>
      <div style={{
        width:72, height:72, borderRadius:"50%",
        background:"linear-gradient(135deg, #603AC8 0%, #31225C 100%)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:32,
        boxShadow:"0 0 0 12px rgba(96,58,200,0.1), 0 0 0 28px rgba(96,58,200,0.05)",
      }}>⛏</div>

      <div style={{ textAlign:"center", maxWidth:480 }}>
        <div style={{ fontSize:24, fontWeight:700, color:"#fff", marginBottom:10, letterSpacing:"-0.5px" }}>
          Mine & Map Your Data
        </div>
        <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.7 }}>
          Analyze extracted courses, view mapping results, inspect your Supabase schema, and explore the entity relationships across all tables.
        </div>
      </div>

      <div style={{
        display:"flex", alignItems:"center", gap:8,
        padding:"8px 16px", borderRadius:20,
        background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.2)",
        fontSize:12, color:"#fbbf24",
      }}>
        <span>🚧</span> This module is under development
      </div>
    </div>
  );
}
