'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface PanState {
  x: number
  y: number
}

interface PanHandlers {
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
}

interface UsePanOptions {
  initialX?: number
  initialY?: number
  friction?: number
}

export function usePan({ initialX = 0, initialY = 0, friction = 0.92 }: UsePanOptions = {}) {
  const [pan, setPan] = useState<PanState>({ x: initialX, y: initialY })

  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })
  const rafId = useRef<number | null>(null)
  const panRef = useRef<PanState>({ x: initialX, y: initialY })

  // Keep panRef in sync
  const updatePan = useCallback((x: number, y: number) => {
    panRef.current = { x, y }
    setPan({ x, y })
  }, [])

  const stopMomentum = useCallback(() => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current)
      rafId.current = null
    }
  }, [])

  const startMomentum = useCallback(() => {
    stopMomentum()

    const step = () => {
      velocity.current.x *= friction
      velocity.current.y *= friction

      if (Math.abs(velocity.current.x) < 0.3 && Math.abs(velocity.current.y) < 0.3) {
        velocity.current = { x: 0, y: 0 }
        return
      }

      const next = {
        x: panRef.current.x + velocity.current.x,
        y: panRef.current.y + velocity.current.y,
      }
      updatePan(next.x, next.y)
      rafId.current = requestAnimationFrame(step)
    }

    rafId.current = requestAnimationFrame(step)
  }, [friction, stopMomentum, updatePan])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on interactive elements
    if ((e.target as HTMLElement).closest('a, button')) return
    stopMomentum()
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    velocity.current = { x: 0, y: 0 }
    e.preventDefault()
  }, [stopMomentum])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    velocity.current = { x: dx, y: dy }
    updatePan(panRef.current.x + dx, panRef.current.y + dy)
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [updatePan])

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    startMomentum()
  }, [startMomentum])

  const onMouseLeave = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      startMomentum()
    }
  }, [startMomentum])

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0 })

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    stopMomentum()
    dragging.current = true
    const t = e.touches[0]
    lastTouch.current = { x: t.clientX, y: t.clientY }
    velocity.current = { x: 0, y: 0 }
  }, [stopMomentum])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current) return
    const t = e.touches[0]
    const dx = t.clientX - lastTouch.current.x
    const dy = t.clientY - lastTouch.current.y
    velocity.current = { x: dx, y: dy }
    updatePan(panRef.current.x + dx, panRef.current.y + dy)
    lastTouch.current = { x: t.clientX, y: t.clientY }
    e.preventDefault()
  }, [updatePan])

  const onTouchEnd = useCallback(() => {
    dragging.current = false
    startMomentum()
  }, [startMomentum])

  useEffect(() => () => stopMomentum(), [stopMomentum])

  const handlers: PanHandlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  }

  return { pan, handlers, isDragging: dragging }
}
