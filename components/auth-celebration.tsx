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

/** Sign-up: spinning circle of assets with confirmation message */
function SignupCelebration({ phase }: { phase: string }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const RADIUS = 80
  const ITEM_SIZE = 42
  const SPIN_DURATION = 4
  const STAGGER = 0.14
  const PULSE_DURATION = 1.6

  useEffect(() => {
    if (visibleCount >= ASSETS.length) return
    const timer = setTimeout(() => setVisibleCount(prev => prev + 1), STAGGER * 1000)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: phase === 'exit' ? 0 : 1 }}
      transition={{ duration: phase === 'exit' ? 0.5 : 0.3 }}
    >
      {/* Spinning ring of assets — clockwise only */}
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
                animate={{ opacity: 1, scale: [1, 1.35, 1] }}
                transition={{
                  opacity: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  scale: {
                    duration: PULSE_DURATION,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * (PULSE_DURATION / ASSETS.length),
                  },
                }}
              >
                <img
                  src={asset.src}
                  alt={asset.alt}
                  className="w-full h-full object-contain drop-shadow-lg"
                  draggable={false}
                />
              </motion.div>
            )
          )
        })}
      </motion.div>

      {/* Text below spinner */}
      <motion.p
        className="text-white/80 mt-8"
        style={{ ...sfPro, fontSize: '1rem', letterSpacing: '0.03em' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        Check your inbox for email confirmation!
      </motion.p>
    </motion.div>
  )
}

/** Sign-in: assets appear one by one in a circle, spin clockwise, pulse in size */
function SigninCelebration({ phase }: { phase: string }) {
  const [visibleCount, setVisibleCount] = useState(0)
  const RADIUS = 80
  const ITEM_SIZE = 42
  const SPIN_DURATION = 4
  const STAGGER = 0.14
  const PULSE_DURATION = 1.6

  useEffect(() => {
    if (visibleCount >= ASSETS.length) return
    const timer = setTimeout(() => setVisibleCount(prev => prev + 1), STAGGER * 1000)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Spinning ring of assets — clockwise only */}
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
                animate={{ opacity: 1, scale: [1, 1.35, 1] }}
                transition={{
                  opacity: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                  scale: {
                    duration: PULSE_DURATION,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * (PULSE_DURATION / ASSETS.length),
                  },
                }}
              >
                <img
                  src={asset.src}
                  alt={asset.alt}
                  className="w-full h-full object-contain drop-shadow-lg"
                  draggable={false}
                />
              </motion.div>
            )
          )
        })}
      </motion.div>

      {/* Text below spinner */}
      <motion.p
        className="text-white/80 mt-8"
        style={{ ...sfPro, fontSize: '1rem', letterSpacing: '0.03em' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        Welcome Back!
      </motion.p>
    </motion.div>
  )
}
