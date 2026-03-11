'use client'

import { Folder } from './ui/folder'
import { SYDE30_PHOTOS } from '@/lib/photos'

const PLACEHOLDER_BASE = 'https://picsum.photos/seed/syde30'

function getPhotos(): string[] {
  return SYDE30_PHOTOS.length > 0
    ? SYDE30_PHOTOS
    : [
        `${PLACEHOLDER_BASE}a/300/220`,
        `${PLACEHOLDER_BASE}b/300/220`,
        `${PLACEHOLDER_BASE}c/300/220`,
      ]
}

interface PhotoFolderProps {
  onHover?: () => void
  onPhotoChange?: () => void
  onPhotoHover?: () => void
}

export function PhotoFolder({ onHover, onPhotoChange, onPhotoHover }: PhotoFolderProps) {
  const photos = getPhotos()
  return <Folder photos={photos} size={104} onHover={onHover} onPhotoChange={onPhotoChange} onPhotoHover={onPhotoHover} />
}
