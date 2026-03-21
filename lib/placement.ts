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

/** Spiral slots: center-out, no overlap. Leo & Justin side-by-side at center. */
function getSpiralSlots(count: number): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = []
  const stepX = POLAROID_WIDTH + CARD_GAP
  const stepY = POLAROID_HEIGHT + CARD_GAP

  if (count <= 0) return slots

  // Slot 0: center. Slot 1: right of center (Leo & Justin side-by-side)
  if (count === 1) {
    slots.push({ x: 0, y: 0 })
    return slots
  }
  if (count === 2) {
    slots.push({ x: -stepX / 2, y: 0 })
    slots.push({ x: stepX / 2, y: 0 })
    return slots
  }

  // 3+: spiral outward
  slots.push({ x: -stepX / 2, y: 0 })
  slots.push({ x: stepX / 2, y: 0 })
  slots.push({ x: 0, y: stepY })

  let ring = 1
  while (slots.length < count) {
    for (let i = -ring; i <= ring && slots.length < count; i++) {
      slots.push({ x: i * stepX, y: -ring * stepY })
    }
    for (let j = -ring + 1; j <= ring && slots.length < count; j++) {
      slots.push({ x: ring * stepX, y: j * stepY })
    }
    for (let i = ring - 1; i >= -ring && slots.length < count; i--) {
      slots.push({ x: i * stepX, y: ring * stepY })
    }
    for (let j = ring - 1; j >= -ring && slots.length < count; j--) {
      slots.push({ x: -ring * stepX, y: j * stepY })
    }
    ring++
  }

  return slots.slice(0, count)
}

/** Scrapbook: center-out placement with deterministic tilt. No overlap. */
export function computeScrapbookPositions(
  members: Member[]
): { positions: Map<string, { x: number; y: number; rotation: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)
  const slots = getSpiralSlots(sorted.length)

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
  const offsetX = canvasW / 2 - (minX + maxX) / 2
  const offsetY = canvasH / 2 - (minY + maxY) / 2

  const positions = new Map<string, { x: number; y: number; rotation: number }>()
  sorted.forEach((m, i) => {
    const slot = slots[i]
    const rotation = getDeterministicTilt(m.id)
    positions.set(m.id, {
      x: slot.x + offsetX,
      y: slot.y + offsetY,
      rotation,
    })
  })

  return { positions, canvasW, canvasH }
}

/** Classroom: rigid grid, upright. Row 0 = Leo & Justin only; row 1+ = others, cols from viewport. */
export function computeClassroomPositions(
  members: Member[],
  containerWidth?: number
): { positions: Map<string, { x: number; y: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)
  const creators = sorted.filter(isCreator)
  const others = sorted.filter((m) => !isCreator(m))

  const availableWidth = containerWidth ?? 1200
  const colsBelow = Math.max(
    2,
    Math.floor((availableWidth - 2 * GRID_PADDING) / (POLAROID_WIDTH + CARD_GAP))
  )

  const positions = new Map<string, { x: number; y: number }>()

  // Row 0: Leo and Justin only (2 columns)
  creators.slice(0, 2).forEach((m, i) => {
    positions.set(m.id, {
      x: GRID_PADDING + i * (POLAROID_WIDTH + CARD_GAP),
      y: GRID_PADDING,
    })
  })

  const topRowCount = Math.min(2, creators.length)
  const startY =
    topRowCount > 0 ? GRID_PADDING + (POLAROID_HEIGHT + CARD_GAP) : GRID_PADDING

  // Row 1+: all others, colsBelow per row
  others.forEach((m, i) => {
    const row = Math.floor(i / colsBelow)
    const col = i % colsBelow
    positions.set(m.id, {
      x: GRID_PADDING + col * (POLAROID_WIDTH + CARD_GAP),
      y: startY + row * (POLAROID_HEIGHT + CARD_GAP),
    })
  })

  let maxX = 0
  let maxY = 0
  positions.forEach((pos) => {
    maxX = Math.max(maxX, pos.x + POLAROID_WIDTH)
    maxY = Math.max(maxY, pos.y + POLAROID_HEIGHT)
  })
  const canvasW = maxX + GRID_PADDING
  const canvasH = maxY + GRID_PADDING

  return { positions, canvasW, canvasH }
}
