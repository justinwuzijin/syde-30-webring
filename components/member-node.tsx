'use client'

import { useState } from 'react'
import { ExternalLink, Github, Twitter, Instagram, Linkedin, Globe } from 'lucide-react'
import type { Member } from '@/types/member'

interface MemberNodeProps {
  member: Member
  x: number
  y: number
  size: number
  accent: string
  index: number
  isConnectedToHovered?: boolean
  onHover: (id: string | null) => void
}

function hashId(id: string): number {
  let h = 5381
  for (const c of id) {
    h = ((h << 5) + h) ^ c.charCodeAt(0)
  }
  return Math.abs(h)
}

function polygonForId(id: string): string {
  const h = hashId(id)
  const j = (seed: number) => ((seed & 0xf) - 8) * 0.6
  return `polygon(${50 + j(h)}% ${j(h >> 2)}%, ${100 - Math.abs(j(h >> 4))}% ${Math.abs(j(h >> 6))}%, ${100 - Math.abs(j(h >> 8))}% ${100 - Math.abs(j(h >> 10))}%, ${Math.abs(j(h >> 12))}% ${100 - Math.abs(j(h >> 14))}%)`
}

const socialIcons = {
  github: Github,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  website: Globe,
} as const

export function MemberNode({
  member,
  x,
  y,
  size,
  accent,
  index,
  isConnectedToHovered = false,
  onHover,
}: MemberNodeProps) {
  const [isHovered, setIsHovered] = useState(false)
  const clipPath = polygonForId(member.id)

  const activeSocials = Object.entries(member.socials).filter(
    ([, val]) => val && val.length > 0
  )

  const isActive = isHovered || isConnectedToHovered

  return (
    <div
      className="absolute cursor-pointer"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        animation: `nodeFloat 5s ease-in-out infinite`,
        animationDelay: `${index * 0.4}s`,
        zIndex: isHovered ? 20 : 10,
      }}
      onMouseEnter={() => {
        setIsHovered(true)
        onHover(member.id)
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        onHover(null)
      }}
    >
      {/* Node container */}
      <div
        className="relative w-full h-full overflow-hidden transition-all duration-200"
        style={{
          clipPath,
          outline: `${isHovered ? 3 : 2}px solid ${isActive ? accent : 'var(--border)'}`,
          boxShadow: isHovered
            ? `0 0 0 1px ${accent}, 0 8px 32px -4px ${accent}30, 0 0 24px -8px ${accent}20`
            : isConnectedToHovered
            ? `0 0 0 1px ${accent}60, 0 4px 16px -4px ${accent}15`
            : `0 0 0 1px var(--border)`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        {/* Website preview placeholder */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${accent}08 0%, var(--bg-elevated) 40%, var(--bg-surface) 100%)`,
          }}
        >
          {/* Simulated site content skeleton */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <div
              className="w-[60%] h-1 rounded-full"
              style={{ backgroundColor: accent, opacity: 0.2 }}
            />
            <div
              className="w-[40%] h-0.5 rounded-full"
              style={{ backgroundColor: accent, opacity: 0.12 }}
            />
            <div
              className="w-[50%] h-0.5 rounded-full"
              style={{ backgroundColor: accent, opacity: 0.08 }}
            />
          </div>
        </div>
      </div>

      {/* Name label */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap"
        style={{
          bottom: -28,
          opacity: isActive ? 1 : 0.7,
          transition: 'opacity 0.2s ease',
        }}
      >
        <span
          className="font-sans text-[11px] font-medium tracking-wide"
          style={{
            color: isHovered ? accent : 'var(--text)',
            animation: isHovered ? 'glitch 0.25s steps(3) infinite' : 'none',
          }}
        >
          {member.name}
        </span>
        <a
          href={member.embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-4 h-4 transition-colors duration-150"
          style={{ color: isHovered ? accent : 'var(--text-muted)' }}
          aria-label={`Visit ${member.name}'s site`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Social icons on hover */}
      {isHovered && activeSocials.length > 0 && (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5"
          style={{
            bottom: -50,
            animation: 'fadeInUp 0.2s ease forwards',
          }}
        >
          {activeSocials.map(([platform, handle]) => {
            const Icon = socialIcons[platform as keyof typeof socialIcons]
            if (!Icon) return null
            const href =
              platform === 'website'
                ? handle
                : platform === 'github'
                ? `https://github.com/${handle}`
                : platform === 'twitter'
                ? `https://twitter.com/${handle}`
                : platform === 'instagram'
                ? `https://instagram.com/${handle}`
                : platform === 'linkedin'
                ? `https://linkedin.com/in/${handle}`
                : '#'
            return (
              <a
                key={platform}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-4 h-4 transition-opacity duration-150 hover:opacity-100"
                style={{ color: 'var(--text-secondary)', opacity: 0.6 }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`${member.name} on ${platform}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
