'use client'

import { useRef, useState, useCallback, useMemo, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, useTransform, MotionValue } from 'framer-motion'
import { MOCK_MEMBERS, getEdges } from '@/lib/mock-data'
import { CANVAS_SIZE, useForceLayout } from '@/lib/use-force-layout'
import { getAccentColor } from '@/types/member'
import { WebThread } from './web-thread'
import { MemberCard } from './member-card'
import type { Member } from '@/types/member'

const SpiderWebBg = dynamic(() => import('./spider-web-bg'), { ssr: false })

interface WebringPortalProps {
  scrollYProgress: MotionValue<number>
}

export function WebringPortal({ scrollYProgress }: WebringPortalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const edges = useMemo(() => getEdges(MOCK_MEMBERS), [])
  const positions = useForceLayout(MOCK_MEMBERS, edges)
  
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isFullyExpanded, setIsFullyExpanded] = useState(false)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Track when fully expanded for interaction purposes
  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      setIsFullyExpanded(v > 0.85)
    })
    return unsubscribe
  }, [scrollYProgress])

  // Calculate the center of all nodes
  const graphCenter = useMemo(() => {
    if (positions.size === 0) return { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 }
    let sumX = 0, sumY = 0
    positions.forEach(pos => {
      sumX += pos.x
      sumY += pos.y
    })
    return { x: sumX / positions.size, y: sumY / positions.size }
  }, [positions])

  // Transform scroll progress to animation values using MotionValues
  // Circle size: 30vw -> 200vw (covers screen with overflow)
  const circleSize = useTransform(
    scrollYProgress, 
    [0, 0.8], 
    [30, 200],
    { clamp: true }
  )

  // Circle position: starts at center, stays centered
  const circleLeft = useTransform(scrollYProgress, [0, 1], [50, 50])
  const circleTop = useTransform(scrollYProgress, [0, 1], [45, 50])

  // Scale inside the circle: 0.22 -> 0.6
  const innerScale = useTransform(scrollYProgress, [0, 1], [0.22, 0.6])

  // Border radius: 50% -> 0% (round -> square)
  const borderRadius = useTransform(
    scrollYProgress, 
    [0, 0.7, 1], 
    [50, 50, 0]
  )

  // Scroll indicator opacity
  const scrollIndicatorOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])

  // Z-index increases as we scroll
  const zIndex = useTransform(scrollYProgress, [0, 1], [20, 50])

  // Border opacity
  const borderOpacity = useTransform(scrollYProgress, [0.8, 1], [0.12, 0])

  // Pan handlers (only when fully expanded)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isFullyExpanded || !dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [isFullyExpanded])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFullyExpanded) return
    if ((e.target as HTMLElement).closest('a, button')) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [isFullyExpanded])

  const handleMouseUp = useCallback(() => {
    dragging.current = false
  }, [])

  const handleCardClick = useCallback((_member: Member) => {
    // Future: open member detail
  }, [])

  // Nodes connected to hovered node
  const connectedIds = useMemo(() => {
    const set = new Set<string>()
    if (hoveredId) {
      for (const e of edges) {
        if (e.source === hoveredId) set.add(e.target)
        if (e.target === hoveredId) set.add(e.source)
      }
    }
    return set
  }, [hoveredId, edges])

  const hasPositions = positions.size > 0

  return (
    <motion.div
      ref={containerRef}
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
          background: '#0a0a0f',
          borderWidth: 1.5,
          borderStyle: 'solid',
          borderColor: useTransform(borderOpacity, v => `rgba(255,255,255,${v})`),
          boxShadow: 'inset 0 0 60px 20px rgba(0,0,0,0.7), 0 8px 40px rgba(0,0,0,0.6)',
          pointerEvents: isFullyExpanded ? 'auto' : 'none',
          cursor: isFullyExpanded ? (dragging.current ? 'grabbing' : 'grab') : 'default',
        }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Spider-web animated background — inside the circle */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <SpiderWebBg
            lineColor="rgba(255, 255, 255, 0.55)"
            spokeCount={16}
            ringCount={12}
            hoverRadius={16}
            vicinityRadius={90}
          />
        </div>

        {/* Loading state */}
        {!hasPositions && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/30 text-xs">Loading...</span>
          </div>
        )}
        
        {hasPositions && (
          <WebringContent
            positions={positions}
            edges={edges}
            graphCenter={graphCenter}
            innerScale={innerScale}
            circleSize={circleSize}
            pan={pan}
            hoveredId={hoveredId}
            connectedIds={connectedIds}
            isFullyExpanded={isFullyExpanded}
            setHoveredId={setHoveredId}
            onCardClick={handleCardClick}
          />
        )}
      </motion.div>

      {/* Scroll indicator - below the circle */}
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
        <motion.div
          className="w-5 h-8 rounded-full border border-white/40 flex items-start justify-center p-1.5"
        >
          <motion.div
            className="w-1 h-1.5 bg-white/60 rounded-full"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>

      {/* Interaction hint - only when fully expanded */}
      {isFullyExpanded && (
        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[60] text-xs uppercase tracking-widest"
          style={{ color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }}
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

// Separate component for webring content - uses motion values directly, no React state
interface WebringContentProps {
  positions: Map<string, { x: number; y: number }>
  edges: { source: string; target: string; id: string }[]
  graphCenter: { x: number; y: number }
  innerScale: MotionValue<number>
  circleSize: MotionValue<number>
  pan: { x: number; y: number }
  hoveredId: string | null
  connectedIds: Set<string>
  isFullyExpanded: boolean
  setHoveredId: (id: string | null) => void
  onCardClick: (member: Member) => void
}

function WebringContent({
  positions,
  edges,
  graphCenter,
  innerScale,
  circleSize,
  pan,
  hoveredId,
  connectedIds,
  isFullyExpanded,
  setHoveredId,
  onCardClick,
}: WebringContentProps) {
  const [windowWidth, setWindowWidth] = useState(1440)
  
  // Only update window width on resize, not on scroll
  useEffect(() => {
    setWindowWidth(window.innerWidth)
    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Derive transform values directly from MotionValues - no React state updates on scroll
  const translateX = useTransform(
    [circleSize, innerScale] as MotionValue<number>[],
    ([size, scale]: number[]) => {
      const circleSizePx = (size / 100) * windowWidth
      return circleSizePx / 2 - graphCenter.x * scale + pan.x
    }
  )
  
  const translateY = useTransform(
    [circleSize, innerScale] as MotionValue<number>[],
    ([size, scale]: number[]) => {
      const circleSizePx = (size / 100) * windowWidth
      return circleSizePx / 2 - graphCenter.y * scale + pan.y
    }
  )

  return (
    <>
      {/* SVG threads layer - uses motion.svg for smooth transforms */}
      <motion.svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          overflow: 'visible',
          x: translateX,
          y: translateY,
          scale: innerScale,
          transformOrigin: '0 0',
          zIndex: 1,
        }}
      >
        {edges.map((edge, i) => {
          const s = positions.get(edge.source)
          const t = positions.get(edge.target)
          if (!s || !t) return null
          const highlighted = hoveredId !== null && 
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
      </motion.svg>

      {/* HTML member cards layer - uses motion.div for smooth transforms */}
      <motion.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          x: translateX,
          y: translateY,
          scale: innerScale,
          transformOrigin: '0 0',
          zIndex: 2,
          pointerEvents: isFullyExpanded ? 'auto' : 'none',
        }}
      >
        {MOCK_MEMBERS.map((m, i) => {
          const pos = positions.get(m.id)
          if (!pos) return null
          return (
            <div key={m.id} style={{ pointerEvents: isFullyExpanded ? 'auto' : 'none' }}>
              <MemberCard
                member={m}
                x={pos.x}
                y={pos.y}
                accent={getAccentColor(i)}
                index={i}
                isHighlighted={connectedIds.has(m.id)}
                onHover={isFullyExpanded ? setHoveredId : () => {}}
                onClick={onCardClick}
              />
            </div>
          )
        })}
      </motion.div>
    </>
  )
}
