'use client'

import { useState, useEffect } from 'react'

interface HeroOverlayProps {
  memberCount: number
  onDismiss: () => void
}

export function HeroOverlay({ memberCount, onDismiss }: HeroOverlayProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 600)
    }, 3200)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6"
      style={{
        zIndex: 100,
        backgroundColor: 'var(--bg)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Title */}
      <h1
        className="text-center leading-none"
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          color: 'var(--text)',
          fontSize: 'clamp(3.5rem, 12vw, 10rem)',
          letterSpacing: '0.02em',
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}
      >
        SYDE <span style={{ color: 'var(--accent-1)' }}>30</span>
      </h1>

      {/* Subtitle */}
      <p
        className="font-mono text-center mt-4"
        style={{
          color: 'var(--text-muted)',
          fontSize: 'clamp(0.625rem, 1.5vw, 0.8125rem)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both',
        }}
      >
        {memberCount} nodes connected
      </p>

      {/* Divider line */}
      <div
        className="mt-8 mb-6"
        style={{
          width: '40px',
          height: '1px',
          backgroundColor: 'var(--border)',
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both',
        }}
      />

      {/* Enter CTA */}
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(onDismiss, 600)
        }}
        className="font-mono text-xs uppercase tracking-widest transition-colors duration-200 cursor-pointer"
        style={{
          color: 'var(--text-secondary)',
          animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.6s both',
          background: 'none',
          border: 'none',
          padding: 0,
        }}
      >
        <span className="hover:text-foreground transition-colors duration-200">
          Enter the web
        </span>
      </button>
    </div>
  )
}
