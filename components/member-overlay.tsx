'use client'

import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Member } from '@/types/member'
import { getAccentColor } from '@/types/member'

interface MemberOverlayProps {
  member: Member | null
  memberIndex: number
  onClose: () => void
}

function socialHref(platform: string, handle: string): string {
  if (!handle) return '#'
  if (platform === 'website') return handle.startsWith('http') ? handle : `https://${handle}`
  if (platform === 'github')    return `https://github.com/${handle}`
  if (platform === 'twitter')   return `https://twitter.com/${handle}`
  if (platform === 'instagram') return `https://instagram.com/${handle}`
  if (platform === 'linkedin')  return `https://linkedin.com/in/${handle}`
  return '#'
}

function socialLabel(platform: string, handle: string): string {
  if (platform === 'website') return handle.replace(/^https?:\/\//, '')
  return `${platform}.com/${handle}`
}

export function MemberOverlay({ member, memberIndex, onClose }: MemberOverlayProps) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const accent = member ? getAccentColor(memberIndex) : '#C41C12'
  const screenshotUrl = member ? `https://picsum.photos/seed/${member.id}/480/240` : ''
  const activeSocials = member
    ? Object.entries(member.socials).filter(([, val]) => val && val.length > 0)
    : []

  return (
    <AnimatePresence>
      {member && (
        <>
          {/* Scrim */}
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(8,8,8,0.88)',
              zIndex: 50,
              cursor: 'pointer',
            }}
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(480px, 90vw)',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              zIndex: 51,
              overflow: 'hidden',
            }}
          >
            {/* Screenshot */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt={`${member.name}'s website`}
              style={{
                width: '100%',
                height: 200,
                objectFit: 'cover',
                display: 'block',
                filter: 'none',
              }}
            />

            {/* Accent top stripe on screenshot */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: accent,
              }}
            />

            {/* Body */}
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ marginBottom: 4 }}>
                <h2
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: 600,
                    fontSize: 20,
                    color: 'var(--text)',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {member.name}
                </h2>
              </div>

              {/* Socials */}
              {activeSocials.length > 0 && (
                <div
                  style={{
                    marginTop: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {activeSocials.map(([platform, handle]) => (
                    <a
                      key={platform}
                      href={socialHref(platform, handle!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        textDecoration: 'none',
                        transition: 'color 150ms ease',
                        display: 'inline-block',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {socialLabel(platform, handle!)}
                    </a>
                  ))}
                </div>
              )}

              {/* Visit button */}
              <div style={{ marginTop: 20 }}>
                <a
                  href={member.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: accent,
                    textDecoration: 'none',
                    display: 'inline-block',
                    transition: 'opacity 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  ↗ Visit Site
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
