'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Member } from '@/types/member'
import type { Edge } from '@/lib/mock-data'
import { usePan } from '@/lib/use-pan'
import { CANVAS_SIZE } from '@/lib/use-force-layout'
import { WebCanvas } from './web-canvas'

// Inner component: only mounts once sphereSize is known,
// so usePan initializes with the correct centered position.
function SphereInner({
  members,
  edges,
  sphereSize,
  onCardClick,
}: {
  members: Member[]
  edges: Edge[]
  sphereSize: number
  onCardClick: (member: Member) => void
}) {
  const sphereRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Center the 2400×2400 canvas inside the sphere
  const cx = sphereSize / 2 - CANVAS_SIZE / 2
  const cy = sphereSize / 2 - CANVAS_SIZE / 2

  const { pan, handlers, isDragging } = usePan({
    initialX: cx,
    initialY: cy,
    friction: 0.92,
  })

  // Prevent scroll inside sphere
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    const el = sphereRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <div
      ref={sphereRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
      }}
      onMouseDown={handlers.onMouseDown}
      onMouseMove={handlers.onMouseMove}
      onMouseUp={handlers.onMouseUp}
      onMouseLeave={handlers.onMouseLeave}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      <WebCanvas
        members={members}
        edges={edges}
        panX={pan.x}
        panY={pan.y}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onCardClick={onCardClick}
      />
    </div>
  )
}

interface WebSphereProps {
  members: Member[]
  edges: Edge[]
  onCardClick: (member: Member) => void
}

export function WebSphere({ members, edges, onCardClick }: WebSphereProps) {
  const [sphereSize, setSphereSize] = useState(0)

  useEffect(() => {
    const compute = () => {
      const size = Math.min(window.innerWidth * 0.44, window.innerHeight * 0.44)
      setSphereSize(Math.round(size))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: sphereSize || '44vmin',
        height: sphereSize || '44vmin',
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#0d0d0d',
        border: '1.5px solid rgba(255,255,255,0.12)',
        boxShadow: `
          inset 0 0 60px 20px rgba(0,0,0,0.7),
          inset 0 -30px 60px rgba(0,0,0,0.4),
          0 0 0 1.5px rgba(255,255,255,0.1),
          0 8px 40px rgba(0,0,0,0.6)
        `,
        zIndex: 10,
      }}
    >
      {sphereSize > 0 && (
        <SphereInner
          members={members}
          edges={edges}
          sphereSize={sphereSize}
          onCardClick={onCardClick}
        />
      )}
    </div>
  )
}
