'use client'

import { useState, useRef, useCallback } from 'react'
import { getDisplayUrl, type Member } from '@/types/member'

// Instax Mini proportions — must match polaroid-card.tsx exactly
const FRAME_PADDING_SIDE = 0.074
const FRAME_PADDING_TOP = 0.065
const PHOTO_HEIGHT_RATIO = 0.62
const SIGNATURE_HEIGHT_RATIO = 0.255

export const POLAROID_WIDTH = 150
export const POLAROID_HEIGHT = Math.round(POLAROID_WIDTH * (86 / 54)) // ~239px

const HOVER_SCALE = 1.08
const HOVER_LIFT = -6
const HOVER_SHADOW_IDLE = '0 20px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)'
const HOVER_SHADOW_ACTIVE = '0 40px 40px rgba(0,0,0,0.22), 0 6px 16px rgba(0,0,0,0.12)'

interface PolaroidStaticProps {
  member: Member
}

/** A self-contained, statically-positioned Polaroid — used in the /embed/[id] iframe. */
export function PolaroidStatic({ member }: PolaroidStaticProps) {
  const [hovered, setHovered] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [videoVisible, setVideoVisible] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const hasUploadedStill = !!member.polaroid_still_url
  const hasUploadedLive = !!member.polaroid_live_url

  const firstName = (member.name || '').trim().split(/\s+/)[0] || ''

  const targetChars = 6
  const baseFontSize = 48
  const minFontSize = 14
  const maxFontSize = 62
  const nameFontSize = Math.min(
    maxFontSize,
    Math.max(minFontSize, Math.round(baseFontSize * (targetChars / firstName.length)))
  )

  // Deterministic tilt from member id
  let h = 5381
  for (const c of member.id) h = ((h << 5) + h) ^ c.charCodeAt(0)
  const tilt = ((h % 11) - 5) * 0.8

  const displayUrl = getDisplayUrl(member)
  const screenshotUrl = displayUrl
    ? `https://api.microlink.io/?url=${encodeURIComponent(displayUrl)}&screenshot=true&meta=false&embed=screenshot.url`
    : ''

  const stillImageSrc = hasUploadedStill ? member.polaroid_still_url! : screenshotUrl

  const photoW = POLAROID_WIDTH * (1 - 2 * FRAME_PADDING_SIDE)
  const photoH = POLAROID_HEIGHT * PHOTO_HEIGHT_RATIO
  const sigH = POLAROID_HEIGHT * SIGNATURE_HEIGHT_RATIO
  const padSide = POLAROID_WIDTH * FRAME_PADDING_SIDE
  const padTop = POLAROID_HEIGHT * FRAME_PADDING_TOP

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (hasUploadedLive && videoRef.current) {
      setVideoVisible(true)
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
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
      style={{
        width: POLAROID_WIDTH,
        height: POLAROID_HEIGHT,
        transform: `rotate(${tilt}deg)`,
        transformOrigin: 'center bottom',
        userSelect: 'none',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Frame */}
      <div
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
        {/* Film grain overlay */}
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

        {/* Photo Window */}
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
          {!imageLoaded && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, #e8e5df 25%, #d8d5cf 50%, #e8e5df 75%)',
                backgroundSize: '200% 100%',
                animation: 'polaroid-shimmer 1.4s ease infinite',
              }}
            />
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            loading="lazy"
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
            onError={() => { setImageFailed(true); setImageLoaded(false) }}
          />

          {hasUploadedStill && imageFailed && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: '#d8d5cf',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#888',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              photo unavailable
            </div>
          )}

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

          {/* Vignette */}
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

        {/* Signature Area */}
        <div
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
          <div
            style={{
              width: '96%',
              height: '92%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: 'rotate(-1.5deg)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-polaroid-name)',
                fontSize: nameFontSize,
                lineHeight: 0.95,
                textTransform: 'lowercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                color: '#111111',
                whiteSpace: 'nowrap',
                textShadow: '0.4px 0.8px 0 rgba(0,0,0,0.18)',
                opacity: hovered ? 1 : 0,
                transition: 'opacity 400ms ease',
              }}
            >
              {firstName}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
