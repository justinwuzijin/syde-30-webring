'use client'

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import { motion, useTransform, MotionValue } from 'framer-motion'
import { MOCK_MEMBERS } from '@/lib/mock-data'
import { WebringSiteCard, CARD_WIDTH, CARD_HEIGHT } from './webring-site-card'

const CARD_GAP = 60 // enough room for cards to expand on hover without overlapping
const GRID_PADDING = 40 // breathing room around the grid

function computeGridPositions(members: typeof MOCK_MEMBERS) {
  const n = members.length
  // Roughly square grid; grows naturally as members are added
  const cols = Math.max(2, Math.ceil(Math.sqrt(n)))
  const rows = Math.ceil(n / cols)
  const innerW = cols * (CARD_WIDTH + CARD_GAP) - CARD_GAP
  const innerH = rows * (CARD_HEIGHT + CARD_GAP) - CARD_GAP
  const canvasW = innerW + GRID_PADDING * 2
  const canvasH = innerH + GRID_PADDING * 2

  const positions = new Map<string, { x: number; y: number }>()
  members.forEach((m, i) => {
    positions.set(m.id, {
      x: GRID_PADDING + (i % cols) * (CARD_WIDTH + CARD_GAP),
      y: GRID_PADDING + Math.floor(i / cols) * (CARD_HEIGHT + CARD_GAP),
    })
  })

  return { positions, canvasW, canvasH }
}

interface WebringPortalProps {
  scrollYProgress: MotionValue<number>
}

export function WebringPortal({ scrollYProgress }: WebringPortalProps) {
  const [isFullyExpanded, setIsFullyExpanded] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const { positions, canvasW, canvasH } = useMemo(
    () => computeGridPositions(MOCK_MEMBERS),
    []
  )

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      setIsFullyExpanded(v > 0.92)
    })
    return unsubscribe
  }, [scrollYProgress])

  // ── Scroll-driven circle animation (unchanged) ──────────────────────────
  const circleSize = useTransform(scrollYProgress, [0, 0.8], [30, 200], { clamp: true })
  const circleLeft = useTransform(scrollYProgress, [0, 1], [50, 50])
  const circleTop = useTransform(scrollYProgress, [0, 1], [45, 50])
  const borderRadius = useTransform(scrollYProgress, [0, 0.7, 1], [50, 50, 0])
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])
  const zIndex = useTransform(scrollYProgress, [0, 1], [20, 50])
  const borderOpacity = useTransform(scrollYProgress, [0.8, 1], [0.12, 0])

  // ── Pan (drag) ──────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullyExpanded || !isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [isFullyExpanded, isDragging])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFullyExpanded) return
    if ((e.target as HTMLElement).closest('a, button')) return
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [isFullyExpanded])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  return (
    <motion.div
      className="absolute inset-0"
      style={{ zIndex, pointerEvents: 'none' }}
    >
      {/* The expanding circle */}
      <motion.div
        className="absolute overflow-hidden"
        style={{
          left: useTransform(circleLeft, v => `${v}%`),
          top: useTransform(circleTop, v => `${v}%`),
          width: useTransform(circleSize, v => `${v}vw`),
          height: useTransform(circleSize, v => `${v}vw`),
          x: '-50%',
          y: '-50%',
          borderRadius: useTransform(borderRadius, v => `${v}%`),
          background: '#ffffff',
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderColor: useTransform(borderOpacity, v => `rgba(0,0,0,${v})`),
          boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          pointerEvents: isFullyExpanded ? 'auto' : 'none',
          cursor: isFullyExpanded ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Always rendered — circle's overflow:hidden clips it; scroll reveals more */}
        <GridContent
          positions={positions}
          canvasW={canvasW}
          canvasH={canvasH}
          pan={pan}
        />
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute flex flex-col items-center gap-2"
        style={{
          left: '50%',
          top: '72%',
          x: '-50%',
          opacity: scrollIndicatorOpacity,
          zIndex: 40,
          pointerEvents: 'none',
        }}
      >
        <span className="text-white/50 text-xs lowercase tracking-[0.2em]">scroll to explore</span>
        <motion.div className="w-5 h-8 rounded-full border border-white/40 flex items-start justify-center p-1.5">
          <motion.div
            className="w-1 h-1.5 bg-white/60 rounded-full"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>

      {/* Interaction hint — only when fully expanded */}
      {isFullyExpanded && (
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] text-xs uppercase tracking-widest"
          style={{ color: 'rgba(0,0,0,0.25)', pointerEvents: 'none' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Drag to pan · Scroll up to return
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Grid content ────────────────────────────────────────────────────────────

interface GridContentProps {
  positions: Map<string, { x: number; y: number }>
  canvasW: number
  canvasH: number
  pan: { x: number; y: number }
}

function GridContent({ positions, canvasW, canvasH, pan }: GridContentProps) {
  // Centered within the circle via left/top 50% + negative translate.
  // As the circle grows (overflow:hidden clips), more cards are revealed.
  // Pan offset is added once the user can drag.
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: canvasW,
        height: canvasH,
        transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
        overflow: 'visible',
      }}
    >
      {MOCK_MEMBERS.map(m => {
        const pos = positions.get(m.id)
        if (!pos) return null
        return (
          <WebringSiteCard
            key={m.id}
            member={m}
            x={pos.x}
            y={pos.y}
          />
        )
      })}
    </div>
  )
}
