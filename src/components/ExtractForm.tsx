'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Status = 'idle' | 'extracting' | 'done' | 'failed'

type Course = {
  id: number
  name: string
  code: string
  category: string
  grade: string
  credit: string
  length: 'Y' | 'S'
}

type ApiKey = {
  id: string
  nickname: string
  quota_remaining: number
  quota_limit: number
  is_active: boolean
}

type JobResponse = {
  id: string
  status: 'processing' | 'complete' | 'failed'
  courses_found: number
  dupes_removed: number
  total_chunks: number
  processing_ms: number | null
  error_message: string | null
  courses?: Course[]
}

type RangeOption = { label: string; start: number; end: number }

const COLORS: Record<string, string> = {
  'Visual Arts': '#7c3aed',
  'Performing Arts': '#db2777',
  Mathematics: '#0891b2',
  'Language Arts': '#059669',
  Science: '#d97706',
  'Social Studies': '#dc2626',
  General: '#6b7280',
}

const STATE_OPTIONS = ['Florida', 'Texas', 'California']

function detectPdfPageCount(text: string): number {
  const matches = [...text.matchAll(/\/Count\s+(\d+)/g)]
  const values = matches.map(m => parseInt(m[1], 10)).filter(n => Number.isFinite(n) && n > 0 && n < 100000)
  if (values.length > 0) return Math.max(...values)
  const pageMatches = text.match(/\/Type\s*\/Page(?!s)/g)
  if (pageMatches?.length) return pageMatches.length
  return 1
}

function buildRanges(totalPages: number): RangeOption[] {
  const ranges: RangeOption[] = []
  for (let page = 1; page <= totalPages; page += 5) {
    const start = page
    const end = Math.min(page + 4, totalPages)
    ranges.push({ start, end, label: `Pages ${start}–${end}` })
  }
  return ranges
}

