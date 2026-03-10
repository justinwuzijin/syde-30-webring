'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Member } from '@/types/member'
import { SignatureSVG } from './signature-svg'

// ── Instax Mini proportions (real: 54×86mm, photo: 46×62mm) ──────────────
// Scaled to pixel ratios matching the reference image
const FRAME_PADDING_SIDE = 0.074    // ~7.4% of card width = side border
const FRAME_PADDING_TOP = 0.065     // ~6.5% of card height = top border
const PHOTO_HEIGHT_RATIO = 0.62     // photo window is ~62% of total card height
const SIGNATURE_HEIGHT_RATIO = 0.255 // bottom signature area ~25.5%
// remaining ~6.5% is the top border above photo

// Card base dimensions for the grid
export const POLAROID_WIDTH = 150
export const POLAROID_HEIGHT = Math.round(POLAROID_WIDTH * (86 / 54)) // ~239px, real Instax ratio

// Hover expansion
const HOVER_SCALE = 1.08
const HOVER_LIFT = -6 // px upward
const HOVER_SHADOW_IDLE = '0 20px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)'
const HOVER_SHADOW_ACTIVE = '0 40px 40px rgba(0,0,0,0.22), 0 6px 16px rgba(0,0,0,0.12)'

interface PolaroidCardProps {
  member: Member
  x: number
  y: number
  onClick?: () => void
}

export function PolaroidCard({ member, x, y, onClick }: PolaroidCardProps) {
  const [hovered, setHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [videoVisible, setVideoVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const hasUploadedStill = !!member.polaroid_still_url
  const hasUploadedLive = !!member.polaroid_live_url

  // Slight random tilt per card (deterministic from id)
  const tilt = useRef(0)
  useEffect(() => {
    let h = 5381
    for (const c of member.id) h = ((h << 5) + h) ^ c.charCodeAt(0)
    tilt.current = ((h % 11) - 5) * 0.8 // -4° to +4°
  }, [member.id])

  // Fallback to Microlink screenshot if no uploaded still
  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(
    member.embedUrl,
  )}&screenshot=true&meta=false&embed=screenshot.url`

  const stillImageSrc = member.polaroid_still_url ?? screenshotUrl

  // Computed pixel values
  const photoW = POLAROID_WIDTH * (1 - 2 * FRAME_PADDING_SIDE)
  const photoH = POLAROID_HEIGHT * PHOTO_HEIGHT_RATIO
  const sigH = POLAROID_HEIGHT * SIGNATURE_HEIGHT_RATIO
  const padSide = POLAROID_WIDTH * FRAME_PADDING_SIDE
  const padTop = POLAROID_HEIGHT * FRAME_PADDING_TOP

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (hasUploadedLive) {
      setVideoVisible(true)
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {
          // Autoplay may be blocked; video will show on user interaction
        })
      }
    }
  }, [hasUploadedLive])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setVideoVisible(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  return (
    <div
      ref={cardRef}
      style={{
        position: 'absolute',
        left: x + POLAROID_WIDTH / 2,
        top: y + POLAROID_HEIGHT / 2,
        width: POLAROID_WIDTH,
        height: POLAROID_HEIGHT,
        transform: `translate(-50%, -50%) rotate(${tilt.current}deg)`,
        zIndex: hovered ? 100 : 1,
        userSelect: 'none',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* ── Frame (the white Polaroid border) ── */}
      <div
        className="polaroid-frame"
        style={{
          width: '100%',
          height: '100%',
          background: '#f7f6f3',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: hovered ? HOVER_SHADOW_ACTIVE : HOVER_SHADOW_IDLE,
          transform: hovered
            ? `scale(${HOVER_SCALE}) translateY(${HOVER_LIFT}px) rotate(0deg)`
            : 'scale(1) translateY(0px) rotate(0deg)',
          transition: 'transform 350ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 350ms cubic-bezier(0.23, 1, 0.32, 1)',
          transformOrigin: 'center bottom',
        }}
      >
        {/* Film grain overlay — always visible, subtle */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
            pointerEvents: 'none',
            zIndex: 10,
            mixBlendMode: 'multiply',
          }}
        />

        {/* ── Photo Window ── */}
        <div
          style={{
            position: 'relative',
            marginTop: padTop,
            marginLeft: padSide,
            marginRight: padSide,
            width: photoW,
            height: photoH,
            overflow: 'hidden',
            background: '#e8e5df',
            flexShrink: 0,
          }}
        >
          {/* Shimmer skeleton while loading */}
          {!imageLoaded && (
            <div
              className="animate-pulse"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #e8e5df 25%, #d8d5cf 50%, #e8e5df 75%)',
                backgroundSize: '200% 100%',
              }}
            />
          )}

          {/* Still frame image (greyed out by default, full color on hover) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stillImageSrc}
            alt={`${member.name}'s photo`}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              filter: hovered
                ? 'saturate(1.1) contrast(1.05) brightness(1.0)'
                : 'saturate(0) contrast(1.02) brightness(0.85)',
              opacity: imageLoaded ? (videoVisible ? 0 : 1) : 0,
              transition: 'filter 400ms ease, opacity 300ms ease',
            }}
            draggable={false}
            onLoad={() => setImageLoaded(true)}
          />

          {/* Live Photo video — plays once on hover */}
          {hasUploadedLive && member.polaroid_live_url && (
            <video
              ref={videoRef}
              src={member.polaroid_live_url}
              muted
              playsInline
              preload="auto"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                opacity: videoVisible ? 1 : 0,
                transition: 'opacity 300ms ease',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* Photo texture overlay (light vignette) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.06) 100%)',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        </div>

        {/* ── Signature Area ── */}
        <div
          className="polaroid-signature"
          style={{
            flex: 1,
            minHeight: sigH,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `0 ${padSide + 4}px`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Hand-drawn SVG signature — animates on hover */}
          <div
            style={{
              width: '85%',
              height: '70%',
              transform: 'rotate(-1.5deg)',
            }}
          >
            <SignatureSVG
              memberId={member.id}
              isHovered={hovered}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
