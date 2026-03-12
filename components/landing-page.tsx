'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/auth-context'
import { JoinStampAnimation } from './join-stamp-animation'
import type { Member } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'
import {
  getSortedMembers,
  isCreator,
  computeScrapbookPositions,
  computeClassroomPositions,
  CARD_GAP,
  GRID_PADDING,
} from '@/lib/placement'
import { PhotoFolder } from './photo-folder'
import { Input } from './ui/input'
import { AssetEditor } from './asset-editor'
import { useSound } from '@/lib/use-sound'
import { usePageTransition } from './page-transition'

const GooseViewer = dynamic(() => import('./goose-viewer'), { ssr: false })
const DotGrid = dynamic(() => import('./dot-grid'), { ssr: false })

type Phase = 'splash' | 'transitioning' | 'expanded'
type ViewMode = 'scrapbook' | 'classroom'

// Transition timing
const EXPAND_DURATION = 900
const SPLASH_FADE_DURATION = 400
const EXPANDED_DELAY = EXPAND_DURATION + 50

// Pan/zoom limits
const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.5
const ZOOM_SENSITIVITY = 0.002

/** Splash preview offset — polaroids shifted up/left for visual centering. Must match camera on expand. */
const PREVIEW_OFFSET_X = 72
const PREVIEW_OFFSET_Y = 88

/** Landing preview: only Leo and Justin */
function getLandingPreviewMembers(members: Member[]): Member[] {
  return members.filter(isCreator)
}

/** Compute positions for scrapbook (center-out, tilt) or classroom (rigid grid) */
function computePositions(
  members: Member[],
  mode: ViewMode
): {
  positions: Map<string, { x: number; y: number; rotation?: number }>
  canvasW: number
  canvasH: number
} {
  if (mode === 'classroom') {
    const { positions, canvasW, canvasH } = computeClassroomPositions(members)
    return { positions, canvasW, canvasH }
  }
  const { positions, canvasW, canvasH } = computeScrapbookPositions(members)
  return { positions, canvasW, canvasH }
}

const GLASS_CHROME =
  'relative overflow-hidden rounded-full ' +
  // Base glass fill: slightly darker, still translucent
  'bg-white/35 bg-gradient-to-b from-white/60 via-white/35 to-white/25 ' +
  // Strong, crisp glass edge
  'border border-white/60 ' +
  // Deep blur + saturation for Apple-style glass
  'backdrop-blur-3xl backdrop-saturate-150 ' +
  // Floating depth + top inset highlight
  'shadow-[0_10px_30px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] ' +
  // On browsers that support backdrop-filter, keep the tint subtle
  'supports-[backdrop-filter]:bg-white/30 ' +
  'transition-colors transition-shadow duration-200';

