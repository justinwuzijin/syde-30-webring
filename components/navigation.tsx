'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function Navigation() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-5 md:px-10 md:py-6"
      style={{ zIndex: 50 }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: 'var(--accent-1)' }}
        />
        <span
          className="text-sm font-medium tracking-tight"
          style={{ color: 'var(--text)' }}
        >
          SYDE 30
        </span>
      </div>

      {/* CTA */}
      <Link
        href="/join"
        className="group flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest transition-all duration-200"
        style={{
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          backgroundColor: 'rgba(14, 14, 22, 0.6)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <span>Join the Web</span>
        <ArrowUpRight
          className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: 'var(--accent-1)' }}
        />
      </Link>
    </nav>
  )
}
