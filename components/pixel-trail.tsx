'use client'

import { useEffect, useRef } from 'react'

// Spider-Verse accent palette — cycles as trail ages
const TRAIL_COLORS = [
  '#E8251A', // red
  '#0a4fff', // blue
  '#ffdd00', // yellow
  '#ff6600', // orange
  '#cc44ff', // purple
  '#00cc88', // teal
]

const GRID_SIZE = 18        // px per pixel cell
const MAX_AGE   = 800       // ms before a trail point fades
const TRAIL_RADIUS = 36     // px — how far from cursor a cell lights up

interface TrailPoint {
  x: number
  y: number
  t: number  // timestamp
}

export function PixelTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trail = useRef<TrailPoint[]>([])
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Size canvas to window
    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Track mouse
    const onMove = (e: MouseEvent) => {
      trail.current.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      // Keep trail bounded
      if (trail.current.length > 600) trail.current.splice(0, 100)
    }
    window.addEventListener('mousemove', onMove)

    // Render loop
    const render = () => {
      const now = performance.now()

      // Prune old points
      trail.current = trail.current.filter(p => now - p.t < MAX_AGE)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (trail.current.length === 0) {
        raf.current = requestAnimationFrame(render)
        return
      }

      // Build a map: gridCell → strongest alpha + color index
      const cells = new Map<string, { alpha: number; colorIdx: number }>()

      for (const point of trail.current) {
        const age   = now - point.t
        const alpha = Math.max(0, 1 - age / MAX_AGE)
        if (alpha < 0.01) continue

        // Color index cycles through palette based on trail position
        const colorIdx = Math.floor((point.t / 120) % TRAIL_COLORS.length)

        // Grid cells near this point
        const gx0 = Math.floor((point.x - TRAIL_RADIUS) / GRID_SIZE)
        const gx1 = Math.ceil( (point.x + TRAIL_RADIUS) / GRID_SIZE)
        const gy0 = Math.floor((point.y - TRAIL_RADIUS) / GRID_SIZE)
        const gy1 = Math.ceil( (point.y + TRAIL_RADIUS) / GRID_SIZE)

        for (let gx = gx0; gx <= gx1; gx++) {
          for (let gy = gy0; gy <= gy1; gy++) {
            const cx = gx * GRID_SIZE + GRID_SIZE / 2
            const cy = gy * GRID_SIZE + GRID_SIZE / 2
            const dist = Math.sqrt((cx - point.x) ** 2 + (cy - point.y) ** 2)
            if (dist > TRAIL_RADIUS) continue

            const cellAlpha = alpha * (1 - dist / TRAIL_RADIUS)
            const key = `${gx},${gy}`
            const existing = cells.get(key)
            if (!existing || cellAlpha > existing.alpha) {
              cells.set(key, { alpha: cellAlpha, colorIdx })
            }
          }
        }
      }

      // Draw cells
      for (const [key, { alpha, colorIdx }] of cells) {
        const [gx, gy] = key.split(',').map(Number)
        const color = TRAIL_COLORS[colorIdx]
        ctx.globalAlpha = alpha * 0.75
        ctx.fillStyle = color
        // Leave 2px gap between cells (pixel grid feel)
        ctx.fillRect(
          gx * GRID_SIZE + 1,
          gy * GRID_SIZE + 1,
          GRID_SIZE - 2,
          GRID_SIZE - 2
        )
      }

      ctx.globalAlpha = 1
      raf.current = requestAnimationFrame(render)
    }

    raf.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        mixBlendMode: 'screen', // blends nicely over dark background
      }}
    />
  )
}
