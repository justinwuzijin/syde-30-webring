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
 * - center-out expansion with denser spacing
 * - all members use the same placement rules
 * - strict collision guard so no overlaps
 */
function getOrganicSlots(sorted: Member[]): { x: number; y: number }[] {
  const count = sorted.length
  if (count <= 0) return []

  const stepX = POLAROID_WIDTH + CARD_GAP
  const stepY = POLAROID_HEIGHT + CARD_GAP
  // Dense spacing while preventing overlap.
  const minDx = POLAROID_WIDTH + 8
  const minDy = POLAROID_HEIGHT + 8

  // Generate grid candidates sorted by distance from center.
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

  // Place each member at the next closest grid cell with subtle jitter.
  const slots: { x: number; y: number }[] = []
  let ci = 0
  for (let i = 0; i < count && ci < candidates.length; ci++) {
    const cell = candidates[ci]
    const m = sorted[i]
    // Subtle jitter for organic feel.
    const jx = (seededUnit(m.id, 'jx') - 0.5) * 16
    const jy = (seededUnit(m.id, 'jy') - 0.5) * 16
    const x = cell.x + jx
    const y = cell.y + jy

    if (overlapsExisting(x, y, slots, minDx, minDy)) {
      // Fallback to raw grid position if jitter collides.
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

  const canvasW = Math.max(400, maxX - minX + GRID_PADDING * 2)
  const canvasH = Math.max(400, maxY - minY + GRID_PADDING * 2)

  // Center all cards in the canvas (symmetric bounding box)
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const offsetX = canvasW / 2 - midX
  const offsetY = canvasH / 2 - midY

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

/** Pile: all cards stacked at canvas center with small seeded offsets + large random tilts. */
export function computePilePositions(
  members: Member[],
  canvasW: number,
  canvasH: number
): Map<string, { x: number; y: number; rotation: number }> {
  const sorted = getSortedMembers(members)
  const cx = canvasW / 2 - POLAROID_WIDTH / 2
  const cy = canvasH / 2 - POLAROID_HEIGHT / 2
  const positions = new Map<string, { x: number; y: number; rotation: number }>()
  sorted.forEach((m) => {
    const ox = (seededUnit(m.id, 'pile-x') - 0.5) * 48  // ±24px
    const oy = (seededUnit(m.id, 'pile-y') - 0.5) * 48  // ±24px
    const rot = (seededUnit(m.id, 'pile-r') - 0.5) * 44 // ±22°
    positions.set(m.id, { x: cx + ox, y: cy + oy, rotation: rot })
  })
  return positions
}

/** Classroom: responsive grid, upright. Columns adapt to viewport width. */
export function computeClassroomPositions(
  members: Member[],
  containerWidth?: number
): { positions: Map<string, { x: number; y: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)

  const availableWidth = containerWidth ?? 1200
  const horizontalPad = Math.min(GRID_PADDING, Math.max(16, Math.floor(availableWidth * 0.04)))
  const usableWidth = Math.max(POLAROID_WIDTH, availableWidth - horizontalPad * 2)
  const cols = Math.max(1, Math.floor((usableWidth + CARD_GAP) / (POLAROID_WIDTH + CARD_GAP)))
  const gridContentWidth = cols * POLAROID_WIDTH + (cols - 1) * CARD_GAP
  // Center: equal padding on left and right
  const leftPad = Math.max(horizontalPad, (availableWidth - gridContentWidth) / 2)

  const positions = new Map<string, { x: number; y: number }>()

  // Top padding — clears the fixed tabs bar (top-[4.45rem] + pill height ~38px + 12px gap ≈ 120px)
  const topPad = 120

  sorted.forEach((m, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
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
