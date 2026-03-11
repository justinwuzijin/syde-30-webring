'use client'

import { useEffect, useRef } from 'react'
import styles from './asset-context-menu.module.css'

interface AssetContextMenuProps {
  position: { x: number; y: number }
  selectedCount: number
  onClose: () => void
  onBringToFront: () => void
  onBringForward: () => void
  onSendBackward: () => void
  onSendToBack: () => void
  onResetRotation: () => void
  onCopyPositions: () => void
}

export function AssetContextMenu({
  position,
  selectedCount,
  onClose,
  onBringToFront,
  onBringForward,
  onSendBackward,
  onSendToBack,
  onResetRotation,
  onCopyPositions,
}: AssetContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: position.x, top: position.y }}
    >
      <div className={styles.section}>
        <button className={styles.item} onClick={() => handleAction(onBringToFront)}>
          <span className={styles.label}>Bring to Front</span>
        </button>
        <button className={styles.item} onClick={() => handleAction(onBringForward)}>
          <span className={styles.label}>Bring Forward</span>
        </button>
        <button className={styles.item} onClick={() => handleAction(onSendBackward)}>
          <span className={styles.label}>Send Backward</span>
        </button>
        <button className={styles.item} onClick={() => handleAction(onSendToBack)}>
          <span className={styles.label}>Send to Back</span>
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <button className={styles.item} onClick={() => handleAction(onResetRotation)}>
          <span className={styles.label}>Reset Rotation</span>
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.section}>
        <button className={styles.item} onClick={() => handleAction(onCopyPositions)}>
          <span className={styles.label}>Copy All Positions</span>
          <span className={styles.shortcut}>JSON</span>
        </button>
      </div>
    </div>
  )
}
