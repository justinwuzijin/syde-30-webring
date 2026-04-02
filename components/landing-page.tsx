'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { StretchText } from './stretch-text'
import type { Member } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'
import {
  computeScrapbookPositions,
  computeClassroomPositions,
  computePilePositions,
  CARD_GAP,
  GRID_PADDING,
} from '@/lib/placement'
import { PhotoFolder } from './photo-folder'
import { Input } from './ui/input'
import { AssetEditor } from './asset-editor'
import { useSound } from '@/lib/use-sound'
import { usePageTransition } from './page-transition'
import { MePanel } from './me-panel'
import { flushSync } from 'react-dom'

const GooseViewer = dynamic(() => import('./goose-viewer'), { ssr: false })

// Module-level set so revealed names survive remounts/navigation
const revealedNamesSet = new Set<string>()

type Phase = 'splash' | 'transitioning' | 'expanded' | 'collapsing'
type ViewMode = 'scrapbook' | 'classroom' | 'me'

// Transition timing
const EXPAND_DURATION = 1200 // Slower circle expansion
const SPLASH_FADE_DURATION = 500
const EXPANDED_DELAY = EXPAND_DURATION + 100
const GRID_ZOOM_DELAY = 450 // Pause before grid starts zooming in (noticeable beat)
const GRID_ZOOM_DURATION = 800 // Slower zoom animation after the pause
const AURA_FADE_DURATION = 300 // How fast the spinner aura fades out/in

// Pan/zoom limits
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_SENSITIVITY = 0.003

/** Splash preview offset. Must match scrapbook camera on expand for zero-shift transitions. */
const PREVIEW_OFFSET_X = 0
const PREVIEW_OFFSET_Y = 0
const DESKTOP_ZOOM = 0.95
const MOBILE_ZOOM = 0.8
const CLASSROOM_TOP_OFFSET_PX = 104
const CLASSROOM_BOTTOM_GUTTER_PX = 24

/** Landing preview: all members */
function getLandingPreviewMembers(members: Member[]): Member[] {
  return members
}

/** Compute positions for scrapbook (center-out, tilt) or classroom (rigid grid) */
function computePositions(
  members: Member[],
  mode: ViewMode,
  viewportWidth?: number
): {
  positions: Map<string, { x: number; y: number; rotation?: number }>
  canvasW: number
  canvasH: number
} {
  if (mode === 'classroom') {
    const { positions, canvasW, canvasH } = computeClassroomPositions(members, viewportWidth)
    return { positions, canvasW, canvasH }
  }
  const { positions, canvasW, canvasH } = computeScrapbookPositions(members)
  return { positions, canvasW, canvasH }
}


