'use client'

import { useEffect, useState } from 'react'
import { Folder } from './ui/folder'
import { SYDE30_PHOTOS } from '@/lib/photos'

const CYCLE_INTERVAL = 3200 // ms between photo rotations
const PLACEHOLDER_BASE = 'https://picsum.photos/seed/syde30'

function getPhotos(): string[] {
  // Use real photos if available, otherwise cycle picsum placeholders
  return SYDE30_PHOTOS.length > 0
    ? SYDE30_PHOTOS
    : [
        `${PLACEHOLDER_BASE}a/300/220`,
        `${PLACEHOLDER_BASE}b/300/220`,
        `${PLACEHOLDER_BASE}c/300/220`,
        `${PLACEHOLDER_BASE}d/300/220`,
        `${PLACEHOLDER_BASE}e/300/220`,
      ]
}

export function PhotoFolder() {
  const photos = getPhotos()
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (photos.length <= 1) return
    const id = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % photos.length)
    }, CYCLE_INTERVAL)
    return () => clearInterval(id)
  }, [photos.length])

  // Rotate the photos array so the active one is always last (front)
  const rotated = [
    ...photos.slice(activeIndex + 1),
    ...photos.slice(0, activeIndex + 1),
  ]

  return <Folder photos={rotated} activeIndex={activeIndex} size={104} />
}
