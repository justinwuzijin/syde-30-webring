'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MOCK_MEMBERS, getEdges } from '@/lib/mock-data'
import { useForceLayout, CANVAS_SIZE } from '@/lib/use-force-layout'
import { getAccentColor } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'
import { PhotoFolder } from './photo-folder'

const MIN_ZOOM = 0.15
const MAX_ZOOM = 2
const ZOOM_SENSITIVITY = 0.002

export function WebringCanvas() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  // Camera state: pan (x,y) and zoom scale (k)
  const [camera, setCamera] = useState({ x: 0, y: 0, k: 0.5 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const edges = useMemo(() => getEdges(MOCK_MEMBERS), [])
  const positions = useForceLayout(MOCK_MEMBERS, edges)

  // Center the canvas on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setCamera({
      x: rect.width / 2 - (CANVAS_SIZE / 2) * 0.5,
      y: rect.height / 2 - (CANVAS_SIZE / 2) * 0.5,
      k: 0.5,
    })
  }, [])

  // ── Wheel → zoom (toward cursor) ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    setCamera(prev => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY
      const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * (1 + delta)))
      const ratio = newK / prev.k
      return {
        x: mouseX - (mouseX - prev.x) * ratio,
        y: mouseY - (mouseY - prev.y) * ratio,
        k: newK,
      }
    })
  }, [])

  // ── Drag → pan ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.polaroid-frame')) return
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Click polaroid → profile
  const handleCardClick = useCallback((memberId: string) => {
    router.push(`/profile/${memberId}`)
  }, [router])

  const transformStr = `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden"
      style={{
        background: '#ffffff',
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Canvas layer — transformed by camera */}
      <div
        style={{
          position: 'absolute',
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          transform: transformStr,
          transformOrigin: '0 0',
        }}
      >
        {MOCK_MEMBERS.map((m, i) => {
          const pos = positions.get(m.id)
          if (!pos) return null
          return (
            <PolaroidCard
              key={m.id}
              member={m}
              x={pos.x - POLAROID_WIDTH / 2}
              y={pos.y - POLAROID_HEIGHT / 2}
              onClick={() => handleCardClick(m.id)}
            />
          )
        })}
      </div>

      {/* Photo folder — fixed bottom-left */}
      <div className="fixed bottom-6 left-6 z-50">
        <PhotoFolder />
      </div>

      {/* Interaction hint */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 text-xs uppercase tracking-widest pointer-events-none"
        style={{ color: 'rgba(0,0,0,0.25)' }}
      >
        Scroll to zoom · Drag to pan · Click a polaroid to visit
      </div>
    </div>
  )
}
