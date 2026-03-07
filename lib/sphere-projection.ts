/**
 * Spherical projection for webring globe.
 * Maps 3D positions on a unit sphere to 2D screen coords with rotation, scale, and tilt.
 */

export interface Position3D {
  x: number
  y: number
  z: number
}

export interface ProjectedPosition {
  x: number
  y: number
  z: number
  scale: number
  tiltX: number
  tiltY: number
  visible: boolean
}

/**
 * Rotate a 3D point: first Y-axis (theta), then X-axis (phi).
 * Y-axis rotation: spins the globe left/right.
 * X-axis rotation: tilts the globe up/down.
 */
function rotate3D(
  x: number,
  y: number,
  z: number,
  theta: number,
  phi: number
): { x: number; y: number; z: number } {
  // Y-axis rotation (theta) - around vertical
  const c1 = Math.cos(theta)
  const s1 = Math.sin(theta)
  const x1 = x * c1 - z * s1
  const z1 = x * s1 + z * c1
  const y1 = y

  // X-axis rotation (phi) - tilt up/down
  const c2 = Math.cos(phi)
  const s2 = Math.sin(phi)
  const y2 = y1 * c2 - z1 * s2
  const z2 = y1 * s2 + z1 * c2
  const x2 = x1

  return { x: x2, y: y2, z: z2 }
}

/**
 * Convert 2D force-layout positions to 3D positions on a unit sphere.
 * Center of 2D layout maps to front of sphere (0, 0, 1). Points further from center map to the horizon.
 */
export function toSpherePositions(
  positions2d: Map<string, { x: number; y: number }>,
  centerX: number,
  centerY: number,
  radius: number
): Map<string, Position3D> {
  const result = new Map<string, Position3D>()
  for (const [id, pos] of positions2d) {
    const dx = pos.x - centerX
    const dy = pos.y - centerY
    const r = Math.min(1, Math.sqrt(dx * dx + dy * dy) / radius)
    const lon = Math.atan2(dx, dy)
    const lat = r * (Math.PI / 2)
    // Unit sphere: x right, y up, z toward camera. Center (r=0) -> (0,0,1). Edge (r=1) -> horizon.
    const x3 = Math.sin(lat) * Math.cos(lon)
    const y3 = Math.sin(lat) * Math.sin(lon)
    const z3 = Math.cos(lat)
    result.set(id, { x: x3, y: y3, z: z3 })
  }
  return result
}

/**
 * Project 3D sphere positions to 2D with rotation.
 * Returns screen coords (x, y), depth (z), scale by depth, and tilt for card orientation.
 * zoom: when > 1, depth scale is more dramatic (center nodes larger vs horizon) for "fly closer" feel.
 */
export function project(
  positions3d: Map<string, Position3D>,
  theta: number,
  phi: number,
  zoom = 1
): Map<string, ProjectedPosition> {
  const result = new Map<string, ProjectedPosition>()
  const depthStrength = Math.min(1.4, 0.55 + 0.35 * zoom)
  for (const [id, pos] of positions3d) {
    const rotated = rotate3D(pos.x, pos.y, pos.z, theta, phi)
    const { x: xRot, y: yRot, z: zRot } = rotated

    // Orthographic projection: (x, y) = (xRot, yRot), z is depth
    const visible = zRot > -0.1

    // Scale by depth: zoom in = stronger perspective (center much larger than horizon)
    const depthScale = Math.max(0.2, 0.45 + depthStrength * zRot)

    // Surface tilt: card faces outward from sphere. Normal at point (xRot,yRot,zRot) is the point itself.
    // Tilt so card plane is perpendicular to the normal. For a card "on" the surface:
    // rotateX = -asin(yRot) -> tilt based on y (up/down on screen)
    // rotateY = atan2(xRot, zRot) -> tilt based on x (left/right)
    const tiltX = -Math.asin(Math.max(-1, Math.min(1, yRot))) * (180 / Math.PI)
    const tiltY = Math.atan2(xRot, zRot) * (180 / Math.PI)

    result.set(id, {
      x: xRot,
      y: yRot,
      z: zRot,
      scale: depthScale,
      tiltX,
      tiltY,
      visible,
    })
  }
  return result
}

/**
 * Convert projected coords (in [-1,1]) to canvas coords.
 * Center of view is at (centerX, centerY). scale = sphere radius in canvas px (so sphere fills the circle).
 */
export function toCanvasCoords(
  projected: Map<string, ProjectedPosition>,
  centerX: number,
  centerY: number,
  scale: number
): Map<string, { x: number; y: number; scale: number; tiltX: number; tiltY: number; visible: boolean }> {
  const result = new Map()
  const s = scale
  for (const [id, p] of projected) {
    result.set(id, {
      x: centerX + p.x * s,
      y: centerY + p.y * s,
      scale: p.scale,
      tiltX: p.tiltX,
      tiltY: p.tiltY,
      visible: p.visible,
    })
  }
  return result
}