export function LandingPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, logout, setUserFromToken } = useAuth()
  const { startTransition } = usePageTransition()

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
  const [showStampAnimation, setShowStampAnimation] = useState(false)

  // Fetch members from Supabase with SWR (cached, deduped)
  const { data: membersData, isLoading: membersLoading } = useSWR<{ members: Member[] }>(
    '/api/members',
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
    () => computePositions(displayMembers, placementMode),
    [displayMembers, placementMode]
  )

  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return displayMembers
    return displayMembers.filter((m) => {
      const firstName = m.name.split(' ')[0] ?? ''
      return firstName.toLowerCase().startsWith(query)
    })
  }, [searchTerm, displayMembers])

  // Pan/zoom state — initial offset matches splash so no jump when expanding
  const [camera, setCamera] = useState(() =>
    startExpanded ? { x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: 1 } : { x: 0, y: 0, k: 1 }
  )
  const [isDragging, setIsDragging] = useState(false)
  const lastPos = useRef({ x: 0, y: 0 })

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
          setCamera({ x: 0, y: 0, k: 1 })
        }
      }
      prevPathname.current = '/'
    } else {
      prevPathname.current = pathname
    }
  }, [pathname, searchParams])

  // Show stamp animation when landing directly on ?view=webring (e.g. from approval email)
  useEffect(() => {
    if (
      phase === 'expanded' &&
      user &&
      !user.has_seen_join_stamp_animation &&
      members.length > 0 &&
      !showStampAnimation
    ) {
      const viewParam = searchParams.get('view')
      if (viewParam === 'webring') {
        setShowStampAnimation(true)
      }
    }
  }, [phase, user, members.length, searchParams, showStampAnimation])

  // Fade out the white intro overlay after a short delay
  useEffect(() => {
    const id = setTimeout(() => setPageReady(true), 600)
    return () => clearTimeout(id)
  }, [])

  // Click the circle → expand (camera offset matches splash so no jump)
  const handleEnterWebring = useCallback(() => {
    if (phase !== 'splash') return
    playClick()
    setPhase('transitioning')
    setTimeout(() => {
      setCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: 1 })
      setPhase('expanded')
      if (user && !user.has_seen_join_stamp_animation && members.length > 0) {
        setShowStampAnimation(true)
      }
    }, EXPANDED_DELAY)
  }, [phase, playClick, user, members.length])

  // Back to splash — reset camera to match preview offset so Leo & Justin stay centered
  const handleBack = useCallback(() => {
    playClick()
    setPhase('splash')
    setCamera({ x: -PREVIEW_OFFSET_X, y: -PREVIEW_OFFSET_Y, k: 1 })
    setViewMode('scrapbook')
    window.history.replaceState({}, '', '/')
  }, [playClick])

  // ── Wheel → zoom centered (expanded only) ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (phase !== 'expanded') return
    e.stopPropagation()
    setCamera(prev => {
      const delta = -e.deltaY * ZOOM_SENSITIVITY
      const newK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.k * (1 + delta)))
      const ratio = newK / prev.k
      // Scale pan offset proportionally so the visual center stays fixed
      return {
        x: prev.x * ratio,
        y: prev.y * ratio,
        k: newK,
      }
    })
  }, [phase])

  // ── Drag → pan (expanded only) ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (phase !== 'expanded') return
    if ((e.target as HTMLElement).closest('.polaroid-frame, button, a')) return
    setIsDragging(true)
    lastPos.current = { x: e.clientX, y: e.clientY }
    e.preventDefault()
  }, [phase])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    setCamera(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  // Click polaroid → profile (expanded only)
  const handleStampComplete = useCallback(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('syde30_auth_token') : null
    if (token) {
      fetch('/api/me/mark-stamp-seen', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(() => {
        setUserFromToken(token)
      })
    }
    setShowStampAnimation(false)
  }, [setUserFromToken])

  const handleCardClick = useCallback((memberId: string) => {
    if (phase !== 'expanded') return
    playClick()
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
  const gridTransform = isExpanded
    ? isClassroom
      ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})`
      : `translate(calc(-50% + ${camera.x}px), calc(-50% + ${camera.y}px)) scale(${camera.k})`
    : `translate(calc(-50% - ${PREVIEW_OFFSET_X}px), calc(-50% - ${PREVIEW_OFFSET_Y}px))`

  return (
    <div className="relative bg-black h-screen w-full overflow-hidden">
      {/* Purple dot grid background — fades when leaving splash */}
      <motion.div
        className="absolute inset-0 z-0"
        animate={{ opacity: isSplash ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        <DotGrid
          dotSize={5}
          gap={15}
          baseColor="#271E37"
          activeColor="#5227FF"
          proximity={120}
          shockRadius={250}
          shockStrength={5}
          resistance={750}
          returnDuration={1.5}
        />
      </motion.div>

      {/* ── The circle — zooms in on click, becomes the canvas ── */}
      <motion.div
        ref={circleRef}
        className="absolute overflow-hidden"
        style={{
          left: '50%',
          top: isSplash ? '50%' : '50%',
          x: '-50%',
          y: '-50%',
          background: '#ffffff',
          boxShadow: isSplash ? '0 8px 40px rgba(0,0,0,0.15)' : 'none',
          cursor: isSplash
            ? 'pointer'
            : isDragging ? 'grabbing' : isExpanded ? 'grab' : 'default',
          zIndex: 20,
          touchAction: 'none',
        }}
        animate={isSplash ? {
          width: '30vw',
          height: '30vw',
          borderRadius: '50%',
        } : {
          width: '100vw',
          height: '100vh',
          borderRadius: '0%',
        }}
        transition={{
          duration: isSplash ? 0.6 : EXPAND_DURATION / 1000,
          ease: [0.22, 1, 0.36, 1],
        }}
        onClick={isSplash ? handleEnterWebring : undefined}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Polaroid grid — same DOM throughout, opacity + transform change */}
        <div
          style={{
            position: 'absolute',
            left: isClassroom ? '5%' : '50%',
            top: isClassroom ? '6.5rem' : '50%',
            width: canvasW,
            height: canvasH,
            transform: gridTransform,
            transformOrigin: isClassroom ? '0 0' : '50% 50%',
            opacity: isSplash ? 0.7 : 1,
            transition: isSplash
              ? 'opacity 0.3s ease, transform 0.6s cubic-bezier(0.22,1,0.36,1)'
              : 'opacity 0.5s ease, left 0.4s ease, top 0.4s ease',
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          {membersLoading && displayMembers.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p
                className="text-black/40 text-xs lowercase tracking-[0.2em]"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
              >
                loading polaroids…
              </p>
            </div>
          )}
          {filteredMembers.length === 0 && searchTerm.trim() && !membersLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className={'px-6 py-3 ' + GLASS_CHROME}>
                <div className="absolute inset-0 pointer-events-none rounded-full bg-gradient-to-b from-white/45 to-transparent opacity-70" />
                <p className="relative text-xs md:text-sm text-neutral-900 lowercase tracking-[0.16em] text-center">
                  the user you are searching for does not exist yet, get them to sign up!
                </p>
              </div>
            </div>
          )}

          {filteredMembers.map((m) => {
            const pos = positions.get(m.id)
            if (!pos) return null
            const hasRotation = 'rotation' in pos && typeof pos.rotation === 'number'
            return (
              <PolaroidCard
                key={m.id}
                member={m}
                x={pos.x}
                y={pos.y}
                onClick={isExpanded ? () => handleCardClick(m.id) : undefined}
                noTilt={placementMode === 'classroom'}
                rotation={hasRotation ? pos.rotation : undefined}
                onHover={playPageTurn}
              />
            )
          })}
        </div>

        {/* Pulse ring — splash only */}
        {isSplash && (
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid rgba(82, 39, 255, 0.3)',
              animation: 'pulse-ring 2s ease-out infinite',
            }}
          />
        )}

        {/* "click to explore" — bottom of circle, fades out */}
        <motion.div
          className="absolute inset-x-0 bottom-0 flex justify-center pb-[12%]"
          style={{ pointerEvents: 'none', zIndex: 10 }}
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

      {/* ── Search bar — top center, expanded only ── */}
      {isExpanded && (
        <motion.div
          className="fixed top-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <div className={'flex items-center ' + GLASS_CHROME + ' hover:bg-white/20'}>
            <div className="absolute inset-0 pointer-events-none rounded-full bg-gradient-to-b from-white/45 to-transparent opacity-70" />
            <Input
              type="text"
              placeholder="Search polaroids by first name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="relative bg-transparent border-0 focus-visible:ring-0 focus-visible:border-0 text-sm text-neutral-900 placeholder:text-neutral-500 px-5 py-2.5 rounded-full"
            />
          </div>
        </motion.div>
      )}


      {/* ── View toggle — below search bar, expanded only ── */}
      {isExpanded && (
        <motion.div
          className="fixed top-[4.5rem] left-1/2 z-50 -translate-x-1/2 flex items-center gap-4 pb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              borderBottom: viewMode === 'scrapbook' ? '1px solid rgba(0,0,0,0.15)' : '1px solid transparent',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              onClick={() => { playClick(); setViewMode('scrapbook') }}
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
              borderBottom: viewMode === 'classroom' ? '1px solid rgba(0,0,0,0.15)' : '1px solid transparent',
              paddingBottom: '0.5rem',
            }}
          >
            <button
              onClick={() => { playClick(); setViewMode('classroom') }}
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
        </motion.div>
      )}
      {/* ── Back button — top-left, expanded only ── */}
      {isExpanded && (
        <motion.button
          className={
            'fixed top-6 left-6 z-50 px-4 py-2 text-sm text-neutral-900 hover:text-neutral-950 ' +
            GLASS_CHROME +
            ' hover:bg-white/20'
          }
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          onClick={handleBack}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <span className="absolute inset-0 pointer-events-none rounded-full bg-gradient-to-b from-white/45 to-transparent opacity-70" />
          &larr; back
        </motion.button>
      )}

      {/* ── Photo folder — fixed bottom-left in expanded view ── */}
      {isExpanded && (
        <motion.div
          className="fixed z-50"
          style={{ left: '5%', bottom: '10%' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <PhotoFolder onHover={playFolderHover} onPhotoChange={playPageTurn} onPhotoHover={playPageTurn} />
        </motion.div>
      )}

      {/* ── Hint — bottom center in expanded view ── */}
      {isExpanded && (
        <motion.div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 text-xs uppercase tracking-widest pointer-events-none"
          style={{ color: 'rgba(0,0,0,0.25)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          Scroll to zoom · Drag to pan · Click a polaroid to visit
        </motion.div>
      )}

      {/* ── Splash elements — staggered fade-in on mount, fade out when leaving splash ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
        animate={{ opacity: isSplash ? 1 : 0 }}
        transition={{ duration: SPLASH_FADE_DURATION / 1000 }}
      >
        {/* Hero text */}
        <motion.div
          className="absolute top-[2%] left-0 w-full"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative w-full" style={{ paddingTop: '17.2%' }}>
            <img
              src="/systems-design-engineering.svg"
              alt="systems design engineering"
              className="absolute inset-0 w-full h-full object-contain object-left"
            />
          </div>
        </motion.div>

        {/* 2030 */}
        <motion.div
          className="absolute"
          style={{ left: '0', top: '32%', width: '27%', aspectRatio: '470 / 328' }}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src="/2030.svg" alt="2030" className="w-full h-full object-contain" />
        </motion.div>

        {/* webring text - bottom right */}
        <motion.div
          className="absolute"
          style={{ right: '0', bottom: '5%', width: '32%', aspectRatio: '553 / 384' }}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <img src="/webring.svg" alt="webring" className="w-full h-full object-contain" />
        </motion.div>

        {/* Goose 3D */}
        <motion.div
          className="absolute pointer-events-auto"
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

        {/* Footer credits */}
        <motion.div
          className="absolute bottom-[2%] left-[4%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <span
            className="text-white text-[0.8vw]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            With help from V0, Cursor, Claude Code
          </span>
        </motion.div>
        <motion.div
          className="absolute bottom-[2%] right-[4%]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <span
            className="text-white text-[0.8vw]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            Built by Justin Wu &amp; Leo Zhang
          </span>
        </motion.div>

        {/* Goose attribution */}
        <motion.div
          className="absolute bottom-[0.5%] left-1/2 -translate-x-1/2 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <span
            className="text-white/80 text-[0.5vw]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            &quot;Goose&quot; (
            <a href="https://skfb.ly/oJtwy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/90">https://skfb.ly/oJtwy</a>
            ) by OlegPopka is licensed under Creative Commons Attribution (
            <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/90">http://creativecommons.org/licenses/by/4.0/</a>
            ).
          </span>
        </motion.div>
      </motion.div>

      {/* Photo folder — bottom-left in splash, vertically centered with goose */}
      {isSplash && (
        <motion.div
          className="absolute"
          style={{ left: '5%', bottom: '10%', zIndex: 20 }}
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
          className="absolute flex items-center gap-3"
          style={{ left: '50%', top: '85%', x: '-50%', zIndex: 15 }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium uppercase tracking-wider">
                Logged in as {user.name}
              </span>
              <button
                onClick={() => { playClick(); logout() }}
                className="px-4 py-2 text-white/70 text-xs font-medium uppercase tracking-wider border border-white/20 hover:bg-white/10 hover:text-white transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/join"
                onClick={() => { playClick(); startTransition() }}
                className="px-5 py-2 text-white text-sm font-medium lowercase border border-white/30 hover:bg-white/10 transition-colors"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
              >
                sign up
              </Link>
              <Link
                href="/login"
                onClick={() => { playClick(); startTransition() }}
                className="px-5 py-2 text-white text-sm font-medium lowercase border border-white/30 hover:bg-white/10 transition-colors"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
              >
                log in
              </Link>
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

      {/* First-login stamp animation — one-time after approval */}
      {showStampAnimation && user && (
        <JoinStampAnimation
          user={user}
          members={members}
          onComplete={handleStampComplete}
        />
      )}
    </div>
  )
}
