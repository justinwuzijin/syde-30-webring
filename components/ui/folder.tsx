'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface FolderProps {
  photos: string[]
  size?: number
}

export function Folder({ photos, size = 154 }: FolderProps) {
  const [hovered, setHovered] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const w = size
  const h = Math.round(size * 0.78)
  const tabH = Math.round(size * 0.14)
  const tabW = Math.round(size * 0.42)
  
  // Small preview dimensions (peeking out of folder)
  const smallPhotoW = Math.round(size * 0.70)
  const smallPhotoH = Math.round(size * 0.54)
  
  // Large preview dimensions on hover (smaller now)
  const largePhotoW = 220
  const largePhotoH = 165

  // Photos peek out above the folder body when not hovered
  const peek = Math.round(smallPhotoH * 0.52)

  // Fan rotations + horizontal offsets for back / mid / front (small state)
  const smallSlots = [
    { rot: -11, dx: -6, zIndex: 1 },
    { rot: -3,  dx:  2, zIndex: 2 },
    { rot:  5,  dx:  8, zIndex: 3 },
  ]
  
  // Large state: fan out to the right with tighter spacing
  const largeSlots = [
    { rot: -3, dx: 0, dy: 0, zIndex: 1 },
    { rot: 2, dx: 120, dy: 10, zIndex: 2 },
    { rot: 5, dx: 240, dy: 20, zIndex: 3 },
  ]

  // Reorder photos so active one is last (front)
  const reorderedPhotos = [
    ...photos.filter((_, i) => i !== activeIndex),
    photos[activeIndex],
  ].filter(Boolean)
  
  const visible = reorderedPhotos.slice(0, 3)

  const goNext = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % photos.length)
  }, [photos.length])

  const goPrev = useCallback(() => {
    setActiveIndex(prev => (prev - 1 + photos.length) % photos.length)
  }, [photos.length])

  // Keyboard navigation when hovered
  useEffect(() => {
    if (!hovered) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goPrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hovered, goNext, goPrev])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        position: 'relative',
        width: w,
        height: tabH + h,
        overflow: 'visible',
        cursor: 'pointer',
        outline: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photos — small peek when collapsed, large fan when hovered */}
      {visible.map((src, i) => {
        const smallSlot = smallSlots[i] ?? smallSlots[0]
        const largeSlot = largeSlots[i] ?? largeSlots[0]
        const isActive = src === photos[activeIndex]
        
        // Small state positioning
        const smallLeft = `calc(50% + ${smallSlot.dx}px)`
        const smallTop = tabH - peek
        const smallTransform = `translateX(-50%) rotate(${smallSlot.rot}deg)`
        
        // Large state: position above and to the right of the folder
        const largeLeft = largeSlot.dx
        const largeTop = -largePhotoH - 16 + (largeSlot.dy || 0)
        const largeTransform = `rotate(${largeSlot.rot}deg)`

        return (
          <div
            key={src}
            onClick={() => {
              const originalIndex = photos.indexOf(src)
              if (originalIndex !== -1) {
                setActiveIndex(originalIndex)
              }
            }}
            style={{
              position: 'absolute',
              left: hovered ? largeLeft : smallLeft,
              top: hovered ? largeTop : smallTop,
              width: hovered ? largePhotoW : smallPhotoW,
              height: hovered ? largePhotoH : smallPhotoH,
              transform: hovered ? largeTransform : smallTransform,
              transition: 'all 350ms cubic-bezier(0.34, 1.2, 0.64, 1)',
              zIndex: hovered ? 100 + largeSlot.zIndex : smallSlot.zIndex,
              borderRadius: 0,
              overflow: 'hidden',
              boxShadow: hovered 
                ? '0 12px 32px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.4)' 
                : '0 3px 12px rgba(0,0,0,0.7)',
              border: hovered && isActive
                ? '2px solid rgba(255,255,255,0.5)' 
                : hovered
                ? '1px solid rgba(255,255,255,0.15)'
                : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="SYDE 30 photo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: hovered ? 'none' : 'grayscale(0.15) contrast(1.05)',
                transition: 'filter 350ms ease',
              }}
              draggable={false}
            />
          </div>
        )
      })}

      {/* Folder tab */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: tabW,
          height: tabH,
          background: '#ca8a04',
          border: '1px solid rgba(0,0,0,0.15)',
          borderBottom: 'none',
          borderRadius: '4px 4px 0 0',
          zIndex: 10,
        }}
      />

      {/* Folder body */}
      <div
        style={{
          position: 'absolute',
          top: tabH - 1,
          left: 0,
          width: w,
          height: h,
          background: '#eab308',
          border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: '0 4px 4px 4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 12,
            right: 12,
            height: 1,
            background: 'rgba(0,0,0,0.1)',
          }}
        />
      </div>
    </div>
  )
}
