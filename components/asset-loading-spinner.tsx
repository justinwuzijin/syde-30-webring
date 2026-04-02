'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ASSETS = [
  { src: '/matlab.webp', alt: 'MATLAB' },
  { src: '/sw-cube.webp', alt: 'SolidWorks' },
  { src: '/cpp.webp', alt: 'C++' },
  { src: '/sandwich.webp', alt: 'Sandwich' },
  { src: '/crest.webp', alt: 'Crest' },
  { src: '/book-river.webp', alt: 'Book' },
  { src: '/releasing-march.png', alt: 'Releasing March' },
]

// Preload all spinner images immediately on module load
if (typeof window !== 'undefined') {
  ASSETS.forEach(({ src }) => {
    const img = new Image()
    img.src = src
  })
}

const RADIUS = 52
const ITEM_SIZE = 32
const STAGGER_DELAY = 0.1
const SPIN_DURATION = 3

interface AssetLoadingSpinnerProps {
  message?: string
}

export function AssetLoadingSpinner({ message = 'loading site...' }: AssetLoadingSpinnerProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    if (visibleCount >= ASSETS.length) return
    const timer = setTimeout(() => {
      setVisibleCount(prev => prev + 1)
    }, STAGGER_DELAY * 1000)
    return () => clearTimeout(timer)
  }, [visibleCount])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ backgroundColor: '#ffffff' }}
    >
      <motion.div
        className="relative"
        style={{ width: RADIUS * 2 + ITEM_SIZE, height: RADIUS * 2 + ITEM_SIZE }}
        animate={{ rotate: 360 }}
        transition={{
          duration: SPIN_DURATION,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        {ASSETS.map((asset, i) => {
          const angle = (i / ASSETS.length) * 2 * Math.PI - Math.PI / 2
          const x = RADIUS * Math.cos(angle) + RADIUS
          const y = RADIUS * Math.sin(angle) + RADIUS

          return (
            <AnimatePresence key={asset.src}>
              {i < visibleCount && (
                <motion.div
                  className="absolute"
                  style={{
                    left: x,
                    top: y,
                    width: ITEM_SIZE,
                    height: ITEM_SIZE,
                  }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {/* Counter-rotate so images stay upright */}
                  <motion.img
                    src={asset.src}
                    alt={asset.alt}
                    className="w-full h-full object-contain drop-shadow-md"
                    animate={{ rotate: -360 }}
                    transition={{
                      duration: SPIN_DURATION,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                    draggable={false}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )
        })}
      </motion.div>
      <p
        className="mt-8 text-sm text-neutral-400 lowercase tracking-[0.15em]"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
      >
        {message}
      </p>
    </div>
  )
}
