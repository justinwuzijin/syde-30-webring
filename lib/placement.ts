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
 * - uniform grid, center-out, with subtle jitter for organic feel
 * - all members treated equally (no special creator positions)
 * - strict collision guard so no overlaps
 */
function getOrganicSlots(sorted: Member[]): { x: number; y: number }[] {
  const count = sorted.length
  if (count <= 0) return []

  const stepX = POLAROID_WIDTH + CARD_GAP
  const stepY = POLAROID_HEIGHT + CARD_GAP
  // Strict: no overlap allowed (full card size + small buffer)
  const minDx = POLAROID_WIDTH + 8
  const minDy = POLAROID_HEIGHT + 8

  // Generate grid positions sorted by distance from center
  const maxRing = Math.ceil(Math.sqrt(count)) + 2
  const candidates: { x: number; y: number; dist: number }[] = []
  for (let row = -maxRing; row <= maxRing; row++) {
    for (let col = -maxRing; col <= maxRing; col++) {
      const gx = col * stepX
      const gy = row * stepY
      candidates.push({ x: gx, y: gy, dist: gx * gx + gy * gy })
    }
  }
  candidates.sort((a, b) => a.dist - b.dist)

  // Place each member at the next closest grid cell with subtle jitter
  const slots: { x: number; y: number }[] = []
  let ci = 0
  for (let i = 0; i < count && ci < candidates.length; ci++) {
    const cell = candidates[ci]
    const m = sorted[i]
    // Subtle jitter — small enough to never cause overlap
    const jx = (seededUnit(m.id, 'jx') - 0.5) * 16
    const jy = (seededUnit(m.id, 'jy') - 0.5) * 16
    const x = cell.x + jx
    const y = cell.y + jy

    if (overlapsExisting(x, y, slots, minDx, minDy)) {
      // Skip jitter, use raw grid position
      if (overlapsExisting(cell.x, cell.y, slots, minDx, minDy)) continue
      slots.push({ x: cell.x, y: cell.y })
    } else {
      slots.push({ x, y })
    }
    i++
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

  // Extra top padding so polaroids don't overlap the search bar / view toggle
  const HEADER_PAD = 80
  const canvasW = Math.max(400, maxX - minX + GRID_PADDING * 2)
  const canvasH = Math.max(400, maxY - minY + GRID_PADDING * 2 + HEADER_PAD)

  // Center all slots in the canvas, shifted down by HEADER_PAD/2
  const offsetX = canvasW / 2 - (minX + maxX) / 2
  const offsetY = canvasH / 2 - (minY + maxY) / 2 + HEADER_PAD / 2

  const positions = new Map<string, { x: number; y: number; rotation: number }>()
  sorted.forEach((m, i) => {
    const slot = slots[i]
    const rotation = getDeterministicTilt(m.id)
    positions.set(m.id, {
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
