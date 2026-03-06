'use client'

import { useState, useCallback, useRef } from 'react'
import type { Member } from '@/types/member'
import { cardRotation, CANVAS_SIZE } from '@/lib/use-force-layout'

const CARD_BASE_WIDTH  = 160
const CARD_WIDTH_PER_CONN = 12
const CARD_MAX_WIDTH   = 220
const CARD_ASPECT      = 0.72

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
  const nameRef = useRef<HTMLSpanElement>(null)
  const chromaticTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const width = Math.min(CARD_BASE_WIDTH + member.connections.length * CARD_WIDTH_PER_CONN, CARD_MAX_WIDTH)
  const height = Math.round(width * CARD_ASPECT)
  const baseRotation = cardRotation(member.id)

  const screenshotUrl = `https://picsum.photos/seed/${member.id}/400/280`

  // Calculate convex distortion based on position from center
  const centerX = CANVAS_SIZE / 2
  const centerY = CANVAS_SIZE / 2
  const dx = (x - centerX) / (CANVAS_SIZE / 2)
  const dy = (y - centerY) / (CANVAS_SIZE / 2)
  const distFromCenter = Math.sqrt(dx * dx + dy * dy)
  
  // Perspective rotation - cards tilt away from center as if on a convex surface
  const rotateY = dx * 25 // -25 to +25 degrees based on x position
  const rotateX = -dy * 20 // -20 to +20 degrees based on y position
  
  // Scale increases slightly toward edges (convex bulge effect)
  const convexScale = 1 + distFromCenter * 0.15

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
        zIndex: hovered ? 20 : 10,
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
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderTop: `3px solid ${accent}`,
          borderRadius: '4px',
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
          borderColor: isActive ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
          boxShadow: isActive 
            ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)' 
            : '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Screenshot (top 65%) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '65%',
            overflow: 'hidden',
            borderRadius: '3px 3px 0 0',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={`${member.name}'s website`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: isActive
                ? 'grayscale(0) contrast(1.1) brightness(1.05)'
                : 'grayscale(0.4) contrast(1.05) brightness(0.8)',
              transition: 'filter 200ms linear',
            }}
            draggable={false}
          />
        </div>

        {/* Name label (bottom 35%) */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '35%',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 10,
            paddingRight: 10,
            background: 'var(--surface)',
          }}
        >
          <span
            ref={nameRef}
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
              width: '100%',
            }}
          >
            {member.name}
          </span>
        </div>
      </div>
    </div>
  )
}