export function LandingPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout, setUserFromToken } = useAuth()
  const { startTransition, endTransition } = usePageTransition()

  // Sound effects
  const playClick = useSound('/click.mp3', { volume: 0.4 })
  const playFolderHover = useSound('/folder-hover.mp3', { volume: 0.4 })
  const playPageTurn = useSound('/page-turn.mp3', { volume: 0.4 })

  // Check if we should start in expanded view (coming back from profile)
  const startExpanded = searchParams.get('view') === 'webring'
  const [phase, setPhase] = useState<Phase>(startExpanded ? 'expanded' : 'splash')
  const [pageReady, setPageReady] = useState(false)
  const circleRef = useRef<HTMLDivElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('scrapbook')
  const [navigatingToProfile, setNavigatingToProfile] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : 1200)
  )
  const [viewportHeight, setViewportHeight] = useState(
    () => (typeof window !== 'undefined' ? window.innerHeight : 900)
  )

  // Defer heavy work until after initial paint so loading spinner animates smoothly
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    // Use requestIdleCallback if available, otherwise setTimeout
    // This lets the spinner render and start animating before we do heavy work
    const id = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback(() => setHydrated(true), { timeout: 300 })
      : setTimeout(() => setHydrated(true), 100)
    return () => {
      if (typeof requestIdleCallback !== 'undefined') {
        cancelIdleCallback(id as number)
      } else {
        clearTimeout(id as ReturnType<typeof setTimeout>)
      }
    }
  }, [])

  // Detect mobile viewport (for responsive circle sizing)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Track viewport width for dynamic classroom columns
  useEffect(() => {
    const updateViewport = () => {
      setViewportWidth(window.innerWidth)
      setViewportHeight(window.innerHeight)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  // Fetch members from Supabase with SWR (cached, deduped)
  // Defer fetch until hydrated so loading spinner can animate smoothly first
  const { data: membersData, isLoading: membersLoading } = useSWR<{ members: Member[] }>(
    hydrated ? '/api/members' : null,
    (url) => fetch(url).then((r) => r.json()),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )
  const members = membersData?.members ?? []
  const isSplash = phase === 'splash'
  const isExpanded = phase === 'expanded'

  // Splash (landing preview): only Leo and Justin. Expanded: all members.
  const displayMembers = isSplash ? getLandingPreviewMembers(members) : members
  const placementMode = isSplash ? 'scrapbook' : viewMode
  const { positions, canvasW, canvasH } = useMemo(
    () => computePositions(displayMembers, placementMode, viewportWidth),
    [displayMembers, placementMode, viewportWidth]
  )

  // Pile positions: all cards stacked at canvas center (scrapbook only)
  const pilePositions = useMemo(
    () => computePilePositions(displayMembers, canvasW, canvasH),
    [displayMembers, canvasW, canvasH]
  )

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return displayMembers
    return displayMembers.filter((m) => {
      const firstName = m.name.split(' ')[0] ?? ''
      return firstName.toLowerCase().startsWith(query)
    })
  }, [searchTerm, displayMembers])

  const isSearching = searchTerm.trim().length > 0
  const filteredSet = useMemo(() => new Set(filteredMembers.map(m => m.id)), [filteredMembers])
  const filteredIndexMap = useMemo(() => new Map(filteredMembers.map((m, i) => [m.id, i])), [filteredMembers])

  // Fan positions: filtered cards spread out from pile center on hover (scrapbook search)
  const pileFanPositions = useMemo(() => {
    if (!isSearching || placementMode !== 'scrapbook') return null
    const N = filteredMembers.length
    if (N === 0) return null
    const cx = canvasW / 2 - POLAROID_WIDTH / 2
    const cy = canvasH / 2 - POLAROID_HEIGHT / 2
    const fanGap = 24
    const totalWidth = N * POLAROID_WIDTH + (N - 1) * fanGap
    const startX = cx - (totalWidth - POLAROID_WIDTH) / 2
    const map = new Map<string, { x: number; y: number; rotation: number }>()
    filteredMembers.forEach((m, i) => {
      // Slight diagonal drop + subtle spread rotation
      const t = N > 1 ? (i / (N - 1) - 0.5) : 0
      map.set(m.id, {
        x: startX + i * (POLAROID_WIDTH + fanGap),
        y: cy + Math.abs(t) * 20,
        rotation: t * 10,
      })
    })
    return map
  }, [isSearching, filteredMembers, placementMode, canvasW, canvasH])

  // Classroom search row: filtered cards in first row, left-aligned same as regular grid
  const classroomSearchPositions = useMemo(() => {
    if (!isSearching || placementMode !== 'classroom') return null
    // Reuse the same classroom layout logic on just the filtered members
    // so they start at the exact same left offset as the full grid
    const { positions: searchPos } = computeClassroomPositions(filteredMembers, viewportWidth)
    // Only keep the first-row entries (all results are already in row 0 since count ≤ cols)
    return searchPos
  }, [isSearching, filteredMembers, placementMode, viewportWidth])

  // Separate camera states for scrapbook and classroom views
  const defaultZoom = isMobile ? MOBILE_ZOOM : DESKTOP_ZOOM
  const [scrapbookCamera, setScrapbookCamera] = useState(() =>
    startExpanded
      ? { x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: defaultZoom }
      : { x: 0, y: 0, k: 1 }
  )
  // Classroom always starts at default position (reset on each switch)
  const [classroomCamera, setClassroomCamera] = useState({ x: 0, y: 0, k: 1 })
  
  // Active camera based on view mode
  const camera = viewMode === 'classroom' ? classroomCamera : scrapbookCamera
  const setCamera = viewMode === 'classroom' ? setClassroomCamera : setScrapbookCamera
  
  const [isDragging, setIsDragging] = useState(false)
  const [isHoveringPreview, setIsHoveringPreview] = useState(false)
  const [pileHoverCount, setPileHoverCount] = useState(0)
  const isPileHovered = pileHoverCount > 0
  const lastPos = useRef({ x: 0, y: 0 })
  // Suppress CSS transition during any active interaction (drag, wheel, touch)
  const [isInteracting, setIsInteracting] = useState(false)
  const interactTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const markInteracting = useCallback(() => {
    setIsInteracting(true)
    if (interactTimeout.current) clearTimeout(interactTimeout.current)
    interactTimeout.current = setTimeout(() => setIsInteracting(false), 120)
  }, [])

  // Touch state for pan and pinch-to-zoom
  const touchStartRef = useRef<{ x: number; y: number; dist: number; k: number } | null>(null)
  const lastTouchPos = useRef({ x: 0, y: 0 })

  // Remount goose when returning to home
  const prevPathname = useRef<string | null>(null)
  const [gooseKey, setGooseKey] = useState(0)
  useEffect(() => {
    if (pathname === '/') {
      if (prevPathname.current !== null && prevPathname.current !== '/') {
        setGooseKey(k => k + 1)
        // Check if we should go to webring view or splash
        const viewParam = searchParams.get('view')
        if (viewParam === 'webring') {
          setPhase('expanded')
        } else {
          setPhase('splash')
          setScrapbookCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: 1 })
        }
      }
      prevPathname.current = '/'
    } else {
      prevPathname.current = pathname
    }
  }, [pathname, searchParams])

  // Fade out the white intro overlay after a short delay
  // Also signal the global page transition that this page is ready
  useEffect(() => {
    const id = setTimeout(() => {
      setPageReady(true)
      endTransition()
    }, 600)
    return () => clearTimeout(id)
  }, [endTransition])

  // Click the circle → expand (camera offset matches splash so no jump)
  const handleEnterWebring = useCallback(() => {
    if (phase !== 'splash') return
    playClick()
    setPhase('transitioning')
    setTimeout(() => {
      setViewMode('scrapbook')
      setScrapbookCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: defaultZoom })
      setPhase('expanded')
    }, EXPANDED_DELAY)
  }, [phase, playClick])


  const clampClassroomY = useCallback((y: number) => {
    const visibleHeight = Math.max(0, viewportHeight - CLASSROOM_TOP_OFFSET_PX - CLASSROOM_BOTTOM_GUTTER_PX)
    const minY = Math.min(0, visibleHeight - canvasH)
    return Math.max(minY, Math.min(0, y))
  }, [viewportHeight, canvasH])

  // ── Wheel interactions (attached as non-passive via ref for preventDefault) ──
  const handleWheel = useCallback((e: WheelEvent) => {
    if (phase !== 'expanded') return
    if (viewMode === 'me') return
    if (viewMode === 'classroom') {
      // Let native overflowY: auto handle scrolling
      return
    }
    e.preventDefault()
    markInteracting()

    // Detect trackpad vs mouse wheel:
    // - Trackpad pinch: ctrlKey is set
    // - Trackpad two-finger scroll: has significant deltaX, or deltaMode is 0 with small deltaY
    // - Mouse wheel: deltaMode is usually 0 or 1, no deltaX, larger deltaY jumps
    const isPinchZoom = e.ctrlKey
    const isTrackpadPan = !e.ctrlKey && (Math.abs(e.deltaX) > 2 || (e.deltaMode === 0 && Math.abs(e.deltaY) < 50))
    
    if (isPinchZoom || !isTrackpadPan) {
      // Zoom: pinch gesture OR mouse wheel scroll
      setScrapbookCamera(prev => {
        const delta = -e.deltaY * ZOOM_SENSITIVITY
        const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * (1 + delta)))
        const ratio = newK / prev.k
        return {
          x: prev.x * ratio,
          y: prev.y * ratio,
          k: newK,
        }
      })
    } else {
      // Pan: two-finger trackpad scroll
      setScrapbookCamera(prev => ({
        ...prev,
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY,
      }))
    }
  }, [phase, viewMode, clampClassroomY, markInteracting])

  // Attach wheel as non-passive so preventDefault works (React onWheel is passive)
  useEffect(() => {
    const el = circleRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Drag → pan (expanded scrapbook only) ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (phase !== 'expanded') return
    if (viewMode === 'me' || viewMode === 'classroom') return
    if ((e.target as HTMLElement).closest('.polaroid-frame, button, a')) return
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [phase, viewMode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    
    // Scrapbook: free pan in all directions
    setScrapbookCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // ── Touch handlers for mobile pan + pinch-to-zoom ──
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (phase !== 'expanded' || viewMode === 'me' || viewMode === 'classroom') return
    // On desktop, block drag from polaroids; on mobile, allow pan from anywhere
    if ((e.target as HTMLElement).closest('button, a')) return

    if (e.touches.length === 1) {
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      setIsDragging(true)
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      lastTouchPos.current = { x: midX, y: midY }
      touchStartRef.current = {
        x: midX, y: midY, dist,
        k: scrapbookCamera.k,
      }
    }
  }, [phase, viewMode, scrapbookCamera.k])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (phase !== 'expanded' || viewMode === 'me' || viewMode === 'classroom') return
    e.preventDefault() // prevent scroll
    markInteracting() // Disable CSS transitions during touch drag for smooth response

    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - lastTouchPos.current.x
      const dy = e.touches[0].clientY - lastTouchPos.current.y
      setScrapbookCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
      lastTouchPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2 && touchStartRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2

      // Pan from midpoint movement
      const panDx = midX - lastTouchPos.current.x
      const panDy = midY - lastTouchPos.current.y
      lastTouchPos.current = { x: midX, y: midY }

      // Pinch-to-zoom (scrapbook only)
      const scale = dist / touchStartRef.current.dist
      const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, touchStartRef.current.k * scale))
      setScrapbookCamera(prev => {
        const ratio = newK / prev.k
        return { x: prev.x * ratio + panDx, y: prev.y * ratio + panDy, k: newK }
      })
    }
  }, [phase, viewMode, isDragging, markInteracting])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) touchStartRef.current = null
    if (e.touches.length === 0) setIsDragging(false)
  }, [])

  // Click polaroid → profile (expanded only)
  const handleCardClick = useCallback((memberId: string) => {
    if (phase !== 'expanded') return
    playClick()
    // Replace current history entry so browser back returns to webring view, not splash
    window.history.replaceState(null, '', '/?view=webring')
    // Show loading spinner, then navigate
    startTransition({ waitForManualEnd: true })
    setNavigatingToProfile(true)
    setTimeout(() => {
      router.push(`/profile/${memberId}`)
    }, 220)
  }, [phase, router, playClick])

  const isTransitioning = phase === 'transitioning'

  // In expanded state, the grid is transformed by camera; otherwise centered
  // Classroom mode anchors grid to top-left (aligned with photo folder at 5%, below toggles at ~6rem)
  const isClassroom = isExpanded && viewMode === 'classroom'
  const isMe = isExpanded && viewMode === 'me'

  // During transition, interpolate to target scale for smooth zoom (with pause)
  const getGridTransform = () => {
    if (isExpanded) {
      if (isClassroom) return 'none'
      return `translate(calc(-50% + ${camera.x}px), calc(-50% + ${camera.y}px)) scale(${camera.k})`
    }
    if (isTransitioning) {
      // Target scale for the zoom-in animation (starts after GRID_ZOOM_DELAY)
      return `translate(calc(-50% - ${PREVIEW_OFFSET_X}px), calc(-50% - ${PREVIEW_OFFSET_Y}px)) scale(${defaultZoom})`
    }
    // Splash state AND collapsing: both use the same final splash layout so the content
    // is already at rest when the circle starts shrinking (looks like one unified layer)
    return `translate(calc(-50% - ${PREVIEW_OFFSET_X}px), calc(-50% - ${PREVIEW_OFFSET_Y}px)) scale(0.62)`
  }
  const gridTransform = getGridTransform()

  return (
    <div className="relative bg-white h-screen w-full overflow-hidden select-none md:select-auto">

      {/* ── The circle — zooms in on click, becomes the canvas ── */}
      <motion.div
        ref={circleRef}
        className="absolute overflow-hidden"
        style={{
          left: '50%',
          top: isSplash ? (isMobile ? '46%' : '50%') : '50%',
          x: '-50%',
          y: '-50%',
          background: '#f6f8fb',
          backgroundImage: [
            'linear-gradient(rgba(160,195,220,0.25) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(160,195,220,0.25) 1px, transparent 1px)',
            'linear-gradient(rgba(160,195,220,0.10) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(160,195,220,0.10) 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: '80px 80px, 80px 80px, 16px 16px, 16px 16px',
          overflowX: 'hidden',
          overflowY: isClassroom ? 'auto' : 'hidden',
          boxShadow: isSplash ? '0 8px 40px rgba(0,0,0,0.15)' : 'none',
          cursor: isSplash
            ? 'pointer'
            : isMe || isClassroom ? 'default' : isDragging ? 'grabbing' : isExpanded ? 'grab' : 'default',
          zIndex: 20,
          touchAction: isClassroom ? 'pan-y' : 'none',
          maskImage: isClassroom
            ? 'linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)'
            : undefined,
          WebkitMaskImage: isClassroom
            ? 'linear-gradient(to bottom, transparent 0%, black 8%, black 88%, transparent 100%)'
            : undefined,
          willChange: isTransitioning ? 'width, height, border-radius, transform' : 'auto',
        }}
        animate={
          isExpanded ? {
            // Snap instantly to full-screen rect after the circle has covered viewport
            width: '100vw',
            height: '100vh',
            borderRadius: '0%',
            scale: 1,
          } : isSplash ? {
            width: isMobile ? '65vw' : '30vw',
            height: isMobile ? '65vw' : '30vw',
            borderRadius: '50%',
            scale: isHoveringPreview ? 1.04 : 1,
          } : {
            // transitioning or collapsing: perfect circle large enough to fill the screen
            width: '200vmax',
            height: '200vmax',
            borderRadius: '50%',
            scale: 1,
          }
        }
        transition={{
          width: {
            duration: isExpanded ? 0 : isSplash ? 0.7 : EXPAND_DURATION / 1000,
            ease: [0.22, 1, 0.36, 1],
          },
          height: {
            duration: isExpanded ? 0 : isSplash ? 0.7 : EXPAND_DURATION / 1000,
            ease: [0.22, 1, 0.36, 1],
          },
          borderRadius: {
            duration: isExpanded ? 0 : isSplash ? 0.7 : EXPAND_DURATION / 1000,
            ease: [0.22, 1, 0.36, 1],
          },
          scale: { duration: 0.2, ease: 'easeOut' },
        }}
        onMouseEnter={() => { if (isSplash) setIsHoveringPreview(true) }}
        onMouseLeave={(e) => {
          setIsHoveringPreview(false)
          handleMouseUp()
        }}
        onClick={isSplash ? handleEnterWebring : undefined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Polaroid grid — hidden in \"me\" view */}
        {!isMe && (
          <div
            style={{
              position: isClassroom ? 'relative' : 'absolute',
              left: isClassroom ? 'auto' : '50%',
              top: isClassroom ? 'auto' : '50%',
              width: isClassroom ? '100%' : canvasW,
              height: isClassroom ? canvasH + 80 : canvasH,
              transform: gridTransform,
              transformOrigin: isClassroom ? undefined : '50% 50%',
              paddingBottom: isClassroom ? '2rem' : undefined,
              opacity: (isSplash || phase === 'collapsing') ? 0.7 : isTransitioning ? 0.85 : 1,
              willChange: 'transform',
              // Collapsing: instant snap so grid content matches splash layout before circle shrinks
              // Transitioning: pause first (GRID_ZOOM_DELAY), then zoom in smoothly
              // Expanded but not interacting: keep transform transition so pan/zoom feels smooth
              transition: phase === 'collapsing'
                ? 'none'
                : isTransitioning
                ? `opacity 0.5s ease, transform ${GRID_ZOOM_DURATION / 1000}s cubic-bezier(0.16, 1, 0.3, 1) ${GRID_ZOOM_DELAY / 1000}s`
                : isSplash
                  ? 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.22,1,0.36,1)'
                  : isInteracting
                    ? 'opacity 0.5s ease'
                    : 'opacity 0.6s ease, transform 0.8s cubic-bezier(0.22,1,0.36,1)',
              pointerEvents: isExpanded ? 'auto' : 'none',
            }}
          >
            {membersLoading && displayMembers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p
                  className="text-black/40 text-xs lowercase tracking-[0.2em]"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, \"SF Pro Display\", system-ui, sans-serif' }}
                >
                  loading polaroids…
                </p>
              </div>
            )}

            {displayMembers.map((m, globalIdx) => {
              const isScrapbook = placementMode === 'scrapbook'
              const isActive = !isSearching || filteredSet.has(m.id)
              const filteredIdx = filteredIndexMap.get(m.id) ?? 0

              // Position: scrapbook+searching+hovered → fan; scrapbook+searching → pile; scrapbook → spread
              // Classroom+searching → row; classroom → grid
              let pos
              if (isScrapbook) {
                if (isSearching && isActive) {
                  pos = isPileHovered
                    ? pileFanPositions?.get(m.id)
                    : pilePositions.get(m.id)
                } else {
                  pos = positions.get(m.id)
                }
              } else {
                pos = (isSearching && isActive && classroomSearchPositions)
                  ? classroomSearchPositions.get(m.id)
                  : positions.get(m.id)
              }
              if (!pos) return null
              const hasRotation = 'rotation' in pos && typeof pos.rotation === 'number'

              // Stagger delay: entering pile (search starts) staggers in; fanning out staggers out;
              // reappearing (search clears) staggers back in by original grid index
              const staggerDelay = isScrapbook && isSearching && isActive
                ? filteredIdx * 0.03
                : !isSearching && isActive
                  ? globalIdx * 0.012
                  : 0

              // Opacity transition: classroom reappear fades in smoothly; scrapbook and hide are instant
              const opacityTransition = !isScrapbook && !isSearching && isActive
                ? `opacity 0.3s ease ${globalIdx * 0.012}s`
                : 'opacity 0s'

              return (
                // Wrapper controls visibility without unmounting — prevents fly-from-origin on search clear
                <div
                  key={m.id}
                  style={{ opacity: isActive ? 1 : 0, pointerEvents: isActive ? 'auto' : 'none', transition: opacityTransition }}
                  onMouseEnter={isScrapbook && isSearching && isActive ? () => setPileHoverCount(c => c + 1) : undefined}
                  onMouseLeave={isScrapbook && isSearching && isActive ? () => setPileHoverCount(c => Math.max(0, c - 1)) : undefined}
                >
                  <PolaroidCard
                    member={m}
                    x={pos.x}
                    y={pos.y}
                    onClick={isExpanded && isActive ? () => handleCardClick(m.id) : undefined}
                    noTilt={placementMode === 'classroom' || (isScrapbook && isSearching && isPileHovered)}
                    rotation={hasRotation ? (pos as { x: number; y: number; rotation: number }).rotation : undefined}
                    onHover={isActive ? playPageTurn : undefined}
                    initialNameRevealed={revealedNamesSet.has(m.id)}
                    onNameReveal={() => revealedNamesSet.add(m.id)}
                    transitionDelay={staggerDelay}
                  />
                </div>
              )
            })}
          </div>
        )}

        {/* Frosted glass transition ring — only render in splash to avoid mobile artifacts */}
        {isSplash && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            transition={{ duration: AURA_FADE_DURATION / 1000, ease: 'easeOut' }}
            style={{
              zIndex: 5,
              backgroundImage: [
                  // Frosted band base
                  'radial-gradient(circle at center, transparent 56%, rgba(255,255,255,0.14) 66%, rgba(255,255,255,0.08) 76%, transparent 86%)',
                  // One continuous ribbon with smooth opacity falloff.
                  // Rotate this layer to communicate direction; the ribbon itself is not segmented.
                  'conic-gradient(from 0deg,' +
                    ' rgba(255,140,205,0.33) 0deg,' + // pink (not a hard head)
                    ' rgba(200,110,245,0.34) 35deg,' + // purple neck
                    ' rgba(155,125,255,0.33) 85deg,' + // purple -> blue blend
                    ' rgba(110,155,255,0.30) 150deg,' + // blue body
                    ' rgba(85,165,255,0.24) 215deg,' + // soften
                    ' rgba(85,165,255,0.14) 275deg,' + // gentle fade
                    ' rgba(85,165,255,0.0) 325deg,' + // transparent into bg
                    ' transparent 360deg' +
                    ')',
                ].join(','),
                boxShadow: '0 0 54px rgba(0,0,0,0.05), inset 0 0 0 1px rgba(255,255,255,0.20)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                // Feathered mask so the ribbon floats slightly away from the exact edge.
                maskImage:
                  'radial-gradient(circle, rgba(0,0,0,0) 58%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,0.30) 78%, rgba(0,0,0,0) 86%)',
                WebkitMaskImage:
                  'radial-gradient(circle, rgba(0,0,0,0) 58%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.95) 70%, rgba(0,0,0,0.30) 78%, rgba(0,0,0,0) 86%)',
                // More blur falloff = less border-stroke feel, more “ink in water”.
                filter: 'blur(8px)',
                animationName: 'webringPastelSpin',
                animationDuration: '3.5s',
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
              }}
          />
        )}

        {/* Gaussian blur vignette inside the circle so edges fade and "click to explore" pops */}
        {isSplash && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              zIndex: 4,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              maskImage: 'radial-gradient(circle, transparent 42%, black 72%)',
              WebkitMaskImage: 'radial-gradient(circle, transparent 42%, black 72%)',
            }}
          />
        )}

        {/* "click to explore" — lower in circle for visibility, fades out */}
        <motion.div
          className="absolute inset-0 flex items-end justify-center"
          style={{ pointerEvents: 'none', zIndex: 10, paddingBottom: '10%' }}
          animate={{ opacity: isSplash ? 1 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <span
            className="text-black/50 text-sm lowercase tracking-[0.15em] font-medium"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            click to explore
          </span>
        </motion.div>
      </motion.div>

      {/* ── Search bar — top center, expanded only (outside header bubble) ── */}
      <motion.div
        className="fixed top-6 z-50 left-[7rem] right-6 md:left-1/2 md:right-auto md:w-full md:max-w-md md:-translate-x-1/2 md:px-4"
        animate={{ opacity: (isExpanded && !isMe) ? 1 : 0, y: (isExpanded && !isMe) ? 0 : -10 }}
        transition={{ duration: 0.25, delay: (isExpanded && !isMe) ? 0.35 : 0 }}
        style={{ pointerEvents: (isExpanded && !isMe) ? 'auto' : 'none' }}
      >
        <div className="flex items-center rounded-full border border-neutral-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          <Input
            type="text"
            placeholder="Search by first name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="relative bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 text-xs md:text-sm text-neutral-900 placeholder:text-neutral-500 px-3 md:px-5 py-2 md:py-2.5 rounded-full"
          />
        </div>
      </motion.div>

      {/* ── Glossy header bubble (tabs only) ── */}
      <motion.div
        className="fixed top-[4.45rem] left-1/2 z-50 -translate-x-1/2"
        animate={{ opacity: isExpanded ? 1 : 0, y: isExpanded ? (isMe ? -47 : 0) : -10 }}
        transition={{ duration: 0.3, delay: isExpanded && !isMe ? 0 : isExpanded ? 0.2 : 0 }}
        style={{ pointerEvents: isExpanded ? 'auto' : 'none' }}
      >
          <div className="relative rounded-full border border-neutral-200 bg-white px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
            <div className="relative flex items-center justify-center gap-4 md:gap-5">
              <div
                className="flex flex-col items-center"
                style={{
                  paddingBottom: 0,
                }}
              >
                <button
                  onClick={() => {
                    playClick()
                    setScrapbookCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: defaultZoom })
                    setViewMode('scrapbook')
                  }}
                  className="flex items-center gap-1.5 text-sm transition-colors"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full transition-colors"
                    style={{ backgroundColor: viewMode === 'scrapbook' ? '#171717' : '#d4d4d4' }}
                  />
                  <span style={{ color: viewMode === 'scrapbook' ? '#171717' : '#a3a3a3' }}>
                    scrapbook
                  </span>
                </button>
              </div>
              <div
                className="flex flex-col items-center"
                style={{
                  paddingBottom: 0,
                }}
              >
                <button
                  onClick={() => { playClick(); setClassroomCamera({ x: 0, y: 0, k: 1 }); setViewMode('classroom') }}
                  className="flex items-center gap-1.5 text-sm transition-colors"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full transition-colors"
                    style={{ backgroundColor: viewMode === 'classroom' ? '#171717' : '#d4d4d4' }}
                  />
                  <span style={{ color: viewMode === 'classroom' ? '#171717' : '#a3a3a3' }}>
                    classroom
                  </span>
                </button>
              </div>
              {user && (
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => { playClick(); setViewMode('me') }}
                    className="flex items-center gap-1.5 text-sm transition-colors"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full transition-colors"
                      style={{ backgroundColor: viewMode === 'me' ? '#171717' : '#d4d4d4' }}
                    />
                    <span style={{ color: viewMode === 'me' ? '#171717' : '#a3a3a3' }}>
                      me
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

      {/* ── Back button — top-left, expanded only ── */}
      <motion.button
        className="fixed top-6 left-6 z-50 flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-neutral-200 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-neutral-50 transition-colors text-neutral-900"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif', pointerEvents: isExpanded ? 'auto' : 'none' }}
        onClick={() => {
          playClick()
          startTransition({ waitForManualEnd: true, message: 'returning home...' })
          setTimeout(() => {
            setScrapbookCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: defaultZoom })
            setClassroomCamera({ x: 0, y: 0, k: 1 })
            setViewMode('scrapbook')
            window.history.replaceState({}, '', '/')
            flushSync(() => setPhase('collapsing'))
            requestAnimationFrame(() => setPhase('splash'))
            setTimeout(() => {
              endTransition()
            }, 650)
          }, 250)
        }}
        animate={{ opacity: isExpanded ? 1 : 0, y: isExpanded ? 0 : -10 }}
        transition={{ duration: 0.3, delay: isExpanded ? 0.2 : 0 }}
      >
        ← back
      </motion.button>

      {/* ── Hint — bottom center in expanded view ── */}
      <motion.div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 text-xs uppercase tracking-widest pointer-events-none"
        style={{ color: 'rgba(0,0,0,0.25)' }}
        animate={{ opacity: (isExpanded && !isMe) ? 1 : 0 }}
        transition={{ duration: 0.3, delay: (isExpanded && !isMe) ? 0.5 : 0 }}
      >
        {viewMode === 'classroom'
          ? 'Scroll to browse · Click a polaroid to visit'
          : isMobile
          ? 'Drag to pan. Press to view.'
          : 'Scroll to zoom · Drag to pan · Click a polaroid to visit'}
      </motion.div>

      {/* ── Splash elements — staggered fade-in on mount, fade out when leaving splash ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
        animate={{ opacity: isSplash ? 1 : 0 }}
        transition={{ duration: SPLASH_FADE_DURATION / 1000 }}
      >
        {/* Hero text — desktop: single line, mobile: 3 lines stacked */}
        <motion.div
          className="absolute top-[2%] left-0 w-full"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Desktop single line — original layout */}
          <div className="relative w-full hidden md:block" style={{ paddingTop: '17%' }}>
            <StretchText
              lines={["systems design engineering"]}
              viewBox="0 0 1728 296"
              fontSize={280}
              className="absolute inset-0 w-full h-full"
            />
          </div>
          {/* Mobile — 3 stacked lines */}
          <div className="relative w-full block md:hidden" style={{ paddingTop: '52%' }}>
            <StretchText
              lines={["systems", "design", "engineering"]}
              viewBox="0 0 700 520"
              fontSize={260}
              lineHeight={180}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </motion.div>

        {/* 2030 — desktop only at this position */}
        <motion.div
          className="absolute left-0 top-[32%] w-[27%] hidden md:block"
          style={{ aspectRatio: '470 / 500' }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <StretchText
            lines={["2030"]}
            viewBox="0 0 470 328"
            fontSize={310}
            className="w-full h-full"
          />
        </motion.div>

        {/* webring text — desktop: bottom right */}
        <motion.div
          className="absolute right-0 bottom-[5%] w-[32%] hidden md:block"
          style={{ aspectRatio: '553 / 400' }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <StretchText
            lines={["webring"]}
            viewBox="0 0 553 384"
            fontSize={360}
            className="w-full h-full"
          />
        </motion.div>

        {/* Mobile bottom text — 2030 and webring stacked, smaller */}
        <motion.div
          className="absolute left-0 bottom-[1%] w-full block md:hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative w-full" style={{ paddingTop: '32%' }}>
            <StretchText
              lines={["2030", "webring"]}
              viewBox="0 0 700 420"
              fontSize={220}
              lineHeight={200}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </motion.div>

        {/* Goose 3D */}
        <motion.div
          className="absolute pointer-events-auto hidden md:block"
          style={{
            left: '5%', bottom: '0',
            width: '40vw', height: '45vh',
            minWidth: 320, minHeight: 360,
            zIndex: 10,
          }}
          initial={{ y: 40 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <GooseViewer key={`goose-${gooseKey}`} />
        </motion.div>

        <motion.div
          className="absolute bottom-[2%] right-[4%] hidden md:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <span
            className="text-black text-[max(10px,0.8vw)]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            Built by Justin Wu &amp; Leo Zhang
          </span>
        </motion.div>

        {/* Goose attribution — desktop */}
        <motion.div
          className="absolute bottom-[0.5%] left-1/2 -translate-x-1/2 pointer-events-auto hidden md:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span
            className="text-black/25 text-[max(8px,0.5vw)]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            &quot;Goose&quot; (
            <a href="https://skfb.ly/oJtwy" target="_blank" rel="noopener noreferrer" className="hover:text-black/90">https://skfb.ly/oJtwy</a>
            ) by OlegPopka is licensed under Creative Commons Attribution (
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="hover:text-black/90">http://creativecommons.org/licenses/by/4.0/</a>
            ).
          </span>
        </motion.div>

        {/* Goose attribution — mobile (compact) */}
        <motion.div
          className="absolute bottom-[0.5%] left-1/2 -translate-x-1/2 pointer-events-auto block md:hidden px-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span
            className="text-black/25 text-[8px] text-center block"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            &quot;Goose&quot; by OlegPopka · CC-BY 4.0
          </span>
        </motion.div>
      </motion.div>

      {/* Photo folder — bottom-left in splash, desktop only */}
      {isSplash && (
        <motion.div
          className="absolute bottom-[10%] origin-bottom-left hidden md:block"
          style={{ left: '5%', zIndex: 20 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <PhotoFolder onHover={playFolderHover} onPhotoChange={playPageTurn} onPhotoHover={playPageTurn} />
        </motion.div>
      )}

      {/* Sign up / Log in — splash only */}
      {isSplash && (
        <motion.div
          className="absolute flex items-center gap-3 md:top-[85%] top-[68%]"
          style={{ left: '50%', x: '-50%', zIndex: 15 }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-black text-sm font-medium lowercase tracking-wider">
                logged in as {user.name}
              </span>
              <button
                onClick={() => {
                  playClick()
                  startTransition({ waitForManualEnd: true, message: 'see u next time!' })
                  setTimeout(() => {
                    logout()
                    // Reset to splash view after logout
                    setPhase('splash')
                    setScrapbookCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: defaultZoom })
                    setClassroomCamera({ x: 0, y: 0, k: 1 })
                    setViewMode('scrapbook')
                    window.history.replaceState({}, '', '/')
                    // End the transition to dismiss the loading screen
                    endTransition()
                  }, 2000)
                }}
                className="px-4 py-2 text-black/70 text-xs font-medium lowercase tracking-wider border border-black/20 hover:bg-black/10 hover:text-black transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      // Flush loader state before navigation to prevent destination flash.
                      flushSync(() => startTransition({ waitForManualEnd: true }))
                      router.push('/join')
                    }}
                    className="px-5 py-2 text-black text-sm font-medium lowercase border border-black/30 hover:bg-black/10 transition-colors"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
                  >
                    sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClick()
                      // Flush loader state before navigation to prevent destination flash.
                      flushSync(() => startTransition({ waitForManualEnd: true }))
                      router.push('/login')
                    }}
                    className="px-5 py-2 text-black text-sm font-medium lowercase border border-black/30 hover:bg-black/10 transition-colors"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
                  >
                    log in
                  </button>
            </>
          )}
        </motion.div>
      )}

      {/* ── Asset Editor — always visible during splash ── */}
      {isSplash && <AssetEditor />}

      {/* White intro overlay — covers everything on mount, fades to reveal the page */}
      <motion.div
        className="fixed inset-0 bg-white pointer-events-none"
        style={{ zIndex: 100 }}
        initial={{ opacity: 1 }}
        animate={{ opacity: pageReady ? 0 : 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Soft white veil when navigating into a profile from a polaroid click */}
      <div
        className="pointer-events-none fixed inset-0 z-[90] bg-white"
        style={{
          opacity: navigatingToProfile ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      />

      {/* No-results message — fixed, unaffected by canvas pan/zoom */}
      {filteredMembers.length === 0 && searchTerm.trim() && !membersLoading && isExpanded && !isMe && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <p
            className="text-black/40 text-xs md:text-sm lowercase tracking-[0.16em] text-center max-w-[min(90vw,28rem)]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            the user you are searching for does not exist yet, get them to sign up!
          </p>
        </div>
      )}

      {/* Signed-in \"me\" panel — expanded view only */}
      {isExpanded && viewMode === 'me' && (
        <motion.div
          className="fixed inset-0 z-40 pointer-events-auto bg-white/90"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          // Let form controls receive focus/clicks; prevent underlying canvas interactions via viewMode guards.
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <MePanel onPolaroidHover={playPageTurn} />
        </motion.div>
      )}
    </div>
  )
}
