'use client'

import { useState } from 'react'
import type { Member } from '@/types/member'

export const CARD_WIDTH = 130
const PREVIEW_HEIGHT = Math.round(CARD_WIDTH * 1.25) // ~163px
const LABEL_HEIGHT = 28
export const CARD_HEIGHT = PREVIEW_HEIGHT + LABEL_HEIGHT // ~191px

// Expanded card dimensions (on hover) — grows in-place, doesn't overlap neighbours
const EXPANDED_WIDTH = 240
const EXPANDED_PREVIEW_HEIGHT = 280
const EXPANDED_LABEL_HEIGHT = 32
const IFRAME_SCALE = 0.25

interface WebringSiteCardProps {
  member: Member
  x: number
  y: number
}

export function WebringSiteCard({ member, x, y }: WebringSiteCardProps) {
  const [hovered, setHovered] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(member.embedUrl)}&screenshot=true&meta=false&embed=screenshot.url`

  const w = hovered ? EXPANDED_WIDTH : CARD_WIDTH
  const ph = hovered ? EXPANDED_PREVIEW_HEIGHT : PREVIEW_HEIGHT
  const lh = hovered ? EXPANDED_LABEL_HEIGHT : LABEL_HEIGHT
  const h = ph + lh

  return (
    <div
      style={{
        position: 'absolute',
        // Anchor at the center of the default card position so it expands outward
        left: x + CARD_WIDTH / 2,
        top: y + CARD_HEIGHT / 2,
        width: w,
        height: h,
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: hovered ? 100 : 1,
        userSelect: 'none',
        border: '1px solid #e5e5e5',
        overflow: 'hidden',
        transition: 'width 250ms ease, height 250ms ease',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setIframeLoaded(false) }}
    >
      {/* Preview area */}
      <div
        style={{
          width: '100%',
          height: ph,
          overflow: 'hidden',
          background: '#f5f5f5',
          flexShrink: 0,
          position: 'relative',
          transition: 'height 250ms ease',
        }}
      >
        {/* Screenshot — always present */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshotUrl}
          alt={`${member.name}'s site`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block',
            opacity: hovered && iframeLoaded ? 0 : 1,
            transition: 'opacity 300ms ease',
          }}
          draggable={false}
        />

        {/* Live iframe — loads on hover, replaces screenshot once ready */}
        {hovered && (
          <iframe
            src={member.embedUrl}
            title={member.name}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${100 / IFRAME_SCALE}%`,
              height: `${100 / IFRAME_SCALE}%`,
              border: 'none',
              transform: `scale(${IFRAME_SCALE})`,
              transformOrigin: 'top left',
              opacity: iframeLoaded ? 1 : 0,
              transition: 'opacity 400ms ease',
              pointerEvents: 'none',
            }}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            onLoad={() => setIframeLoaded(true)}
          />
        )}
      </div>

      {/* Name label */}
      <div
        style={{
          width: '100%',
          height: lh,
          background: '#e8e8e8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          flexShrink: 0,
          borderTop: '1px solid #ddd',
          transition: 'height 250ms ease',
          gap: 8,
        }}
      >
        <span
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
            fontSize: hovered ? 13 : 11,
            fontWeight: 500,
            color: '#1a1a1a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'font-size 250ms ease',
          }}
        >
          {member.name}
        </span>
        {hovered && (
          <a
            href={member.embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0,
              fontSize: 10,
              padding: '2px 6px',
              background: 'rgba(0,0,0,0.06)',
              border: '1px solid #ccc',
              color: '#555',
              borderRadius: 2,
              fontFamily: 'system-ui, sans-serif',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            visit ↗
          </a>
        )}
      </div>
    </div>
  )
}
