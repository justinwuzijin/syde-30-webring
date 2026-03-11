'use client'

import { useRef, useEffect, useState, useCallback, MouseEvent as ReactMouseEvent } from 'react'
import styles from './selectable-asset.module.css'

type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface AssetTransform {
  id: string
  x: number        // left % of container
  y: number        // top % of container
  width: number    // width % of container
  rotation: number // degrees
  zIndex: number
}

export interface AssetConfig {
  id: string
  src: string
  alt: string
}

interface SelectableAssetProps {
  config: AssetConfig
  transform: AssetTransform
  containerRef: React.RefObject<HTMLDivElement | null>
  isSelected: boolean
  onSelect: (id: string, addToSelection: boolean) => void
  onTransformChange: (id: string, updates: Partial<AssetTransform>) => void
  onClickSound?: () => void
}

export function SelectableAsset({
  config,
  transform,
  containerRef,
  isSelected,
  onSelect,
  onTransformChange,
  onClickSound,
}: SelectableAssetProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null)

  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 })
  const resizeStartRef = useRef({
    x: 0, y: 0,
    width: 0,
    startX: 0, startY: 0,
  })
  const rotateStartRef = useRef({ angle: 0, startRotation: 0 })

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (isResizing || isRotating) return
    e.stopPropagation()

    const addToSelection = e.shiftKey || e.metaKey || e.ctrlKey
    onClickSound?.()
    onSelect(config.id, addToSelection)

    if (!containerRef.current) return

    setIsDragging(true)
    const containerRect = containerRef.current.getBoundingClientRect()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: (transform.x / 100) * containerRect.width,
      startY: (transform.y / 100) * containerRect.height,
    }
  }, [config.id, transform, containerRef, onSelect, isResizing, isRotating])

  const handleResizeStart = useCallback((e: ReactMouseEvent, handle: HandlePosition) => {
    e.stopPropagation()
    e.preventDefault()

    if (!containerRef.current) return

    setIsResizing(true)
    setActiveHandle(handle)

    const containerRect = containerRef.current.getBoundingClientRect()
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: (transform.width / 100) * containerRect.width,
      startX: (transform.x / 100) * containerRect.width,
      startY: (transform.y / 100) * containerRect.height,
    }
  }, [transform, containerRef])

  const handleRotateStart = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!elementRef.current) return

    setIsRotating(true)

    const rect = elementRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)

    rotateStartRef.current = {
      angle,
      startRotation: transform.rotation,
    }
  }, [transform.rotation])

  // Drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y
      const newX = dragStartRef.current.startX + deltaX
      const newY = dragStartRef.current.startY + deltaY
      onTransformChange(config.id, {
        x: (newX / containerRect.width) * 100,
        y: (newY / containerRect.height) * 100,
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, config.id, containerRef, onTransformChange])

  // Resize
  useEffect(() => {
    if (!isResizing || !activeHandle) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const deltaX = e.clientX - resizeStartRef.current.x
      const deltaY = e.clientY - resizeStartRef.current.y
      const { width: startWidthPx, startX, startY } = resizeStartRef.current

      let newWidthPx = startWidthPx
      let newXPx = startX
      let newYPx = startY

      switch (activeHandle) {
        case 'e':
        case 'ne':
        case 'se':
          newWidthPx = Math.max(30, startWidthPx + deltaX)
          break
        case 'w':
        case 'nw':
        case 'sw':
          newWidthPx = Math.max(30, startWidthPx - deltaX)
          newXPx = startX + (startWidthPx - newWidthPx)
          break
      }

      // For corner handles, also adjust position for top handles
      if (activeHandle === 'ne' || activeHandle === 'nw' || activeHandle === 'n') {
        newYPx = startY + deltaY
      }

      const updates: Partial<AssetTransform> = {
        width: (newWidthPx / containerRect.width) * 100,
      }

      if (activeHandle === 'w' || activeHandle === 'nw' || activeHandle === 'sw') {
        updates.x = (newXPx / containerRect.width) * 100
      }
      if (activeHandle === 'n' || activeHandle === 'ne' || activeHandle === 'nw') {
        updates.y = (newYPx / containerRect.height) * 100
      }

      onTransformChange(config.id, updates)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setActiveHandle(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, activeHandle, config.id, containerRef, onTransformChange])

  // Rotate
  useEffect(() => {
    if (!isRotating) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!elementRef.current) return
      const rect = elementRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI)
      const deltaAngle = currentAngle - rotateStartRef.current.angle
      let newRotation = rotateStartRef.current.startRotation + deltaAngle

      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15
      }

      onTransformChange(config.id, { rotation: newRotation })
    }

    const handleMouseUp = () => setIsRotating(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isRotating, config.id, onTransformChange])

  const handles: HandlePosition[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

  return (
    <div
      ref={elementRef}
      className={`${styles.item} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
      style={{
        left: `${transform.x}%`,
        top: `${transform.y}%`,
        width: `${transform.width}%`,
        zIndex: transform.zIndex + (isDragging ? 1000 : 0),
        transform: `rotate(${transform.rotation}deg)`,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <img
        src={config.src}
        alt={config.alt}
        className={styles.image}
        draggable={false}
      />

      {isSelected && (
        <>
          <div className={styles.selectionBox} />

          {handles.map((handle) => (
            <div
              key={handle}
              className={`${styles.handle} ${styles[`handle_${handle}`]}`}
              onMouseDown={(e) => handleResizeStart(e, handle)}
            />
          ))}

          <div
            className={styles.rotateHandle}
            onMouseDown={handleRotateStart}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </div>

          <div className={styles.rotateLine} />
        </>
      )}
    </div>
  )
}
