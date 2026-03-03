'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Plus } from 'lucide-react'
import type { Member } from '@/types/member'
import type { Edge } from '@/lib/mock-data'
import { WebCanvas } from './web-canvas'
import { MobileGrid } from './mobile-grid'

interface HomeClientProps {
  members: Member[]
  edges: Edge[]
}

export function HomeClient({ members, edges }: HomeClientProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [splashFading, setSplashFading] = useState(false)
  const [showHint, setShowHint] = useState(true)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!showHint) return
    const timer = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(timer)
  }, [showHint])

  const dismissSplash = useCallback(() => {
    setSplashFading(true)
    setTimeout(() => setShowSplash(false), 700)
  }, [])

  useEffect(() => {
    if (!showSplash) return
    const timer = setTimeout(dismissSplash, 3600)
    return () => clearTimeout(timer)
  }, [showSplash, dismissSplash])

  if (!mounted) {
    return <div className="min-h-screen" style={{ background: 'var(--bg)' }} />
  }

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ═══ Splash screen ═══ */}
      {showSplash && (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center px-6"
          style={{
            zIndex: 100,
            backgroundColor: 'var(--bg)',
            opacity: splashFading ? 0 : 1,
            transition: 'opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: splashFading ? 'none' : 'auto',
          }}
        >
          <h1
            className="text-center leading-none select-none"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              color: 'var(--text)',
              fontSize: 'clamp(3.5rem, 12vw, 10rem)',
              letterSpacing: '0.03em',
              animation: 'fadeInUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
          >
            SYDE <span style={{ color: 'var(--accent-1)' }}>30</span>
          </h1>

          <p
            className="font-mono text-center mt-5"
            style={{
              color: 'var(--text-muted)',
              fontSize: 'clamp(0.6rem, 1.4vw, 0.75rem)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              animation: 'fadeInUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
            }}
          >
            {members.length} nodes connected
          </p>

          <div
            className="mt-10"
            style={{
              width: '32px',
              height: '1px',
              backgroundColor: 'var(--border)',
              animation: 'fadeInUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both',
            }}
          />

          <button
            onClick={dismissSplash}
            className="mt-8 font-mono text-xs uppercase tracking-[0.2em] cursor-pointer transition-colors duration-300"
            style={{
              color: 'var(--text-secondary)',
              background: 'none',
              border: 'none',
              padding: '8px 0',
              animation: 'fadeInUp 0.9s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            Enter the web
          </button>
        </div>
      )}

      {/* ═══ Top navigation ═══ */}
      <nav
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 py-4 md:px-8 md:py-5"
        style={{
          zIndex: 50,
          background: 'linear-gradient(to bottom, var(--bg), transparent)',
        }}
      >
        {/* Wordmark */}
        <div className="flex items-baseline gap-1.5 select-none">
          <span
            className="text-xl md:text-2xl tracking-[0.04em] uppercase leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--text)' }}
          >
            SYDE
          </span>
          <span
            className="text-xl md:text-2xl tracking-[0.04em] uppercase leading-none"
            style={{ fontFamily: "'Bebas Neue', sans-serif", color: 'var(--accent-1)' }}
          >
            30
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          <span
            className="hidden md:block font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--text-muted)' }}
          >
            {members.length} in the web
          </span>
          <Link
            href="/join"
            className="group flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-300 active:scale-[0.96]"
            style={{
              background: 'var(--accent-1)',
              color: '#fff',
              borderRadius: '2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(232, 32, 58, 0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Join</span>
          </Link>
        </div>
      </nav>

      {/* ═══ Main content ═══ */}
      {isMobile ? (
        <MobileGrid members={members} />
      ) : (
        <>
          <WebCanvas members={members} edges={edges} />

          {/* ═══ Hero overlay - bottom left ═══ */}
          <div
            className="fixed bottom-0 left-0 px-8 pb-8 pointer-events-none"
            style={{ zIndex: 40, maxWidth: '480px' }}
          >
            <div className="flex flex-col gap-2">
              <h1
                className="text-5xl lg:text-6xl xl:text-7xl tracking-[0.02em] uppercase leading-[0.88] text-balance select-none"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  color: 'var(--text)',
                  animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both',
                }}
              >
                Into The{' '}
                <span style={{ color: 'var(--accent-1)' }}>Web</span>
              </h1>

              <p
                className="font-sans text-[13px] leading-relaxed max-w-xs"
                style={{
                  color: 'var(--text-secondary)',
                  animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.25s both',
                }}
              >
                A webring for Systems Design Engineering 2030.
                Personal sites, connected.
              </p>

              <div
                className="flex items-center gap-5 mt-3 pointer-events-auto"
                style={{ animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both' }}
              >
                <Link
                  href="/join"
                  className="group flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-all duration-300 active:scale-[0.96]"
                  style={{
                    background: 'var(--accent-1)',
                    color: '#fff',
                    borderRadius: '2px',
                    animation: 'ctaGlow 4s ease-in-out infinite',
                  }}
                >
                  Join the Web
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] uppercase tracking-[0.15em] transition-colors duration-300"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  Source
                </a>
              </div>
            </div>
          </div>

          {/* ═══ Interaction hint ═══ */}
          <div
            className="fixed bottom-8 right-8 font-mono text-[10px] uppercase tracking-[0.2em] transition-opacity duration-1000"
            style={{
              zIndex: 40,
              color: 'var(--text-muted)',
              opacity: showHint ? 0.6 : 0,
              pointerEvents: 'none',
            }}
          >
            Scroll to zoom / Drag to pan
          </div>

          {/* ═══ Bottom-right attribution ═══ */}
          <div
            className="fixed bottom-8 right-8 font-mono text-[9px] uppercase tracking-[0.2em] transition-opacity duration-1000"
            style={{
              zIndex: 40,
              color: 'var(--text-muted)',
              opacity: showHint ? 0 : 0.35,
              pointerEvents: 'none',
            }}
          >
            UWaterloo SYDE 2030
          </div>
        </>
      )}
    </main>
  )
}
