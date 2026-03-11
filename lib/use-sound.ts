'use client'

import { useCallback, useEffect, useRef } from 'react'

const audioCache = new Map<string, HTMLAudioElement>()

function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src)
  if (!audio) {
    audio = new Audio(src)
    audioCache.set(src, audio)
  }
  return audio
}

export function useSound(src: string, { volume = 0.5 }: { volume?: number } = {}) {
  const volumeRef = useRef(volume)
  volumeRef.current = volume

  const play = useCallback(() => {
    const audio = getAudio(src)
    audio.volume = volumeRef.current
    audio.currentTime = 0
    audio.play().catch(() => {})
  }, [src])

  return play
}
