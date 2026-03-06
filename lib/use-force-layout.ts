'use client'

import { useMemo } from 'react'
import type { Member } from '@/types/member'
import type { Edge } from '@/lib/mock-data'

export const CANVAS_SIZE = 2400

interface Position { x: number; y: number }

interface Node {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

// Deterministic initial position from id hash (djb2)
function hashId(id: string): number {
  let h = 5381
  for (const c of id) h = ((h << 5) + h) ^ c.charCodeAt(0)
  return Math.abs(h)
}

function initialPos(id: string, index: number, total: number): { x: number; y: number } {
  const h = hashId(id)
  const angle = (index / total) * Math.PI * 2 + (h % 100) * 0.01
  const radius = 600 + (h % 400)
  return {
    x: CANVAS_SIZE / 2 + Math.cos(angle) * radius,
    y: CANVAS_SIZE / 2 + Math.sin(angle) * radius,
  }
}

export function useForceLayout(
  members: Member[],
  edges: Edge[],
): Map<string, Position> {
  return useMemo(() => {
    if (members.length === 0) return new Map()

    const nodes: Node[] = members.map((m, i) => ({
      id: m.id,
      ...initialPos(m.id, i, members.length),
      vx: 0,
      vy: 0,
    }))

    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    const TICKS = 300
    const cx = CANVAS_SIZE / 2
    const cy = CANVAS_SIZE / 2

    for (let t = 0; t < TICKS; t++) {
      const alpha = 1 - t / TICKS

      // Repulsion between all pairs (increased strength for more spacing)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const strength = (900 * alpha) / (dist * dist)
          const fx = (dx / dist) * strength
          const fy = (dy / dist) * strength
          a.vx -= fx * 0.1
          a.vy -= fy * 0.1
          b.vx += fx * 0.1
          b.vy += fy * 0.1
        }
      }

      // Attraction along edges (increased target distance)
      for (const e of edges) {
        const a = nodeMap.get(e.source)
        const b = nodeMap.get(e.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const TARGET_DIST = 480
        const f = ((dist - TARGET_DIST) * 0.012 * alpha)
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }

      // Center gravity (slightly reduced to allow more spread)
      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.002 * alpha
        n.vy += (cy - n.y) * 0.002 * alpha
      }

      // Collision avoidance (increased min distance for bigger cards)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const MIN = 320
          if (dist < MIN) {
            const push = ((MIN - dist) / dist) * 0.5
            a.x -= dx * push
            a.y -= dy * push
            b.x += dx * push
            b.y += dy * push
          }
        }
      }

      // Integrate
      for (const n of nodes) {
        n.vx *= 0.55
        n.vy *= 0.55
        n.x += n.vx
        n.y += n.vy
      }
    }

    return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y }]))
  }, [members, edges])
}

// Deterministic card rotation from id hash, range -8..+8 degrees
export function cardRotation(id: string): number {
  let h = 5381
  for (const c of id) h = ((h << 5) + h) + c.charCodeAt(0)
  return ((Math.abs(h) % 17) - 8)
}
