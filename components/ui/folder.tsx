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

  // Photos peek out above the folder body.
  // They are positioned at top=tabH with large negative translateY,
  // so ~50% of the photo is visible above the folder body top edge.
  // The folder body (z:10) covers the lower half — creating the "inside folder" illusion.
  const peek = Math.round(photoH * 0.52) // px visible above folder body

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
        // folder body top = tabH, so photo top = tabH - peek
        // On hover, fan out a bit more
        const extraY = hovered ? -8 : 0
        const extraRot = hovered ? slot.rot * 0.3 : 0

        return (
          <div
            key={src}
            style={{
              position: 'absolute',
              left: `calc(50% + ${slot.dx}px)`,
              top: tabH - peek + extraY,
              width: photoW,
              height: photoH,
              transform: `translateX(-50%) rotate(${slot.rot + extraRot}deg)`,
              transition: 'transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1), top 320ms cubic-bezier(0.34, 1.4, 0.64, 1)',
              zIndex: slot.zIndex,
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 3px 12px rgba(0,0,0,0.7)',
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
          background: '#222222',
          border: '1px solid rgba(255,255,255,0.14)',
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
          background: '#1a1a1a',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: '0 4px 4px 4px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
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
            background: 'rgba(255,255,255,0.06)',
          }}
        />
      </div>
    </div>
  )
}
