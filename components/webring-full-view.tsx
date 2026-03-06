'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { MOCK_MEMBERS, getEdges } from '@/lib/mock-data'
import { CANVAS_SIZE } from '@/lib/use-force-layout'
import { WebCanvas } from './web-canvas'
import type { Member } from '@/types/member'

const INITIAL_K = 0.55

interface WebringFullViewProps {
  onClose: () => void
}

export function WebringFullView({ onClose }: WebringFullViewProps) {
  const edges = useMemo(() => getEdges(MOCK_MEMBERS), [])
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: INITIAL_K })

  // Center the graph on mount
  useEffect(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    setTransform({
      x: w / 2 - (CANVAS_SIZE / 2) * INITIAL_K,
      y: h / 2 - (CANVAS_SIZE / 2) * INITIAL_K,
      k: INITIAL_K,
    })
  }, [])

  // Wheel zoom — keeps the canvas point under cursor fixed
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9

    setTransform(prev => {
      const k = Math.max(0.2, Math.min(3, prev.k * factor))
      const dk = k / prev.k
      return {
        x: mx + (prev.x - mx) * dk,
        y: my + (prev.y - my) * dk,
        k,
      }
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleCardClick = useCallback((_member: Member) => {
    // Future: open member detail panel
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 select-none overflow-hidden"
      style={{
        background: 'var(--bg)',
        cursor: dragging.current ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Web graph */}
      <WebCanvas
        members={MOCK_MEMBERS}
        edges={edges}
        panX={transform.x}
        panY={transform.y}
        scale={transform.k}
        hoveredId={hoveredId}
        onHover={setHoveredId}
        onCardClick={handleCardClick}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest border transition-colors"
        style={{
          color: 'var(--text)',
          borderColor: 'rgba(255,255,255,0.2)',
          background: 'rgba(8,8,8,0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        ← Back
      </button>

      {/* Zoom hint */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-widest pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        Scroll to zoom · Drag to pan
      </div>
    </div>
  )
}
