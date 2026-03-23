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

/** Spiral slots: center-out, no overlap guaranteed. Leo & Justin side-by-side at center. */
function getSpiralSlots(count: number): { x: number; y: number }[] {
  const slots: { x: number; y: number }[] = []
  const stepX = POLAROID_WIDTH + CARD_GAP
  const stepY = POLAROID_HEIGHT + CARD_GAP

  if (count <= 0) return slots
  if (count === 1) {
    slots.push({ x: 0, y: 0 })
    return slots
  }

  // First two: side-by-side at center (half-grid offset)
  const placed = [{ x: -stepX / 2, y: 0 }, { x: stepX / 2, y: 0 }]
  slots.push(...placed)

  if (count > 2) {
    // Generate grid candidates, reject any that overlap existing slots
    function wouldOverlap(gx: number, gy: number): boolean {
      for (const p of placed) {
        if (Math.abs(gx - p.x) < stepX - 1 && Math.abs(gy - p.y) < stepY - 1) {
          return true
        }
      }
      return false
    }

    const maxRing = Math.ceil(Math.sqrt(count)) + 2
    const candidates: { x: number; y: number; dist: number }[] = []
    for (let row = -maxRing; row <= maxRing; row++) {
      for (let col = -maxRing; col <= maxRing; col++) {
        const gx = col * stepX
        const gy = row * stepY
        if (!wouldOverlap(gx, gy)) {
          candidates.push({ x: gx, y: gy, dist: gx * gx + gy * gy })
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist)

    for (let i = 0; i < count - 2 && i < candidates.length; i++) {
      slots.push({ x: candidates[i].x, y: candidates[i].y })
    }
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

/** Classroom: rigid grid, upright, equal spacing. Same ordering. */
export function computeClassroomPositions(
  members: Member[]
): { positions: Map<string, { x: number; y: number }>; canvasW: number; canvasH: number } {
  const sorted = getSortedMembers(members)
  const n = sorted.length
  const cols = Math.min(8, Math.max(2, n))
  const rows = Math.ceil(n / cols)
  const innerW = cols * (POLAROID_WIDTH + CARD_GAP) - CARD_GAP
  const innerH = rows * (POLAROID_HEIGHT + CARD_GAP) - CARD_GAP
  const canvasW = innerW + GRID_PADDING * 2
  const canvasH = innerH + GRID_PADDING * 2

  const positions = new Map<string, { x: number; y: number }>()
  sorted.forEach((m, i) => {
    positions.set(m.id, {
      x: GRID_PADDING + (i % cols) * (POLAROID_WIDTH + CARD_GAP),
      y: GRID_PADDING + Math.floor(i / cols) * (POLAROID_HEIGHT + CARD_GAP),
    })
  })

  return { positions, canvasW, canvasH }
}
