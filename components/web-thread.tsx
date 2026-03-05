'use client'

import { useEffect, useRef } from 'react'

interface WebThreadProps {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  index: number
  isHighlighted?: boolean
}

export function WebThread({
  sourceX,
  sourceY,
  targetX,
  targetY,
  index,
  isHighlighted = false,
}: WebThreadProps) {
  const pathRef = useRef<SVGPathElement>(null)

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

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={isHighlighted ? 'rgba(220,210,190,0.55)' : 'rgba(220,210,190,0.22)'}
      strokeWidth={isHighlighted ? 1.5 : 1}
      strokeLinecap="round"
      style={{
        transition: 'stroke 200ms ease, stroke-width 200ms ease',
      }}
    />
  )
}
