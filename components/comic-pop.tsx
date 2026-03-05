'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

const WORDS = ['POW!', 'THWIP!', 'WEB!', 'ZAP!', 'WHAM!', 'SNAP!', 'CLICK!']
const COLORS = ['#E8251A', '#ffdd00', '#0a4fff', '#ff6600', '#cc44ff', '#00cc88']
const DURATION = 620 // ms

interface Pop {
  id: number
  x: number
  y: number
  word: string
  color: string
  rotation: number
}

let nextId = 0

export function ComicPop() {
  const [pops, setPops] = useState<Pop[]>([])
  const timeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const counter = useRef(0)

  const handleClick = useCallback((e: MouseEvent) => {
    // Don't fire on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('a, button, input, [role="button"]')) return

    const id = nextId++
    const word = WORDS[counter.current % WORDS.length]
    const color = COLORS[counter.current % COLORS.length]
    const rotation = (Math.random() - 0.5) * 18 // -9 to +9 degrees
    counter.current++

    setPops(prev => [...prev, { id, x: e.clientX, y: e.clientY, word, color, rotation }])

    // Remove after animation
    const t = setTimeout(() => {
      setPops(prev => prev.filter(p => p.id !== id))
      timeouts.current.delete(id)
    }, DURATION + 50)
    timeouts.current.set(id, t)
  }, [])

  useEffect(() => {
    window.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('click', handleClick)
      timeouts.current.forEach(t => clearTimeout(t))
    }
  }, [handleClick])

  if (pops.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {pops.map(pop => (
        <ComicWord key={pop.id} pop={pop} />
      ))}
    </div>
  )
}

function ComicWord({ pop }: { pop: Pop }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: pop.x,
        top: pop.y,
        transform: `translate(-50%, -50%) rotate(${pop.rotation}deg)`,
        // Comic book onomatopoeia style
        fontFamily: 'Arial Black, Impact, system-ui, sans-serif',
        fontWeight: 900,
        fontSize: 'clamp(48px, 6vw, 80px)',
        color: pop.color,
        // Thick black stroke outline
        WebkitTextStroke: '4px #000',
        paintOrder: 'stroke fill',
        textShadow: `
          3px 3px 0 #000,
          -3px -3px 0 #000,
          3px -3px 0 #000,
          -3px 3px 0 #000,
          0 4px 0 #000,
          4px 0 0 #000,
          0 -4px 0 #000,
          -4px 0 0 #000,
          6px 6px 12px rgba(0,0,0,0.5)
        `,
        letterSpacing: '-0.03em',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        userSelect: 'none',
        animation: `comicPop ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
      }}
    >
      {pop.word}
    </div>
  )
}
