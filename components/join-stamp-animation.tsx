'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Member } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

interface JoinStampAnimationProps {
  user: { id: string; name: string; email: string }
  members: Member[]
  onComplete: () => void
}

export function JoinStampAnimation({ user, members, onComplete }: JoinStampAnimationProps) {
  const [phase, setPhase] = useState<'drop' | 'impact' | 'done'>('drop')
  const completedRef = useRef(false)
  const currentMember = members.find((m) => toSlug(m.name) === toSlug(user.name))

  useEffect(() => {
    if (!currentMember) {
      onComplete()
      return
    }
    const t1 = setTimeout(() => setPhase('impact'), 180)
    const t2 = setTimeout(() => setPhase('done'), 450)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [currentMember, onComplete])

  const handleAnimationComplete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [onComplete])

  if (!currentMember) return null

  const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400
  const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400
  const polaroidX = centerX
  const polaroidY = centerY - 60

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center"
        style={{ background: '#ffffff' }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          style={{
            position: 'absolute',
            left: polaroidX,
            top: polaroidY,
          }}
          initial={{
            y: -200,
            scale: 1.2,
            opacity: 0.9,
          }}
          animate={
            phase === 'drop'
              ? { y: 0, scale: 1.2, opacity: 1 }
              : phase === 'impact'
                ? {
                    y: 4,
                    scale: 0.97,
                    transition: { duration: 0.08, ease: 'easeOut' },
                  }
                : {
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                  }
          }
          onAnimationComplete={() => {
            if (phase === 'done') {
              setTimeout(handleAnimationComplete, 400)
            }
          }}
          transition={
            phase === 'drop'
              ? { duration: 0.25, ease: [0.33, 1, 0.5, 1] }
              : undefined
          }
        >
          <div
            style={{
              filter: phase === 'impact' ? 'brightness(0.95)' : 'none',
              boxShadow:
                phase === 'impact'
                  ? '0 8px 24px rgba(0,0,0,0.2)'
                  : '0 20px 40px rgba(0,0,0,0.15)',
              transition: 'filter 0.08s, box-shadow 0.08s',
            }}
          >
            <PolaroidCard
              member={currentMember}
              x={0}
              y={0}
              noTilt
              onHover={() => {}}
            />
          </div>
        </motion.div>

        <motion.p
          className="absolute text-center text-black/40 text-sm lowercase tracking-[0.2em]"
          style={{
            bottom: '15%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.3 }}
        >
          you&apos;re in the webring
        </motion.p>
      </motion.div>
    </AnimatePresence>
  )
}
