'use client'

import { useEffect, useRef, useState } from 'react'

// ── Hand-drawn SVG path data per member ──────────────────────────────────
// Each signature is a set of strokes (sub-paths) that get drawn sequentially.
// Paths are designed to look like someone scrawled with a fat Sharpie marker.
// viewBox is per-signature so each name fills its space naturally.

interface SignatureData {
  viewBox: string
  strokes: {
    d: string
    width?: number // override stroke-width per stroke (for dots, crosses, etc.)
  }[]
}

const SIGNATURES: Record<string, SignatureData> = {
  // ── "justin" — loose lowercase scrawl, thick sharpie ──
  'justin-wu': {
    viewBox: '0 0 150 55',
    strokes: [
      // j — short lowercase, no descender hook, just a small curve
      { d: 'M 12,14 C 12,22 11,32 11,42 C 11,48 8,50 5,47' },
      // j dot
      { d: 'M 11,7 L 12,8 L 11,9', width: 4.5 },
      // u
      { d: 'M 22,16 C 22,28 23,38 28,41 C 33,43 36,38 36,30 L 36,16' },
      // s — top bulges left, bottom bulges right
      { d: 'M 52,18 C 48,14 42,16 43,23 C 44,28 52,29 52,35 C 52,41 47,43 42,40' },
      // t — stem
      { d: 'M 62,6 C 62,16 61,30 62,42' },
      // t — cross
      { d: 'M 56,20 L 70,20', width: 4.5 },
      // i — short lowercase stroke
      { d: 'M 78,16 C 78,24 77,34 78,42' },
      // i dot
      { d: 'M 77,8 L 79,9 L 77,10', width: 4.5 },
      // n
      { d: 'M 88,42 L 88,18 C 90,12 98,10 104,16 C 108,20 108,32 108,42' },
    ],
  },

  // ── "leo" — big, bold, loose ──
  'leo-zhang': {
    viewBox: '0 0 120 60',
    strokes: [
      // l — single wobbly downstroke
      { d: 'M 10,4 C 11,14 9,30 10,44 C 10,50 12,54 14,52' },
      // e — horizontal stroke first, then the curve (like a handwritten e)
      { d: 'M 30,32 L 48,30 C 48,22 42,16 34,18 C 26,20 24,30 28,38 C 32,46 44,46 50,40' },
      // o — rough circle, doesn't quite close
      { d: 'M 72,24 C 64,22 58,30 60,40 C 62,50 74,54 82,48 C 90,42 90,28 82,22 C 76,18 68,20 66,28' },
    ],
  },
}

// ── Fallback: generate a simple scrawl for unknown members ──
function getFallbackSignature(name: string): SignatureData {
  const charWidth = 22
  const totalW = Math.max(80, name.length * charWidth + 20)
  // Single wobbly underline-ish stroke as placeholder
  return {
    viewBox: `0 0 ${totalW} 50`,
    strokes: [
      {
        d: `M 8,30 C ${totalW * 0.25},22 ${totalW * 0.5},38 ${totalW * 0.75},26 C ${totalW * 0.85},22 ${totalW - 10},28 ${totalW - 8},32`,
      },
    ],
  }
}

// ── Component ────────────────────────────────────────────────────────────

interface SignatureSVGProps {
  memberId: string
  isHovered: boolean
  className?: string
}

export function SignatureSVG({ memberId, isHovered, className }: SignatureSVGProps) {
  const sig = SIGNATURES[memberId] || getFallbackSignature(memberId)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  const [lengths, setLengths] = useState<number[]>([])
  const [shouldDraw, setShouldDraw] = useState(false)
  const hasDrawnOnce = useRef(false)

  // Measure path lengths on mount
  useEffect(() => {
    const measured = pathRefs.current.map((p) => p?.getTotalLength() ?? 0)
    setLengths(measured)
  }, [memberId])

  // Trigger draw animation on hover — once drawn, stays permanently
  useEffect(() => {
    if (isHovered && !hasDrawnOnce.current) {
      setShouldDraw(true)
      hasDrawnOnce.current = true
    }
    // Never reset — signature stays after first hover
  }, [isHovered])

  // Calculate cumulative delay for sequential stroke drawing
  const DRAW_SPEED = 0.0045 // ms per path-length unit — controls overall speed
  const STROKE_GAP = 60 // ms gap between strokes

  let cumulativeDelay = 0

  return (
    <svg
      viewBox={sig.viewBox}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'visible',
      }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {sig.strokes.map((stroke, i) => {
        const len = lengths[i] || 0
        const duration = len * DRAW_SPEED
        const delay = cumulativeDelay
        cumulativeDelay += duration + STROKE_GAP

        return (
          <path
            key={i}
            ref={(el) => { pathRefs.current[i] = el }}
            d={stroke.d}
            stroke="#1a1a1a"
            strokeWidth={stroke.width ?? 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              strokeDasharray: len || 1000,
              strokeDashoffset: shouldDraw ? 0 : (len || 1000),
              transition: shouldDraw
                ? `stroke-dashoffset ${duration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`
                : 'none',
              // Idle state: show completed signature at reduced opacity
              opacity: shouldDraw ? 1 : (len > 0 ? 0.88 : 0),
            }}
          />
        )
      })}
    </svg>
  )
}
