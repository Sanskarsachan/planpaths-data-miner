'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [])

  const handleLogout = async () => {
    if (isLoggingOut) return

    setIsLoggingOut(true)
    setMenuOpen(false)

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Continue with redirect even if sign out provider is unavailable.
    } finally {
      setIsLoggingOut(false)
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1a1229 0%, #0d0b14 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 60,
        flexShrink: 0,
        gap: 12,
        contain: 'layout style paint',
        willChange: 'transform',
      }}
    >
      {/* LEFT — logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            background: 'linear-gradient(135deg, #603AC8, #31225C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          📚
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            Planpaths
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            Gemini 2.5 Flash
          </div>
        </div>
      </div>

      {/* CENTER — pill tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          padding: 3,
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          maxWidth: '70vw',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {[
          { id: 'ask', label: 'Ask', icon: '💬', desc: 'Query your data', path: '/ask' },
          { id: 'extract', label: 'Extract', icon: '⚡', desc: 'Harvest courses from PDFs', path: '/extract' },
          { id: 'mine', label: 'Mine', icon: '⛏', desc: 'Analyze & map courses', path: '/mine' },
        ].map(tab => {
          const isActive = pathname === tab.path
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              title={tab.desc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 18px',
                borderRadius: 9,
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, #603AC8, #31225C)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: isActive ? '-0.2px' : '0',
                position: 'relative',
                boxShadow: isActive ? '0 2px 12px rgba(96,58,200,0.4)' : 'none',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{tab.icon}</span>
              <span>{tab.label}</span>
              {isActive && (
                <span
                  style={{
                    position: 'absolute',
                    bottom: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: '#a78bfa',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      {/* RIGHT — profile menu */}
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(prev => !prev)}
          title='Account'
          aria-haspopup='menu'
          aria-expanded={menuOpen}
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'linear-gradient(135deg, rgba(167,139,250,.28), rgba(96,58,200,.38))',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: menuOpen ? '0 0 0 3px rgba(167,139,250,.18)' : 'none',
            transition: 'box-shadow .2s ease',
          }}
        >
          U
        </button>

        {menuOpen && (
          <div
            role='menu'
            style={{
              position: 'absolute',
              right: 0,
              top: 42,
              minWidth: 152,
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#140f23',
              boxShadow: '0 12px 30px rgba(0,0,0,.35)',
              padding: 6,
              zIndex: 100,
            }}
          >
            <button
              role='menuitem'
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,.78)',
                borderRadius: 7,
                padding: '8px 10px',
                textAlign: 'left',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'DM Sans', sans-serif",
                cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                opacity: isLoggingOut ? 0.6 : 1,
              }}
            >
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
