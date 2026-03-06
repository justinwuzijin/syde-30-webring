'use client'

import { ExternalLink, Github, Twitter, Instagram, Linkedin, Globe } from 'lucide-react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { Member } from '@/types/member'
import { getAccentColor } from '@/types/member'

const socialIcons = {
  github: Github,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  website: Globe,
} as const

function getSocialHref(platform: string, handle: string): string {
  switch (platform) {
    case 'website': return handle
    case 'github': return `https://github.com/${handle}`
    case 'twitter': return `https://twitter.com/${handle}`
    case 'instagram': return `https://instagram.com/${handle}`
    case 'linkedin': return `https://linkedin.com/in/${handle}`
    default: return '#'
  }
}

interface MobileGridProps {
  members: Member[]
}

export function MobileGrid({ members }: MobileGridProps) {
  return (
    <div className="min-h-screen px-5 pt-24 pb-12" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="mb-10">
        <h1
          className="leading-none"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: 'var(--text)',
            fontSize: '2.75rem',
            letterSpacing: '0.02em',
          }}
        >
          THE <span style={{ color: 'var(--accent-1)' }}>WEB</span>
        </h1>
        <p
          className="font-mono text-[11px] mt-2 tracking-widest uppercase"
          style={{ color: 'var(--text-muted)' }}
        >
          {members.length} members connected
        </p>
        <div
          className="mt-4"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />
      </header>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3">
        {members.map((member, i) => {
          const accent = getAccentColor(i)
          const activeSocials = Object.entries(member.socials).filter(
            ([, val]) => val && val.length > 0
          )

          return (
            <article
              key={member.id}
              className="relative overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            >
              {/* Screenshot area */}
              <div
                className="aspect-[4/3] relative"
                style={{
                  background: `linear-gradient(160deg, ${accent}06 0%, var(--bg-surface) 100%)`,
                }}
              >
                {/* Accent line at top */}
                <div
                  className="absolute top-0 left-0 right-0 h-px"
                  style={{ backgroundColor: accent, opacity: 0.4 }}
                />
                {/* Content skeleton */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                  <div className="w-[55%] h-1 rounded-full" style={{ backgroundColor: accent, opacity: 0.15 }} />
                  <div className="w-[35%] h-0.5 rounded-full" style={{ backgroundColor: accent, opacity: 0.1 }} />
                  <div className="w-[45%] h-0.5 rounded-full" style={{ backgroundColor: accent, opacity: 0.06 }} />
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="font-sans text-xs font-medium truncate"
                    style={{ color: 'var(--text)' }}
                  >
                    {member.name}
                  </span>
                  <a
                    href={member.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 transition-opacity hover:opacity-100"
                    style={{ color: accent, opacity: 0.7 }}
                    aria-label={`Visit ${member.name}'s site`}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {activeSocials.length > 0 && (
                  <div className="flex items-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
                    {activeSocials.map(([platform, handle]) => {
                      const Icon = socialIcons[platform as keyof typeof socialIcons]
                      if (!Icon) return null
                      return (
                        <a
                          key={platform}
                          href={getSocialHref(platform, handle!)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="transition-opacity hover:opacity-100"
                          style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
                          aria-label={`${member.name} on ${platform}`}
                        >
                          <Icon className="w-3 h-3" />
                        </a>
                      )
                    })}
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {/* Mobile CTA */}
      <div className="mt-10 flex justify-center">
        <Link
          href="/join"
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-medium uppercase tracking-widest transition-all duration-200"
          style={{
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <span>Join the Web</span>
          <ArrowUpRight className="w-3.5 h-3.5" style={{ color: 'var(--accent-1)' }} />
        </Link>
      </div>
    </div>
  )
}
