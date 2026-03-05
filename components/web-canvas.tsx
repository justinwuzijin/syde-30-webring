'use client'

import type { Member } from '@/types/member'
import type { Edge } from '@/lib/mock-data'
import { useForceLayout, CANVAS_SIZE } from '@/lib/use-force-layout'
import { getAccentColor } from '@/types/member'
import { WebThread } from './web-thread'
import { MemberCard } from './member-card'

interface WebCanvasProps {
  members: Member[]
  edges: Edge[]
  panX: number
  panY: number
  hoveredId: string | null
  onHover: (id: string | null) => void
  onCardClick: (member: Member) => void
}

export function WebCanvas({
  members,
  edges,
  panX,
  panY,
  hoveredId,
  onHover,
  onCardClick,
}: WebCanvasProps) {
  const positions = useForceLayout(members, edges)

  // Nodes connected to the currently hovered node
  const connectedIds = new Set<string>()
  if (hoveredId) {
    for (const e of edges) {
      if (e.source === hoveredId) connectedIds.add(e.target)
      if (e.target === hoveredId) connectedIds.add(e.source)
    }
  }

  const transform = `translate(${panX}px, ${panY}px)`

  return (
    <>
      {/* Layer 1: SVG threads */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          overflow: 'visible',
          transform,
          willChange: 'transform',
          zIndex: 1,
        }}
      >
        {edges.map((edge, i) => {
          const s = positions.get(edge.source)
          const t = positions.get(edge.target)
          if (!s || !t) return null
          const highlighted =
            hoveredId !== null &&
            (edge.source === hoveredId || edge.target === hoveredId)
          return (
            <WebThread
              key={edge.id}
              sourceX={s.x}
              sourceY={s.y}
              targetX={t.x}
              targetY={t.y}
              index={i}
              isHighlighted={highlighted}
            />
          )
        })}
      </svg>

      {/* Layer 2: HTML member cards */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          transform,
          transformOrigin: '0 0',
          willChange: 'transform',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {members.map((m, i) => {
          const pos = positions.get(m.id)
          if (!pos) return null
          return (
            <div key={m.id} style={{ pointerEvents: 'auto' }}>
              <MemberCard
                member={m}
                x={pos.x}
                y={pos.y}
                accent={getAccentColor(i)}
                index={i}
                isHighlighted={connectedIds.has(m.id)}
                onHover={onHover}
                onClick={onCardClick}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
