'use client'

import { useState, useCallback, useRef } from 'react'
import type { Member } from '@/types/member'
import { cardRotation } from '@/lib/use-force-layout'

const CARD_BASE_WIDTH  = 110
const CARD_WIDTH_PER_CONN = 8
const CARD_MAX_WIDTH   = 160
const CARD_ASPECT      = 0.72 // height / width

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
  const rotation = cardRotation(member.id)

  const screenshotUrl = `https://picsum.photos/seed/${member.id}/300/200`

  const fireChromatic = useCallback(() => {
    const el = nameRef.current
    if (!el) return
    el.classList.remove('chromatic-flash')
    // Reflow trick to restart animation
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
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        cursor: 'pointer',
        zIndex: hovered ? 20 : 10,
        animation: `cardEntrance 400ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 30 + 500}ms both`,
        // Pass rotation as CSS var for the keyframe
        ['--card-rotation' as string]: `${rotation}deg`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Card body */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--surface)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: `2px solid ${accent}`,
          position: 'relative',
          overflow: 'hidden',
          transform: isActive ? 'scale(1.04)' : 'scale(1)',
          transition: 'transform 120ms ease-out, border-color 150ms ease',
          borderColor: isActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)',
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
                ? 'grayscale(0.1) contrast(1.1) brightness(1)'
                : 'grayscale(0.55) contrast(1.05) brightness(0.78)',
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
            paddingLeft: 6,
            paddingRight: 6,
            background: 'var(--surface)',
          }}
        >
          <span
            ref={nameRef}
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.06em',
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
