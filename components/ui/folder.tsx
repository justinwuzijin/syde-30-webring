'use client'

import { useState } from 'react'

interface FolderProps {
  photos: string[]
  size?: number
}

export function Folder({ photos, size = 154 }: FolderProps) {
  const [hovered, setHovered] = useState(false)

  const w = size
  const h = Math.round(size * 0.78)
  const tabH = Math.round(size * 0.14)
  const tabW = Math.round(size * 0.42)
  const photoW = Math.round(size * 0.70)
  const photoH = Math.round(size * 0.54)

  // Photos peek out above the folder body. On hover, lift fully above folder.
  const peek = Math.round(photoH * 0.52) // px visible above folder body when collapsed

  // On hover: lift photos so full image is visible (above folder); use higher z-index
  const liftY = hovered ? -(photoH - peek - 4) : 0 // move up so full photo clears folder
  const photoZBase = hovered ? 20 : 0 // photos above folder (z:10) when hovered

  // Fan rotations + horizontal offsets for back / mid / front
  const slots = [
    { rot: -11, dx: -6, zIndex: 1 },
    { rot: -3,  dx:  2, zIndex: 2 },
    { rot:  5,  dx:  8, zIndex: 3 },
  ]

  const visible = photos.slice(0, 3)

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        // Container height = tab + body + room for photos above tab
        height: tabH + h,
        // MUST be visible so photos can extend above the container top
        overflow: 'visible',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photos — positioned so they peek out above the folder body */}
      {visible.map((src, i) => {
        const slot = slots[i] ?? slots[0]
        // Base: top edge of photo sits `peek` px above the folder body top
        // On hover: lift up so full photo is visible above folder; fan out more
        const extraY = hovered ? -8 : 0
        const extraRot = hovered ? slot.rot * 0.3 : 0

        return (
          <div
            key={src}
            style={{
              position: 'absolute',
              left: `calc(50% + ${slot.dx}px)`,
              top: tabH - peek + extraY + liftY,
              width: photoW,
              height: photoH,
              transform: `translateX(-50%) rotate(${slot.rot + extraRot}deg)`,
              transition: 'transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1), top 320ms cubic-bezier(0.34, 1.4, 0.64, 1), z-index 320ms',
              zIndex: photoZBase + slot.zIndex,
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.6)' : '0 3px 12px rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.12)',
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
                filter: 'grayscale(0.15) contrast(1.05)',
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

      {/* Folder body — covers the lower portion of photos (inside-folder illusion) */}
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
