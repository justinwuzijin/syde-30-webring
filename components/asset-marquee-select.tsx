'use client'

import { useState, useCallback, useEffect, RefObject } from 'react'
import type { AssetTransform } from './selectable-asset'
import styles from './asset-marquee-select.module.css'

interface AssetMarqueeSelectProps {
  containerRef: RefObject<HTMLDivElement | null>
  transforms: AssetTransform[]
  onSelectionChange: (ids: string[], addToSelection: boolean) => void
  disabled?: boolean
}

interface MarqueeRect {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function AssetMarqueeSelect({
  containerRef,
  transforms,
  onSelectionChange,
  disabled = false,
}: AssetMarqueeSelectProps) {
  const [isSelecting, setIsSelecting] = useState(false)
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null)
  const [addToSelection, setAddToSelection] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    // Don't start marquee if clicking on an asset item
    if ((e.target as HTMLElement).closest('[data-asset-item]')) return

    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsSelecting(true)
    setAddToSelection(e.shiftKey || e.metaKey || e.ctrlKey)
    setMarquee({ startX: x, startY: y, currentX: x, currentY: y })

    // If not holding shift/meta, deselect all on empty click
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
      onSelectionChange([], false)
    }
  }, [containerRef, disabled, onSelectionChange])

  useEffect(() => {
    if (!isSelecting) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      setMarquee(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : null)
    }

    const handleMouseUp = () => {
      if (marquee && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const left = Math.min(marquee.startX, marquee.currentX)
        const right = Math.max(marquee.startX, marquee.currentX)
        const top = Math.min(marquee.startY, marquee.currentY)
        const bottom = Math.max(marquee.startY, marquee.currentY)

        // Only count as marquee if dragged > 5px
        if (right - left > 5 || bottom - top > 5) {
          const selectedIds = transforms.filter(t => {
            const itemLeft = (t.x / 100) * containerRect.width
            const itemTop = (t.y / 100) * containerRect.height
            const itemRight = itemLeft + (t.width / 100) * containerRect.width
            // Estimate height as width (square-ish)
            const itemBottom = itemTop + (t.width / 100) * containerRect.width

            return !(itemRight < left || itemLeft > right || itemBottom < top || itemTop > bottom)
          }).map(t => t.id)

          if (selectedIds.length > 0) {
            onSelectionChange(selectedIds, addToSelection)
          }
        }
      }

      setIsSelecting(false)
      setMarquee(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isSelecting, marquee, transforms, containerRef, onSelectionChange, addToSelection])

  const getMarqueeStyle = () => {
    if (!marquee) return {}
    return {
      left: Math.min(marquee.startX, marquee.currentX),
      top: Math.min(marquee.startY, marquee.currentY),
      width: Math.abs(marquee.currentX - marquee.startX),
      height: Math.abs(marquee.currentY - marquee.startY),
    }
  }

  return (
    <div className={styles.container} onMouseDown={handleMouseDown}>
      {isSelecting && marquee && (
        <div className={styles.marquee} style={getMarqueeStyle()} />
      )}
    </div>
  )
}
