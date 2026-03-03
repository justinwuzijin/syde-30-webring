'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { Member } from '@/types/member'
import type { Edge } from '@/lib/mock-data'
import { getAccentColor } from '@/types/member'
import { WebThread } from './web-thread'
import { MemberNode } from './member-node'

interface WebCanvasProps {
  members: Member[]
  edges: Edge[]
}

interface Pos { x: number; y: number }

function layout(members: Member[], edges: Edge[], w: number, h: number): Map<string, Pos> {
  const nodes = members.map((m, i) => ({
    id: m.id,
    x: w / 2 + Math.cos((i * 2 * Math.PI) / members.length) * 180 + (Math.random() - 0.5) * 30,
    y: h / 2 + Math.sin((i * 2 * Math.PI) / members.length) * 180 + (Math.random() - 0.5) * 30,
    vx: 0, vy: 0,
  }))
  const nm = new Map(nodes.map(n => [n.id, n]))

  for (let t = 0; t < 300; t++) {
    const d = 1 - t / 300
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        let dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const f = (-400 * d) / (dist * dist)
        dx = (dx / dist) * f; dy = (dy / dist) * f
        a.vx -= dx * 0.1; a.vy -= dy * 0.1
        b.vx += dx * 0.1; b.vy += dy * 0.1
      }
    }
    for (const e of edges) {
      const a = nm.get(e.source), b = nm.get(e.target)
      if (!a || !b) continue
      let dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const f = (dist - 200) * 0.02 * d
      dx = (dx / dist) * f; dy = (dy / dist) * f
      a.vx += dx * 0.1; a.vy += dy * 0.1
      b.vx -= dx * 0.1; b.vy -= dy * 0.1
    }
    for (const n of nodes) {
      n.vx += (w / 2 - n.x) * 0.004 * d
      n.vy += (h / 2 - n.y) * 0.004 * d
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j]
        const dx = b.x - a.x, dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        if (dist < 140) {
          const p = ((140 - dist) / dist) * 0.5
          a.x -= dx * p; a.y -= dy * p
          b.x += dx * p; b.y += dy * p
        }
      }
    }
    for (const n of nodes) { n.vx *= 0.6; n.vy *= 0.6; n.x += n.vx; n.y += n.vy }
  }
  return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]))
}

export function WebCanvas({ members, edges }: WebCanvasProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Map<string, Pos>>(new Map())
  const [tf, setTf] = useState({ x: 0, y: 0, k: 1 })
  const [hovered, setHovered] = useState<string | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const drag = useRef(false)
  const last = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const u = () => setDims({ w: window.innerWidth, h: window.innerHeight })
    u()
    window.addEventListener('resize', u)
    return () => window.removeEventListener('resize', u)
  }, [])

  useEffect(() => {
    if (!dims.w || !dims.h) return
    setPos(layout(members, edges, dims.w, dims.h))
    requestAnimationFrame(() => setReady(true))
  }, [members, edges, dims])

  const down = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) return
    drag.current = true
    last.current = { x: e.clientX, y: e.clientY }
  }, [])
  const move = useCallback((e: React.MouseEvent) => {
    if (!drag.current) return
    setTf(p => ({ ...p, x: p.x + e.clientX - last.current.x, y: p.y + e.clientY - last.current.y }))
    last.current = { x: e.clientX, y: e.clientY }
  }, [])
  const up = useCallback(() => { drag.current = false }, [])
  const wheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const s = e.deltaY > 0 ? 0.95 : 1.05
    setTf(p => {
      const k = Math.min(Math.max(p.k * s, 0.3), 3)
      const r = ref.current?.getBoundingClientRect()
      if (!r) return { ...p, k }
      const mx = e.clientX - r.left, my = e.clientY - r.top
      return { x: mx - (mx - p.x) * (k / p.k), y: my - (my - p.y) * (k / p.k), k }
    })
  }, [])

  const conn = new Set<string>()
  if (hovered) {
    for (const e of edges) {
      if (e.source === hovered || e.target === hovered) { conn.add(e.source); conn.add(e.target) }
    }
    conn.delete(hovered)
  }

  return (
    <div
      ref={ref}
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{ cursor: drag.current ? 'grabbing' : 'grab', opacity: ready ? 1 : 0, transition: 'opacity 0.8s cubic-bezier(0.22,1,0.36,1)' }}
      onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up} onWheel={wheel}
    >
      <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 2 }}>
        <g transform={`translate(${tf.x},${tf.y}) scale(${tf.k})`}>
          {edges.map((edge, i) => {
            const s = pos.get(edge.source), t = pos.get(edge.target)
            if (!s || !t) return null
            const hl = hovered !== null && (edge.source === hovered || edge.target === hovered)
            return (
              <WebThread key={edge.id} sourceX={s.x} sourceY={s.y} targetX={t.x} targetY={t.y} index={i} isHighlighted={hl}
                accentColor={hovered ? getAccentColor(members.findIndex(m => m.id === hovered)) : undefined} />
            )
          })}
        </g>
      </svg>
      <div className="absolute inset-0" style={{ transform: `translate(${tf.x}px,${tf.y}px) scale(${tf.k})`, transformOrigin: '0 0', zIndex: 3, pointerEvents: 'none' }}>
        {members.map((m, i) => {
          const p = pos.get(m.id)
          if (!p) return null
          return (
            <div key={m.id} style={{ pointerEvents: 'auto' }}>
              <MemberNode member={m} x={p.x} y={p.y} size={Math.min(120 + m.connections.length * 12, 200)} accent={getAccentColor(i)} index={i} isConnectedToHovered={conn.has(m.id)} onHover={setHovered} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
