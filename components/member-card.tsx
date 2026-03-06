'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Member } from '@/types/member'
import { cardRotation, CANVAS_SIZE } from '@/lib/use-force-layout'

const CARD_BASE_WIDTH  = 180
const CARD_WIDTH_PER_CONN = 14
const CARD_MAX_WIDTH   = 260
const CARD_ASPECT      = 0.72

const PREVIEW_WIDTH = 400
const PREVIEW_HEIGHT = 300

// Tailwind orange & yellow (500–700) for card backgrounds
const TAILWIND_700_COLORS = [
  '#c2410c', // orange-700
  '#b45309', // amber-700
  '#a16207', // yellow-700
  '#ea580c', // orange-600
  '#d97706', // amber-600
  '#ca8a04', // yellow-600
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
]

// Deterministic color from member id
function getCardBgColor(id: string): string {
  let h = 5381
  for (const c of id) h = ((h << 5) + h) ^ c.charCodeAt(0)
  return TAILWIND_700_COLORS[Math.abs(h) % TAILWIND_700_COLORS.length]
}

export { TAILWIND_700_COLORS, getCardBgColor }

interface MemberCardProps {
  member: Member
  x: number
  y: number
  accent: string
  index: number
  isHighlighted: boolean
  onHover: (id: string | null) => void
  onClick: (member: Member) => void
}

export function MemberCard({
  member,
  x,
  y,
  accent,
  index,
  isHighlighted,
  onHover,
  onClick,
}: MemberCardProps) {
  const [hovered, setHovered] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const nameRef = useRef<HTMLSpanElement>(null)
  const chromaticTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const width = Math.min(CARD_BASE_WIDTH + member.connections.length * CARD_WIDTH_PER_CONN, CARD_MAX_WIDTH)
  const height = Math.round(width * CARD_ASPECT)
  const baseRotation = cardRotation(member.id)

  // Use Microlink API to get actual website screenshot
  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(member.embedUrl)}&screenshot=true&meta=false&embed=screenshot.url`

  // Get randomized background color based on member id
  const cardBgColor = getCardBgColor(member.id)

  // Calculate convex distortion based on position from center
  const centerX = CANVAS_SIZE / 2
  const centerY = CANVAS_SIZE / 2
  const dx = (x - centerX) / (CANVAS_SIZE / 2)
  const dy = (y - centerY) / (CANVAS_SIZE / 2)
  const distFromCenter = Math.sqrt(dx * dx + dy * dy)
  
  // Perspective rotation - cards tilt away from center as if on a convex surface
  const rotateY = dx * 25
  const rotateX = -dy * 20
  
  // Scale increases slightly toward edges (convex bulge effect)
  const convexScale = 1 + distFromCenter * 0.15

  // Delayed preview show to avoid flickering
  useEffect(() => {
    if (hovered) {
      hoverTimeout.current = setTimeout(() => {
        setShowPreview(true)
      }, 400)
    } else {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
      setShowPreview(false)
      setIframeLoaded(false)
    }
    return () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    }
  }, [hovered])

  const fireChromatic = useCallback(() => {
    const el = nameRef.current
    if (!el) return
    el.classList.remove('chromatic-flash')
    void el.offsetWidth
    el.classList.add('chromatic-flash')
    if (chromaticTimeout.current) clearTimeout(chromaticTimeout.current)
    chromaticTimeout.current = setTimeout(() => {
      el.classList.remove('chromatic-flash')
    }, 150)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    onHover(member.id)
    fireChromatic()
  }, [member.id, onHover, fireChromatic])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    onHover(null)
  }, [onHover])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(member)
  }, [member, onClick])

  const isActive = hovered || isHighlighted

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        perspective: '800px',
        perspectiveOrigin: 'center center',
        zIndex: hovered ? 100 : 10,
        animation: `cardEntrance 400ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 30 + 500}ms both`,
        ['--card-rotation' as string]: `${baseRotation}deg`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Card body with convex distortion */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: cardBgColor,
          border: '1px solid rgba(255,255,255,0.2)',
          borderTop: `3px solid ${accent}`,
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer',
          transform: `
            translate(-50%, -50%)
            scale(${convexScale * (isActive ? 1.08 : 1)})
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            rotate(${baseRotation}deg)
          `,
          transformStyle: 'preserve-3d',
          transition: 'transform 200ms ease-out, border-color 150ms ease, box-shadow 200ms ease',
          borderColor: isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
          boxShadow: isActive 
            ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${cardBgColor}40` 
            : '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Screenshot (top 82%) - grayscale when not hovered */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '82%',
            overflow: 'hidden',
            borderRadius: '5px 5px 0 0',
            background: '#0a0a0a',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={`${member.name}'s website`}
            style={{
              width: '100%',
              height: '100%',
              minWidth: '100%',
              minHeight: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
              display: 'block',
              filter: isActive
                ? 'grayscale(0) contrast(1.1) brightness(1.05)'
                : 'grayscale(0.5) contrast(1) brightness(0.85)',
              transition: 'filter 300ms ease',
            }}
            draggable={false}
          />
        </div>

        {/* Name label (bottom 18%) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '18%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: 12,
            paddingRight: 12,
            background: cardBgColor,
          }}
        >
          <span
            ref={nameRef}
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '0.01em',
              textTransform: 'lowercase',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              textAlign: 'center',
              width: '100%',
            }}
          >
            {member.name}
          </span>
        </div>
      </div>

      {/* Live Preview Popup - appears on hover after delay */}
      {showPreview && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: 'translateX(-50%) translateY(-20px)',
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            background: '#0a0a0f',
            borderRadius: '8px',
            border: `2px solid ${accent}`,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.1)',
            overflow: 'hidden',
            zIndex: 200,
            opacity: iframeLoaded ? 1 : 0.7,
            transition: 'opacity 300ms ease',
          }}
        >
          {/* Loading indicator */}
          {!iframeLoaded && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0f',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 12,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: 24, 
                  height: 24, 
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: accent,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 8px',
                }} />
                loading preview...
              </div>
            </div>
          )}
          
          {/* Live iframe */}
          <iframe
            src={member.embedUrl}
            title={`${member.name}'s website preview`}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'white',
            }}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            onLoad={() => setIframeLoaded(true)}
          />
          
          {/* URL label at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '8px 12px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontFamily: 'JetBrains Mono, monospace',
                color: 'rgba(255,255,255,0.7)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.embedUrl}
            </span>
            <span
              style={{
                fontSize: 9,
                padding: '2px 6px',
                background: accent,
                color: 'white',
                borderRadius: 3,
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              LIVE
            </span>
          </div>

          {/* Arrow pointer */}
          <div
            style={{
              position: 'absolute',
              bottom: -8,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `8px solid ${accent}`,
            }}
          />
        </div>
      )}
    </div>
  )
}
