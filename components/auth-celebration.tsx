'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const ASSETS = [
  { src: '/matlab.webp', alt: 'MATLAB' },
  { src: '/sw-cube.webp', alt: 'SolidWorks' },
  { src: '/cpp.webp', alt: 'C++' },
  { src: '/sandwich.webp', alt: 'Sandwich' },
  { src: '/crest.webp', alt: 'Crest' },
  { src: '/book-river.webp', alt: 'Book' },
  { src: '/releasing-march.png', alt: 'Releasing March' },
]

const sfPro = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }

interface AuthCelebrationProps {
  type: 'signup' | 'signin'
  onComplete: () => void
}

export function AuthCelebration({ type, onComplete }: AuthCelebrationProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  const isSignin = type === 'signin'

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 800)
    const exitTimer = setTimeout(() => setPhase('exit'), 3800)
    const doneTimer = setTimeout(onComplete, 4400)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete, isSignin])

  if (type === 'signup') {
    return <SignupCelebration phase={phase} />
  }
  return <SigninCelebration phase={phase} />
}

/** Sign-up: same spinner as page loading, just different text */
function SignupCelebration({ phase }: { phase: string }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const RADIUS = 52
  const ITEM_SIZE = 32
  const SPIN_DURATION = 3
  const STAGGER = 0.1

  useEffect(() => {
    if (visibleCount >= ASSETS.length) return
    const timer = setTimeout(() => setVisibleCount(prev => prev + 1), STAGGER * 1000)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#ffffff' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: phase === 'exit' ? 0.5 : 0.3 }}
    >
      <motion.div
        className="relative"
        style={{ width: RADIUS * 2 + ITEM_SIZE, height: RADIUS * 2 + ITEM_SIZE }}
        animate={{ rotate: 360 }}
        transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: 'linear' }}
      >
        {ASSETS.map((asset, i) => {
          const angle = (i / ASSETS.length) * 2 * Math.PI - Math.PI / 2
          const x = RADIUS * Math.cos(angle) + RADIUS
          const y = RADIUS * Math.sin(angle) + RADIUS

          return (
            i < visibleCount && (
              <motion.div
                key={asset.src}
                className="absolute"
                style={{ left: x, top: y, width: ITEM_SIZE, height: ITEM_SIZE }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.img
                  src={asset.src}
                  alt={asset.alt}
                  className="w-full h-full object-contain drop-shadow-md"
                  animate={{ rotate: -360 }}
                  transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: 'linear' }}
                  draggable={false}
                />
              </motion.div>
            )
          )
        })}
      </motion.div>

      <motion.p
        className="mt-8 text-sm text-neutral-400 lowercase tracking-[0.15em]"
        style={{ ...sfPro }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        check your inbox for email confirmation...
      </motion.p>
    </motion.div>
  )
}

/** Sign-in: same spinner as page loading, just different text */
function SigninCelebration({ phase }: { phase: string }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const RADIUS = 52
  const ITEM_SIZE = 32
  const SPIN_DURATION = 3
  const STAGGER = 0.1

  useEffect(() => {
    if (visibleCount >= ASSETS.length) return
    const timer = setTimeout(() => setVisibleCount(prev => prev + 1), STAGGER * 1000)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#ffffff' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="relative"
        style={{ width: RADIUS * 2 + ITEM_SIZE, height: RADIUS * 2 + ITEM_SIZE }}
        animate={{ rotate: 360 }}
        transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: 'linear' }}
      >
        {ASSETS.map((asset, i) => {
          const angle = (i / ASSETS.length) * 2 * Math.PI - Math.PI / 2
          const x = RADIUS * Math.cos(angle) + RADIUS
          const y = RADIUS * Math.sin(angle) + RADIUS

          return (
            i < visibleCount && (
              <motion.div
                key={asset.src}
                className="absolute"
                style={{ left: x, top: y, width: ITEM_SIZE, height: ITEM_SIZE }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <motion.img
                  src={asset.src}
                  alt={asset.alt}
                  className="w-full h-full object-contain drop-shadow-md"
                  animate={{ rotate: -360 }}
                  transition={{ duration: SPIN_DURATION, repeat: Infinity, ease: 'linear' }}
                  draggable={false}
                />
              </motion.div>
            )
          )
        })}
      </motion.div>

      <motion.p
        className="mt-8 text-sm text-neutral-400 lowercase tracking-[0.15em]"
        style={{ ...sfPro }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        welcome back...
      </motion.p>
    </motion.div>
  )
}
