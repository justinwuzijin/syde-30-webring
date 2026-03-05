'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const GooseViewer = dynamic(() => import('./goose-viewer'), { ssr: false })

interface LandingPageProps {
  onEnterWebring?: () => void
}

export function LandingPage({ onEnterWebring }: LandingPageProps) {
  const [showWebring, setShowWebring] = useState(false)

  const handleCircleClick = () => {
    setShowWebring(true)
    onEnterWebring?.()
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black">
      {/* Hero text container */}
      <div className="absolute top-[2%] left-0 w-full">
        {/* systems design engineering - using Figma SVG */}
        <div className="relative w-full" style={{ paddingTop: '17.2%' }}>
          <img
            src="/systems-design-engineering.svg"
            alt="systems design engineering"
            className="absolute inset-0 w-full h-full object-contain object-left"
          />
        </div>
      </div>

      {/* 2030 - left side, lowered to not overlap with systems */}
      <div
        className="absolute"
        style={{
          left: '0',
          top: '32%',
          width: '27%',
          aspectRatio: '470 / 328',
        }}
      >
        <img
          src="/2030.svg"
          alt="2030"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Circle view - center, overlapping with 2030 (clickable to enter webring) */}
      <motion.div
        className="absolute cursor-pointer"
        style={{
          left: '30%',
          top: '16%',
          width: '40%',
          aspectRatio: '1 / 1',
          zIndex: 5,
        }}
        onClick={handleCircleClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div
          className="w-full h-full rounded-full overflow-hidden"
          style={{
            background: '#b0b0b0',
            border: '2px solid #888',
          }}
        >
          {/* Preview of webring will go here */}
        </div>
      </motion.div>

      {/* webring - bottom right, positioned to not overlap with crest */}
      <div
        className="absolute"
        style={{
          right: '0',
          bottom: '5%',
          width: '32%',
          aspectRatio: '553 / 384',
        }}
      >
        <img
          src="/webring.svg"
          alt="webring"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Goose 3D - fills bottom-left black space below 2030 text */}
      <div
        className="absolute"
        style={{
          left: '-3%',
          top: '62%',
          bottom: '-5%',
          width: '46%',
          zIndex: 20,
        }}
      >
        <GooseViewer />
      </div>

      {/* Crest and RELEASING MARCH sticker - overlapping, positioned between circle and webring */}
      <div
        className="absolute"
        style={{
          right: '8%',
          top: '32%',
          width: '20%',
          zIndex: 10,
        }}
      >
        {/* Crest - bigger */}
        <img
          src="/crest.png"
          alt="Crest"
          className="w-[80%] h-auto object-contain"
        />
        {/* RELEASING MARCH sticker - smaller, overlapping crest on bottom-right */}
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
      </div>

      {/* Footer credits - SF Pro font, white */}
      <div className="absolute bottom-[2%] left-[4%]">
        <span 
          className="text-white text-[1vw]"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
        >
          With help from V0, Cursor, Claude Code
        </span>
      </div>

      <div className="absolute bottom-[2%] right-[4%]">
        <span 
          className="text-white text-[1vw]"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
        >
          Built by Justin Wu &amp; Leo Zhang
        </span>
      </div>

      {/* JOIN button - centered below the circle in the black space */}
      <Link
        href="/join"
        className="absolute px-6 py-2 text-white text-sm font-medium uppercase tracking-wider border border-white/30 hover:bg-white/10 transition-colors"
        style={{
          left: '50%',
          top: '90%',
          transform: 'translateX(-50%)',
          zIndex: 15,
        }}
      >
        JOIN NOW
      </Link>

      {/* Webring overlay when clicked */}
      <AnimatePresence>
        {showWebring && (
          <motion.div
            className="fixed inset-0 bg-black z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* This will be the actual webring component */}
              <div className="text-white text-center">
                <p className="text-2xl mb-4">Webring Coming Soon</p>
                <button
                  onClick={() => setShowWebring(false)}
                  className="px-4 py-2 border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
