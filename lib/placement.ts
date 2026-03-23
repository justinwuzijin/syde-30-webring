/**
 * Deterministic placement logic for webring polaroids.
 * Priority: Leo, Justin, then everyone else by joined_at.
 */

import type { Member } from '@/types/member'
import { POLAROID_WIDTH, POLAROID_HEIGHT } from '@/components/polaroid-card'

export const CARD_GAP = 50
export const GRID_PADDING = 50

/** Creator first names (case-insensitive) — always first in ordering */
export const CREATOR_FIRST_NAMES = ['leo', 'justin']

export function isCreator(member: Member): boolean {
  const first = (member.name.split(' ')[0] ?? '').toLowerCase()
  return CREATOR_FIRST_NAMES.includes(first)
}

/** Stable sort: Leo, Justin, then by joinedAt ascending */
export function getSortedMembers(members: Member[]): Member[] {
  return [...members].sort((a, b) => {
    const aCreator = isCreator(a)
    const bCreator = isCreator(b)
    if (aCreator && !bCreator) return -1
    if (!aCreator && bCreator) return 1
    if (aCreator && bCreator) {
      const aFirst = (a.name.split(' ')[0] ?? '').toLowerCase()
      const bFirst = (b.name.split(' ')[0] ?? '').toLowerCase()
      return CREATOR_FIRST_NAMES.indexOf(aFirst) - CREATOR_FIRST_NAMES.indexOf(bFirst)
    }
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  })
}

/** Deterministic tilt from member id — subtle, -4° to +4° */
export function getDeterministicTilt(id: string): number {
  let h = 5381
  for (const c of id) h = ((h << 5) + h) ^ c.charCodeAt(0)
  return ((h % 11) - 5) * 0.8
}

function seededUnit(memberId: string, salt: string): number {
  let h = 2166136261
  const source = `${memberId}:${salt}`
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000
}

function overlapsExisting(
  x: number,
  y: number,
  existing: { x: number; y: number }[],
  minDx: number,
  minDy: number
): boolean {
  for (const p of existing) {
    if (Math.abs(x - p.x) < minDx && Math.abs(y - p.y) < minDy) return true
  }
  return false
}

/**
 * Organic scrapbook slots:
 * - deterministic per member id
 * - center-out expansion as count grows
 * - jittered rows so large cohorts look less grid-like
 * - hard collision guard so cards stay readable
 */
function getOrganicSlots(sorted: Member[]): { x: number; y: number }[] {
  const count = sorted.length
  const slots: { x: number; y: number }[] = []
  const stepX = POLAROID_WIDTH + CARD_GAP
  const stepY = POLAROID_HEIGHT + CARD_GAP
  const minDx = POLAROID_WIDTH + 14
  const minDy = POLAROID_HEIGHT + 20

  if (count <= 0) return slots
  if (count === 1) return [{ x: 0, y: 0 }]

  // Keep the two creators visually central.
  slots.push({ x: -stepX / 2, y: 0 }, { x: stepX / 2, y: 0 })

  let ring = 1
  let idx = 2
  while (idx < count) {
    const cells: { cx: number; cy: number; d2: number }[] = []
    for (let row = -ring; row <= ring; row++) {
      for (let col = -ring; col <= ring; col++) {
        if (Math.max(Math.abs(row), Math.abs(col)) !== ring) continue
        const cx = col * stepX
        const cy = row * stepY
        cells.push({ cx, cy, d2: cx * cx + cy * cy })
      }
    }
    cells.sort((a, b) => a.d2 - b.d2)

    for (const cell of cells) {
      if (idx >= count) break
      const m = sorted[idx]
      const jitterX = (seededUnit(m.id, 'jx') - 0.5) * Math.min(26, CARD_GAP * 0.55)
      const jitterY = (seededUnit(m.id, 'jy') - 0.5) * Math.min(30, CARD_GAP * 0.65)
      const tiltBias = (seededUnit(m.id, 'tb') - 0.5) * 16

      let x = cell.cx + jitterX + tiltBias
      let y = cell.cy + jitterY

      if (overlapsExisting(x, y, slots, minDx, minDy)) {
        // Deterministic fallback search around the target cell.
        const angles = [20, 65, 110, 155, 200, 245, 290, 335]
        let placed = false
        for (const a of angles) {
          const rad = (a * Math.PI) / 180
          const radius = Math.max(18, CARD_GAP * 0.6)
          const tx = cell.cx + Math.cos(rad) * radius
          const ty = cell.cy + Math.sin(rad) * radius
          if (!overlapsExisting(tx, ty, slots, minDx, minDy)) {
            x = tx
            y = ty
            placed = true
            break
          }
        }
        if (!placed) continue
      }

      slots.push({ x, y })
      idx++
    }
    ring++
  }

  return slots
}

