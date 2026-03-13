'use client'

import { Header } from '@/components/Header'
import { AlertCircle, MessageSquare, MoveRight } from 'lucide-react'

export default function AskPage() {

  const suggestions = [
    "Which schools offer AP Calculus but not AP Statistics?",
    "What % of courses in Lincoln High are STEM?",
    "Show me all courses with missing credit values",
    "Compare course offerings between two districts",
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d0b14', color: '#e2e0ea', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', scrollbarGutter: 'stable' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        button:hover { opacity: 0.88; }
      `}</style>

      {/* Header */}
      <Header />

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 32, overflow: 'auto' }}>
        {/* Glow orb */}
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #603AC8 0%, #31225C 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 12px rgba(96,58,200,0.1), 0 0 0 28px rgba(96,58,200,0.05)' }}>
          <MessageSquare size={30} color='#fff' strokeWidth={2.2} />
        </div>

        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 10, letterSpacing: '-0.5px' }}>
            Ask anything about your courses
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
            Query your extracted course data in plain English. Filter, compare, and surface insights across all your schools and districts.
          </div>
        </div>

        {/* Fake search bar */}
        <div style={{ width: '100%', maxWidth: 540, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5, cursor: 'not-allowed' }}>
          <MessageSquare size={16} color='rgba(255,255,255,0.5)' strokeWidth={2.1} />
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
            Ask a question about your course data…
          </span>
          <div style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 7, background: 'rgba(96,58,200,0.3)', fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>
            Enter ↵
          </div>
        </div>

        {/* Suggestion chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 540 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.8, fontFamily: "'DM Mono',monospace", marginBottom: 2 }}>
            EXAMPLE QUERIES
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: 'rgba(255,255,255,0.35)', cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 10 }}>
              <MoveRight size={12} color='rgba(96,58,200,0.5)' strokeWidth={2.2} />
              {s}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: 12, color: '#fbbf24' }}>
          <AlertCircle size={14} color='#fbbf24' strokeWidth={2.2} /> This module is under development - extract data first
        </div>
      </div>
    </div>
  )
}
