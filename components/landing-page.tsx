'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import Lenis from 'lenis'
import { useAuth } from '@/lib/auth-context'
import { PhotoFolder } from './photo-folder'

const GooseViewer = dynamic(() => import('./goose-viewer'), { ssr: false })
const WebringPortal = dynamic(
  () => import('./webring-portal').then(m => m.WebringPortal),
  { ssr: false }
)
const DotGrid = dynamic(() => import('./dot-grid'), { ssr: false })

interface LandingPageProps {
  onEnterWebring?: () => void
}

export function LandingPage({ onEnterWebring }: LandingPageProps) {
  const targetRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()

  // Initialize Lenis for smooth scrolling physics
  useEffect(() => {
    const lenis = new Lenis({
      duration: 0.8,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      wheelMultiplier: 0.8,
      touchMultiplier: 1.5,
      infinite: false,
    })

    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)

    return () => lenis.destroy()
  }, [])

  // Track scroll progress of the target element through viewport
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"]
  })

  // Transform scroll progress to animation values - opacity only, no Y movement
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const elementsOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0])
  const gooseOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0])

  return (
    <div ref={targetRef} className="relative bg-black" style={{ height: '300vh' }}>
      {/* Sticky viewport - stays in view while scrolling */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        
        {/* Purple dot grid background */}
        <div className="absolute inset-0 z-0">
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
        </div>

        {/* Hero text container - fade only */}
        <motion.div 
          className="absolute top-[2%] left-0 w-full pointer-events-none"
          style={{ opacity: heroOpacity }}
        >
          <div className="relative w-full" style={{ paddingTop: '17.2%' }}>
            <img
              src="/systems-design-engineering.svg"
              alt="systems design engineering"
              className="absolute inset-0 w-full h-full object-contain object-left"
            />
          </div>
        </motion.div>

        {/* 2030 - fade only */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: '0',
            top: '32%',
            width: '27%',
            aspectRatio: '470 / 328',
            opacity: elementsOpacity,
          }}
        >
          <img
            src="/2030.svg"
            alt="2030"
            className="w-full h-full object-contain"
          />
        </motion.div>

        {/* Photo folder - bottom-left, vertically centered with goose */}
        <motion.div
          className="absolute pointer-events-auto"
          style={{
            left: '3%',
            bottom: '15%',
            zIndex: 20,
            opacity: elementsOpacity,
          }}
        >
          <PhotoFolder />
        </motion.div>

        {/* Webring portal - scroll-driven expansion */}
        <WebringPortal scrollYProgress={scrollYProgress} />

        {/* webring text - bottom right, fade only */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            right: '0',
            bottom: '5%',
            width: '32%',
            aspectRatio: '553 / 384',
            opacity: elementsOpacity,
          }}
        >
          <img
            src="/webring.svg"
            alt="webring"
            className="w-full h-full object-contain"
          />
        </motion.div>

        {/* Goose 3D - stays longer, fades later */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            left: '0',
            bottom: '0',
            width: '40%',
            height: '45%',
            zIndex: 10,
            opacity: gooseOpacity,
          }}
        >
          <GooseViewer />
        </motion.div>

        {/* Crest and RELEASING MARCH sticker - fade only */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            right: '8%',
            top: '32%',
            width: '20%',
            zIndex: 10,
            opacity: elementsOpacity,
          }}
        >
          <img
            src="/crest.png"
            alt="Crest"
            className="w-[80%] h-auto object-contain"
          />
          <div
            className="absolute"
            style={{
              right: '-5%',
              bottom: '5%',
              width: '60%',
            }}
          >
            <img
              src="/releasing-march.png"
              alt="Releasing March"
              className="w-full h-auto object-contain"
            />
          </div>
        </motion.div>

        {/* Footer credits - fade with scroll */}
        <motion.div 
          className="absolute bottom-[2%] left-[4%] pointer-events-none"
          style={{ opacity: elementsOpacity }}
        >
          <span 
            className="text-white text-[1vw]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            With help from V0, Cursor, Claude Code
          </span>
        </motion.div>

        <motion.div 
          className="absolute bottom-[2%] right-[4%] pointer-events-none"
          style={{ opacity: elementsOpacity }}
        >
          <span 
            className="text-white text-[1vw]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
          >
            Built by Justin Wu &amp; Leo Zhang
          </span>
        </motion.div>

        {/* Goose 3D model attribution */}
        <motion.div 
          className="absolute bottom-[0.5%] left-1/2 -translate-x-1/2 pointer-events-auto"
          style={{ opacity: elementsOpacity }}
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

        {/* Sign up / Log in - fade with scroll */}
        <motion.div
          className="absolute flex items-center gap-3"
          style={{
            left: '50%',
            top: '90%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            opacity: elementsOpacity,
          }}
        >
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium uppercase tracking-wider">
                Logged in as {user.name}
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 text-white/70 text-xs font-medium uppercase tracking-wider border border-white/20 hover:bg-white/10 hover:text-white transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
                <Link
                  href="/join"
                  className="px-5 py-2 text-white text-sm font-medium lowercase border border-white/30 hover:bg-white/10 transition-colors"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
                >
                  sign up
                </Link>
                <Link
                  href="/login"
                  className="px-5 py-2 text-white text-sm font-medium lowercase border border-white/30 hover:bg-white/10 transition-colors"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
                >
                  log in
                </Link>
            </>
          )}
        </motion.div>

      </div>
    </div>
  )
}