function relTime(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

export function ExtractForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [schoolName, setSchoolName] = useState('')
  const [state, setState] = useState('Florida')
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('Drop PDF here')
  const [isDragging, setIsDragging] = useState(false)

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [selectedApiKey, setSelectedApiKey] = useState('auto')

  const [totalPages, setTotalPages] = useState<number>(0)
  const [selectedRange, setSelectedRange] = useState('all')
  const [searchQ, setSearchQ] = useState('')

  const [uploadId, setUploadId] = useState<string | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [error, setError] = useState<string | null>(null)

  const [recent, setRecent] = useState<Array<{ id: string; name: string; status: 'completed' | 'failed'; courses: number; ts: number }>>([])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const ranges = useMemo(() => (totalPages > 0 ? buildRanges(totalPages) : []), [totalPages])

  const filteredCourses = useMemo(
    () =>
      courses.filter(course =>
        !searchQ ||
        course.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        course.code.toLowerCase().includes(searchQ.toLowerCase()) ||
        course.category.toLowerCase().includes(searchQ.toLowerCase())
      ),
    [courses, searchQ]
  )

  useEffect(() => {
    const loadKeys = async () => {
      try {
        const res = await fetch('/api/v2/quota/available-keys')
        const data = await res.json()
        setApiKeys(Array.isArray(data.keys) ? data.keys : [])
      } catch {
        setApiKeys([])
      }
    }
    loadKeys()
  }, [])

  useEffect(() => {
    if (status === 'extracting') {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  const pollStatus = useCallback(async (id: string) => {
    for (let i = 0; i < 180; i++) {
      let data: JobResponse | null = null
      try {
        const res = await fetch(`/api/extract/${id}`)
        data = await res.json()
      } catch {
        await new Promise(resolve => setTimeout(resolve, 1500))
        continue
      }

      if (!data) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        continue
      }

      if (data.status === 'complete') {
        setCourses(Array.isArray(data.courses) ? data.courses : [])
        setStatus('done')
        setRecent(prev => [
          { id, name: fileName, status: 'completed', courses: data.courses_found ?? 0, ts: Date.now() },
          ...prev.slice(0, 9),
        ])
        return
      }

      if (data.status === 'failed') {
        setStatus('failed')
        setError(data.error_message || 'Extraction failed')
        setRecent(prev => [
          { id, name: fileName, status: 'failed', courses: 0, ts: Date.now() },
          ...prev.slice(0, 9),
        ])
        return
      }

      await new Promise(resolve => setTimeout(resolve, 1500))
    }

    setStatus('failed')
    setError('Timed out waiting for extraction result')
  }, [fileName])

  const handleFile = async (incoming: File) => {
    setFile(incoming)
    setFileName(incoming.name)
    setError(null)

    try {
      const buff = await incoming.arrayBuffer()
      const text = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buff))
      const pages = detectPdfPageCount(text)
      setTotalPages(pages)
      setSelectedRange('all')
    } catch {
      setTotalPages(1)
      setSelectedRange('all')
    }
  }

  const handleExtract = async () => {
    if (!file) return setError('Please upload a PDF')
    if (!schoolName.trim()) return setError('Please enter school name')

    setStatus('extracting')
    setElapsed(0)
    setCourses([])
    setError(null)

    const formData = new FormData()
    formData.append('school_name', schoolName.trim())
    formData.append('state', state)
    formData.append('file', file)

    if (selectedApiKey !== 'auto') {
      formData.append('api_key_id', selectedApiKey)
    }

    if (selectedRange !== 'all') {
      const [start, end] = selectedRange.split('-').map(v => parseInt(v, 10))
      if (start && end) {
        formData.append('page_start', `${start}`)
        formData.append('page_end', `${end}`)
      }
    }

    const res = await fetch('/api/extract', { method: 'POST', body: formData })
    const payload = await res.json()

    if (!res.ok) {
      setStatus('failed')
      setError(payload.error || 'Extraction failed')
      return
    }

    setUploadId(payload.upload_id)
    await pollStatus(payload.upload_id)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0b14', color: '#e2e0ea', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        @media (max-width:1024px){.layout{flex-direction:column;height:auto!important}.left{width:100%!important;border-right:none!important;border-bottom:1px solid rgba(255,255,255,.07)}}
        @media (max-width:640px){.panel{padding:14px!important}.hide-sm{display:none!important}}
      `}</style>

      <div style={{ background: 'linear-gradient(135deg, #1a1229 0%, #0d0b14 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #603AC8, #31225C)', display: 'grid', placeItems: 'center' }}>📚</div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Planpaths Course Extractor</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: "'DM Mono', monospace" }}>Powered by Gemini 2.5 Flash</div>
          </div>
        </div>
        <div className='hide-sm' style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', fontFamily: "'DM Mono', monospace" }}>
          {uploadId ? `Upload ${uploadId.slice(0, 8)}...` : 'Ready'}
        </div>
      </div>

      <div className='layout' style={{ flex: 1, display: 'flex', height: 'calc(100vh - 61px)', overflow: 'hidden' }}>
        <div className='left panel' style={{ width: 320, borderRight: '1px solid rgba(255,255,255,0.07)', padding: 20, background: '#110e1c', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>SCHOOL</div>
            <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder='School name' style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e0ea' }} />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>STATE</div>
            <select value={state} onChange={e => setState(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e0ea' }}>
              {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>SOURCE FILE</div>
            <input ref={fileInputRef} type='file' accept='.pdf' style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
            <div onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f) }} style={{ border: `2px dashed ${isDragging ? '#603AC8' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(96,58,200,.1)' : 'rgba(255,255,255,.02)' }}>
              <div style={{ marginBottom: 6, color: 'rgba(255,255,255,.3)' }}>⬆</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginBottom: 4 }}>{fileName}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>PDF · max 50MB</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>API KEY</div>
            <select value={selectedApiKey} onChange={e => setSelectedApiKey(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e0ea' }}>
              <option value='auto'>🤖 Auto-select best key</option>
              {apiKeys.map(k => (
                <option key={k.id} value={k.id} disabled={!k.is_active}>
                  {k.nickname} ({k.quota_remaining}/{k.quota_limit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 8 }}>PAGE RANGE</div>
            <select value={selectedRange} onChange={e => setSelectedRange(e.target.value)} disabled={!file} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: '#e2e0ea' }}>
              <option value='all'>All pages (1–{Math.max(totalPages, 1)})</option>
              {ranges.map(r => <option key={`${r.start}-${r.end}`} value={`${r.start}-${r.end}`}>{r.label}</option>)}
            </select>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>{totalPages > 0 ? `Detected ${totalPages} pages` : 'Upload a PDF to detect pages'}</div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleExtract} disabled={status === 'extracting'} style={{ padding: '12px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #603AC8, #31225C)', color: '#fff', fontWeight: 700, cursor: status === 'extracting' ? 'not-allowed' : 'pointer', opacity: status === 'extracting' ? 0.6 : 1 }}>
              {status === 'extracting' ? `Extracting… ${elapsed}s` : '⚡ Extract Courses'}
            </button>
            {error && <div style={{ fontSize: 12, color: '#fca5a5', background: 'rgba(127,29,29,.35)', border: '1px solid rgba(248,113,113,.35)', borderRadius: 8, padding: '8px 10px' }}>{error}</div>}
          </div>
        </div>

        <div className='panel' style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16, overflow: 'hidden' }}>
          <div style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.07)', background: '#1a1229', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontWeight: 600 }}>{status === 'extracting' ? 'EXTRACTION IN PROGRESS' : 'EXTRACTION OUTPUT'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', fontFamily: "'DM Mono', monospace" }}>{filteredCourses.length} courses</div>
            </div>
            <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
              <div style={{ width: status === 'idle' ? '0%' : status === 'extracting' ? '65%' : '100%', height: '100%', background: 'linear-gradient(90deg,#603AC8,#a78bfa)', transition: 'width .3s ease' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, background: 'rgba(255,255,255,.05)', padding: '8px 12px', maxWidth: 340, width: '100%' }}>
              <span style={{ opacity: 0.6 }}>🔍</span>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder='Search courses, codes, categories…' style={{ border: 'none', outline: 'none', width: '100%', background: 'none', color: '#e2e0ea' }} />
            </div>
            <div className='hide-sm' style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', fontFamily: "'DM Mono', monospace" }}>{filteredCourses.length} shown</div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12 }}>
            {filteredCourses.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'rgba(255,255,255,.2)' }}>{status === 'extracting' ? 'Processing PDF…' : 'No courses yet. Run extraction to see results.'}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr style={{ background: '#1a1229', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    {['#', 'Category', 'Course Name', 'Code', 'Grade', 'Credit', 'Length'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, letterSpacing: 0.8, color: 'rgba(255,255,255,.35)', fontFamily: "'DM Mono', monospace" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((course, index) => (
                    <tr key={course.id} style={{ borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,.22)', fontFamily: "'DM Mono', monospace" }}>{index + 1}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${(COLORS[course.category] || '#6b7280')}22`, border: `1px solid ${(COLORS[course.category] || '#6b7280')}44`, color: COLORS[course.category] || '#6b7280' }}>{course.category}</span>
                      </td>
                      <td style={{ padding: '9px 14px', color: '#e2e0ea' }}>{course.name}</td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,.45)', fontFamily: "'DM Mono', monospace" }}>{course.code}</td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,.55)' }}>{course.grade}</td>
                      <td style={{ padding: '9px 14px', color: 'rgba(255,255,255,.55)', fontFamily: "'DM Mono', monospace" }}>{course.credit}</td>
                      <td style={{ padding: '9px 14px', color: course.length === 'Y' ? '#67e8f9' : '#fbbf24', fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{course.length === 'Y' ? 'Full Year' : 'Semester'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: "'DM Mono', monospace" }}>
            {recent.length > 0 ? recent.map(r => `${r.name} · ${r.status} · ${r.courses} courses · ${relTime(r.ts)}`).join('  |  ') : 'No recent extraction runs'}
          </div>
        </div>
      </div>
    </div>
  )
}
