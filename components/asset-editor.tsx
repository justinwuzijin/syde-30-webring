'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { SelectableAsset, AssetTransform, AssetConfig } from './selectable-asset'
import { AssetMarqueeSelect } from './asset-marquee-select'
import { useSound } from '@/lib/use-sound'

const ASSET_CONFIGS: AssetConfig[] = [
  { id: 'matlab', src: '/matlab.webp', alt: 'MATLAB' },
  { id: 'sw-cube', src: '/sw-cube.webp', alt: 'SolidWorks' },
  { id: 'cpp', src: '/cpp.webp', alt: 'C++' },
  { id: 'sandwich', src: '/sandwich.webp', alt: 'Sandwich' },
  { id: 'crest', src: '/crest.webp', alt: 'Crest' },
  { id: 'book', src: '/book-river.webp', alt: 'Book' },
  { id: 'releasing-march', src: '/releasing-march.png', alt: 'Releasing March' },
]

const DESKTOP_TRANSFORMS: AssetTransform[] = [
  { id: 'matlab', x: 55, y: 60, width: 20, rotation: 0, zIndex: 5 },
  { id: 'sw-cube', x: 20, y: 20, width: 18, rotation: 20, zIndex: 5 },
  { id: 'cpp', x: 72, y: 23, width: 8, rotation: 20, zIndex: 5 },
  { id: 'sandwich', x: 80, y: 24, width: 14, rotation: 0, zIndex: 5 },
  { id: 'crest', x: 62, y: 35, width: 18, rotation: -20, zIndex: 5 },
  { id: 'book', x: 24, y: 40, width: 12, rotation: 15, zIndex: 1 },
  { id: 'releasing-march', x: 86, y: 40, width: 12, rotation: 0, zIndex: 2 },
]

// Mobile layout — assets orbit around the circle preview (centered ~50%, ~46%, radius ~32.5vw)
const MOBILE_TRANSFORMS: AssetTransform[] = [
  { id: 'matlab', x: 2, y: 28, width: 28, rotation: -8, zIndex: 5 },       // left of circle
  { id: 'sw-cube', x: 4, y: 52, width: 28, rotation: 12, zIndex: 5 },      // bottom-left
  { id: 'cpp', x: 78, y: 30, width: 16, rotation: 12, zIndex: 5 },         // right of circle
  { id: 'sandwich', x: 62, y: 18, width: 26, rotation: 0, zIndex: 5 },     // top-right
  { id: 'crest', x: 62, y: 62, width: 24, rotation: -12, zIndex: 5 },      // bottom-right
  { id: 'book', x: 70, y: 44, width: 22, rotation: 8, zIndex: 1 },         // right
  { id: 'releasing-march', x: 3, y: 72, width: 24, rotation: -5, zIndex: 2 }, // bottom-left
]

function getInitialTransforms() {
  if (typeof window === 'undefined') return DESKTOP_TRANSFORMS
  return window.innerWidth < 768 ? MOBILE_TRANSFORMS : DESKTOP_TRANSFORMS
}

export function AssetEditor() {
  const playClick = useSound('/click.mp3', { volume: 0.4 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [transforms, setTransforms] = useState<AssetTransform[]>(getInitialTransforms)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Snap layout when crossing 768px breakpoint
  const wasMobileRef = useRef(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const onResize = () => {
      const isMobile = window.innerWidth < 768
      if (isMobile !== wasMobileRef.current) {
        wasMobileRef.current = isMobile
        const next = isMobile ? MOBILE_TRANSFORMS : DESKTOP_TRANSFORMS
        setTransforms(next)
        setHistory([next])
        setHistoryIndex(0)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Undo stack
  const [history, setHistory] = useState<AssetTransform[][]>([getInitialTransforms()])
  const [historyIndex, setHistoryIndex] = useState(0)

  const pushHistory = useCallback((newTransforms: AssetTransform[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1)
      return [...trimmed, newTransforms]
    })
    setHistoryIndex(prev => prev + 1)
  }, [historyIndex])

  const handleTransformChange = useCallback((id: string, updates: Partial<AssetTransform>) => {
    setTransforms(prev => {
      const next = prev.map(t => t.id === id ? { ...t, ...updates } : t)
      return next
    })
  }, [])

  // Push to history on mouse up (end of drag/resize/rotate)
  useEffect(() => {
    const handleMouseUp = () => {
      // Debounce: only push if transforms changed from current history
      setTransforms(current => {
        const lastSaved = history[historyIndex]
        if (JSON.stringify(current) !== JSON.stringify(lastSaved)) {
          pushHistory(current)
        }
        return current
      })
    }
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [history, historyIndex, pushHistory])

  const handleSelect = useCallback((id: string, addToSelection: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(addToSelection ? prev : [])
      if (prev.has(id) && addToSelection) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectionChange = useCallback((ids: string[], addToSelection: boolean) => {
    setSelectedIds(prev => {
      if (ids.length === 0 && !addToSelection) return new Set()
      const next = new Set(addToSelection ? prev : [])
      ids.forEach(id => next.add(id))
      return next
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape → deselect
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) {
          setSelectedIds(new Set())
        }
        return
      }

      // Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (historyIndex > 0) {
          setHistoryIndex(prev => prev - 1)
          setTransforms(history[historyIndex - 1])
        }
        return
      }

      // Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        if (historyIndex < history.length - 1) {
          setHistoryIndex(prev => prev + 1)
          setTransforms(history[historyIndex + 1])
        }
        return
      }

      // Arrow keys to nudge selected items
      if (selectedIds.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 1 : 0.2
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        setTransforms(prev =>
          prev.map(t => selectedIds.has(t.id)
            ? { ...t, x: t.x + dx, y: t.y + dy }
            : t
          )
        )
      }

      // Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedIds(new Set(transforms.map(t => t.id)))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, history, historyIndex, transforms])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ zIndex: 5, pointerEvents: 'auto' }}
    >
      {/* Marquee select layer */}
      <AssetMarqueeSelect
        containerRef={containerRef}
        transforms={transforms}
        onSelectionChange={handleSelectionChange}
      />

      {/* Asset items */}
      {ASSET_CONFIGS.map(config => {
        const transform = transforms.find(t => t.id === config.id)
        if (!transform) return null
        return (
          <SelectableAsset
            key={config.id}
            config={config}
            transform={transform}
            containerRef={containerRef}
            isSelected={selectedIds.has(config.id)}
            onSelect={handleSelect}
            onTransformChange={handleTransformChange}
            onClickSound={playClick}
          />
        )
      })}
    </div>
  )
}