/** Scrapbook: center-out placement with deterministic tilt. No overlap. */
export function computeScrapbookPositions(
  members: Member[]
): { positions: Map<string, { x: number; y: number; rotation: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)
  const slots = getOrganicSlots(sorted)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  sorted.forEach((m, i) => {
    const slot = slots[i]
    const halfW = POLAROID_WIDTH / 2
    const halfH = POLAROID_HEIGHT / 2
    minX = Math.min(minX, slot.x - halfW)
    maxX = Math.max(maxX, slot.x + halfW)
    minY = Math.min(minY, slot.y - halfH)
    maxY = Math.max(maxY, slot.y + halfH)
  })

  const canvasW = Math.max(400, maxX - minX + GRID_PADDING * 2)
  const canvasH = Math.max(400, maxY - minY + GRID_PADDING * 2)

  // Keep Leo + Justin anchor point immutable across cohort growth:
  // the midpoint of the first two slots stays at canvas center.
  const anchorX =
    slots.length >= 2 ? (slots[0].x + slots[1].x) / 2 : slots.length === 1 ? slots[0].x : 0
  const anchorY =
    slots.length >= 2 ? (slots[0].y + slots[1].y) / 2 : slots.length === 1 ? slots[0].y : 0
  const offsetX = canvasW / 2 - anchorX
  const offsetY = canvasH / 2 - anchorY

  const positions = new Map<string, { x: number; y: number; rotation: number }>()
  sorted.forEach((m, i) => {
    const slot = slots[i]
    const rotation = getDeterministicTilt(m.id)
    positions.set(m.id, {
      // PolaroidCard expects top-left x/y and derives visual center internally.
      // Scrapbook slots are center-based, so convert here to top-left space.
      x: slot.x + offsetX - POLAROID_WIDTH / 2,
      y: slot.y + offsetY - POLAROID_HEIGHT / 2,
      rotation,
    })
  })

  return { positions, canvasW, canvasH }
}

/** Classroom: rigid grid, upright. Fixed 7 columns, centered horizontally. */
export function computeClassroomPositions(
  members: Member[],
  containerWidth?: number
): { positions: Map<string, { x: number; y: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)

  // 7 columns on desktop, 2 on mobile (< 768px)
  const COLS = (containerWidth ?? 1200) < 768 ? 2 : 7
  const gridContentWidth = COLS * POLAROID_WIDTH + (COLS - 1) * CARD_GAP
  const availableWidth = containerWidth ?? gridContentWidth + GRID_PADDING * 2
  // Center: equal padding on left and right
  const leftPad = Math.max(GRID_PADDING, (availableWidth - gridContentWidth) / 2)

  const positions = new Map<string, { x: number; y: number }>()

  // Top padding to clear the search bar + view toggle overlay (~120px)
  const topPad = 120

  sorted.forEach((m, i) => {
    const row = Math.floor(i / COLS)
    const col = i % COLS
    positions.set(m.id, {
      x: leftPad + col * (POLAROID_WIDTH + CARD_GAP),
      y: topPad + row * (POLAROID_HEIGHT + CARD_GAP),
    })
  })

  let maxY = 0
  positions.forEach((pos) => {
    maxY = Math.max(maxY, pos.y + POLAROID_HEIGHT)
  })
  const canvasW = availableWidth
  const canvasH = maxY + GRID_PADDING

  return { positions, canvasW, canvasH }
}
