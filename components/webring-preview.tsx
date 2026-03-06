'use client'

// Miniaturized SVG preview of the webring — lives inside the landing page circle.
// Uses SVG viewBox to auto-scale; no interaction.

import { useMemo } from 'react'
import { useForceLayout, CANVAS_SIZE } from '@/lib/use-force-layout'
import { MOCK_MEMBERS, getEdges } from '@/lib/mock-data'
import { getAccentColor } from '@/types/member'

export function WebringPreview() {
  const edges = useMemo(() => getEdges(MOCK_MEMBERS), [])
  const positions = useForceLayout(MOCK_MEMBERS, edges)

  if (positions.size === 0) return null

  // Show the central region where nodes cluster (force layout centers on CANVAS_SIZE/2)
  const pad = 600
  const vb = `${pad} ${pad} ${CANVAS_SIZE - pad * 2} ${CANVAS_SIZE - pad * 2}`

  return (
    <svg
      viewBox={vb}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      {/* Web threads */}
      {edges.map((edge) => {
        const s = positions.get(edge.source)
        const t = positions.get(edge.target)
        if (!s || !t) return null
        const mx = (s.x + t.x) / 2
        const my = (s.y + t.y) / 2 + 65
        return (
          <path
            key={edge.id}
            d={`M ${s.x} ${s.y} Q ${mx} ${my} ${t.x} ${t.y}`}
            stroke="#e8e0d0"
            strokeWidth={5}
            fill="none"
            opacity={0.22}
          />
        )
      })}

      {/* Member dots */}
      {MOCK_MEMBERS.map((m, i) => {
        const pos = positions.get(m.id)
        if (!pos) return null
        const accent = getAccentColor(i)
        return (
          <g key={m.id}>
            {/* Glow ring */}
            <circle cx={pos.x} cy={pos.y} r={26} fill={accent} opacity={0.15} />
            {/* Core dot */}
            <circle cx={pos.x} cy={pos.y} r={14} fill={accent} opacity={0.9} />
          </g>
        )
      })}
    </svg>
  )
}
