'use client'

import { useEffect, useRef, useId } from 'react'

interface WebThreadProps {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  index: number
  isHighlighted?: boolean
  sourceColor?: string
  targetColor?: string
}

export function WebThread({
  sourceX,
  sourceY,
  targetX,
  targetY,
  index,
  isHighlighted = false,
  sourceColor = '#ffffff',
  targetColor = '#ffffff',
}: WebThreadProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const gradientId = useId()

  // Bezier with gravity sag
  const mx = (sourceX + targetX) / 2
  const my = (sourceY + targetY) / 2
  const controlY = my + 65
  const d = `M ${sourceX} ${sourceY} Q ${mx} ${controlY} ${targetX} ${targetY}`

  // Draw-in animation via stroke-dashoffset
  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    const len = Math.ceil(path.getTotalLength())
    path.style.strokeDasharray = String(len)
    path.style.strokeDashoffset = String(len)
    // Force reflow
    void path.getBoundingClientRect()
    path.style.transition = `stroke-dashoffset 500ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 50}ms`
    path.style.strokeDashoffset = '0'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Default: thick white thread, Highlighted: gradient between source and target colors
  const defaultStroke = 'rgba(255, 255, 255, 0.5)'
  const highlightedStroke = `url(#${gradientId})`

  return (
    <>
      {/* Gradient definition for highlighted state */}
      {isHighlighted && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={sourceColor} stopOpacity={0.9} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity={0.7} />
            <stop offset="100%" stopColor={targetColor} stopOpacity={0.9} />
          </linearGradient>
        </defs>
      )}
      <path
        ref={pathRef}
        d={d}
        fill="none"
        stroke={isHighlighted ? highlightedStroke : defaultStroke}
        strokeWidth={isHighlighted ? 4 : 2.5}
        strokeLinecap="round"
        style={{
          transition: 'stroke 200ms ease, stroke-width 200ms ease',
          filter: isHighlighted ? 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' : 'none',
        }}
      />
    </>
  )
}
