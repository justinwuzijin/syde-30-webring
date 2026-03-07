'use client'

import { useRef, useEffect } from 'react'

// ─── Perlin noise (same algorithm as react-bits/Waves) ───────────────────────

class Grad {
  constructor(public x: number, public y: number, public z: number) {}
  dot2(x: number, y: number) { return this.x * x + this.y * y }
}

class Noise {
  private grad3: Grad[]
  private p: number[]
  private perm: number[]
  private gradP: Grad[]

  constructor(seed = 0) {
    this.grad3 = [
      new Grad(1,1,0), new Grad(-1,1,0), new Grad(1,-1,0), new Grad(-1,-1,0),
      new Grad(1,0,1), new Grad(-1,0,1), new Grad(1,0,-1), new Grad(-1,0,-1),
      new Grad(0,1,1), new Grad(0,-1,1), new Grad(0,1,-1), new Grad(0,-1,-1),
    ]
    this.p = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,
      21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,
      237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,
      111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,
      80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,
      3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,
      17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
      129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,
      238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,
      184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,
      195,78,66,215,61,156,180,
    ]
    this.perm = new Array(512)
    this.gradP = new Array(512)
    this.seed(seed)
  }

  private seed(seed: number) {
    if (seed > 0 && seed < 1) seed *= 65536
    seed = Math.floor(seed)
    if (seed < 256) seed |= seed << 8
    for (let i = 0; i < 256; i++) {
      const v = i & 1 ? this.p[i] ^ (seed & 255) : this.p[i] ^ ((seed >> 8) & 255)
      this.perm[i] = this.perm[i + 256] = v
      this.gradP[i] = this.gradP[i + 256] = this.grad3[v % 12]
    }
  }

  private fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10) }
  private lerp(a: number, b: number, t: number) { return (1 - t) * a + t * b }

  perlin2(x: number, y: number) {
    let X = Math.floor(x), Y = Math.floor(y)
    x -= X; y -= Y; X &= 255; Y &= 255
    const n00 = this.gradP[X + this.perm[Y]].dot2(x, y)
    const n01 = this.gradP[X + this.perm[Y + 1]].dot2(x, y - 1)
    const n10 = this.gradP[X + 1 + this.perm[Y]].dot2(x - 1, y)
    const n11 = this.gradP[X + 1 + this.perm[Y + 1]].dot2(x - 1, y - 1)
    const u = this.fade(x)
    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(y))
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

interface WebPoint {
  bx: number; by: number
  wave: { x: number; y: number }
  shakeMul: number
}

interface StrandDef {
  id: string
  isSpoke: boolean
  si: number
  ri?: number
  nextSi?: number
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function buildGrid(w: number, h: number, spokeCount: number, ringCount: number, spokeMuls: number[]): WebPoint[][] {
  const cx = w / 2, cy = h / 2
  const maxR = Math.min(w, h) * 0.52
  const grid: WebPoint[][] = []
  for (let si = 0; si < spokeCount; si++) {
    const angle = (si / spokeCount) * Math.PI * 2
    const row: WebPoint[] = []
    for (let ri = 0; ri <= ringCount; ri++) {
      const r = (ri / ringCount) * maxR
      const radial = (ri / ringCount) ** 1.4
      row.push({ bx: cx + Math.cos(angle) * r, by: cy + Math.sin(angle) * r, wave: { x: 0, y: 0 }, shakeMul: radial * spokeMuls[si] })
    }
    grid.push(row)
  }
  return grid
}

function buildStrandDefs(spokeCount: number, ringCount: number): StrandDef[] {
  const defs: StrandDef[] = []
  for (let si = 0; si < spokeCount; si++) defs.push({ id: `s${si}`, isSpoke: true, si })
  for (let ri = 1; ri <= ringCount; ri++)
    for (let si = 0; si < spokeCount; si++)
      defs.push({ id: `r${ri}-${si}`, isSpoke: false, si, ri, nextSi: (si + 1) % spokeCount })
  return defs
}

function getPos(grid: WebPoint[][], si: number, ri: number): Pt {
  const p = grid[si]?.[ri]
  if (!p) return { x: 0, y: 0 }
  return { x: p.bx + p.wave.x, y: p.by + p.wave.y }
}

function distToPolyline(px: number, py: number, pts: Pt[]): number {
  let minD = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, ay = pts[i].y, bx = pts[i + 1].x, by = pts[i + 1].y
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
    if (len2 === 0) { minD = Math.min(minD, Math.hypot(px - ax, py - ay)); continue }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
    minD = Math.min(minD, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
  }
  return minD
}

function bezierApprox(p1: Pt, ctrl: Pt, p2: Pt, steps = 10): Pt[] {
  const pts: Pt[] = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, u = 1 - t
    pts.push({ x: u * u * p1.x + 2 * u * t * ctrl.x + t * t * p2.x, y: u * u * p1.y + 2 * u * t * ctrl.y + t * t * p2.y })
  }
  return pts
}

function getRingCtrl(p1: Pt, p2: Pt, cx: number, cy: number, sagFactor: number): Pt {
  const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
  return { x: cx + (mx - cx) * sagFactor, y: cy + (my - cy) * sagFactor }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function traceSpoke(ctx: CanvasRenderingContext2D, grid: WebPoint[][], si: number, ringCount: number, cx: number, cy: number) {
  ctx.moveTo(cx, cy)
  for (let ri = 1; ri <= ringCount; ri++) { const { x, y } = getPos(grid, si, ri); ctx.lineTo(x, y) }
}

function traceArc(ctx: CanvasRenderingContext2D, p1: Pt, ctrl: Pt, p2: Pt) {
  ctx.moveTo(p1.x, p1.y)
  ctx.quadraticCurveTo(ctrl.x, ctrl.y, p2.x, p2.y)
}

// Spider-Verse abrupt glitch palette
const GLITCH_STATES = [
  { color: '#ff2020', alt: '#0047ff' },   // Spider-Man red / blue
  { color: '#ff2020', alt: '#ffffff' },   // red / white flash
  { color: '#0047ff', alt: '#ff2020' },   // blue / red
  { color: '#ffffff', alt: '#ff2020' },   // white flash / red
  { color: '#ffdd00', alt: '#ff2020' },   // Gwen yellow / red
  { color: '#cc44ff', alt: '#ffffff' },   // purple / white
] as const

// ─── Component ────────────────────────────────────────────────────────────────

interface SpiderWebBgProps {
  lineColor?: string
  spokeCount?: number
  ringCount?: number
  waveSpeedX?: number
  waveSpeedY?: number
  waveAmpX?: number
  waveAmpY?: number
  maxCursorMove?: number
  hoverRadius?: number
  vicinityRadius?: number
  style?: React.CSSProperties
  className?: string
}

export default function SpiderWebBg({
  lineColor = 'rgba(255, 255, 255, 0.65)',
  spokeCount = 16,
  ringCount = 12,
  waveSpeedX = 0.0125,
  waveSpeedY = 0.005,
  waveAmpX = 28,
  waveAmpY = 20,
  maxCursorMove = 80,
  hoverRadius = 16,
  vicinityRadius = 90,
  style = {},
  className = '',
}: SpiderWebBgProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameIdRef = useRef<number>(0)
  const gridRef = useRef<WebPoint[][]>([])
  const strandDefsRef = useRef<StrandDef[]>([])
  const spokeMulsRef = useRef<number[]>([])
  const noiseRef = useRef(new Noise(Math.random()))
  const mouseRef = useRef({ x: -10, y: 0, lx: 0, ly: 0, sx: 0, sy: 0, v: 0, vs: 0, a: 0, set: false })
  // Abrupt glitch state: changes every few frames for sharp snapping
  const glitchStateRef = useRef({ idx: 0, countdown: 0 })
  const configRef = useRef({ lineColor, spokeCount, ringCount, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, maxCursorMove, hoverRadius, vicinityRadius })

  useEffect(() => {
    configRef.current = { lineColor, spokeCount, ringCount, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, maxCursorMove, hoverRadius, vicinityRadius }
  }, [lineColor, spokeCount, ringCount, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, maxCursorMove, hoverRadius, vicinityRadius])

  useEffect(() => {
    const canvas = canvasRef.current!
    const container = containerRef.current!
    const ctx = canvas.getContext('2d')!

    // Initialise spoke multipliers once; rebuild grid on every resize
    function initMuls() {
      const { spokeCount } = configRef.current
      spokeMulsRef.current = Array.from({ length: spokeCount }, () =>
        Math.random() < 0.33 ? 0.08 + Math.random() * 0.12
          : Math.random() < 0.5 ? 0.3 + Math.random() * 0.3
          : 0.65 + Math.random() * 0.35
      )
      strandDefsRef.current = buildStrandDefs(spokeCount, configRef.current.ringCount)
    }

    function rebuildGrid() {
      const { spokeCount, ringCount } = configRef.current
      gridRef.current = buildGrid(canvas.width, canvas.height, spokeCount, ringCount, spokeMulsRef.current)
    }

    // ResizeObserver keeps canvas pixel buffer in sync with the growing portal circle
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      rebuildGrid()
    })
    ro.observe(container)

    initMuls()
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    rebuildGrid()

    // ── Physics ───────────────────────────────────────────────────────────────

    function movePoints(time: number) {
      const { spokeCount, ringCount, waveSpeedX, waveSpeedY, waveAmpX, waveAmpY, maxCursorMove } = configRef.current
      const noise = noiseRef.current
      const mouse = mouseRef.current
      const grid = gridRef.current

      for (let si = 0; si < spokeCount; si++) {
        for (let ri = 0; ri <= ringCount; ri++) {
          const p = grid[si]?.[ri]
          if (!p || p.shakeMul === 0) continue
          const noiseVal = noise.perlin2((p.bx + time * waveSpeedX) * 0.002, (p.by + time * waveSpeedY) * 0.0015) * 12
          p.wave.x = Math.cos(noiseVal) * waveAmpX * p.shakeMul
          p.wave.y = Math.sin(noiseVal) * waveAmpY * p.shakeMul
          const dx = p.bx - mouse.sx, dy = p.by - mouse.sy
          const dist = Math.hypot(dx, dy), l = Math.max(175, mouse.vs)
          if (dist < l) {
            const s = 1 - dist / l
            const f = Math.cos(dist * 0.001) * s
            p.wave.x += Math.cos(mouse.a) * f * l * mouse.vs * 0.00065 * p.shakeMul
            p.wave.y += Math.sin(mouse.a) * f * l * mouse.vs * 0.00065 * p.shakeMul
          }
          p.wave.x = Math.max(-maxCursorMove, Math.min(maxCursorMove, p.wave.x))
          p.wave.y = Math.max(-maxCursorMove, Math.min(maxCursorMove, p.wave.y))
        }
      }
    }

    // ── Strand render helpers ─────────────────────────────────────────────────

    function getStrandGeom(def: StrandDef, cx: number, cy: number, ringCount: number) {
      const grid = gridRef.current
      if (def.isSpoke) {
        const approx: Pt[] = [{ x: cx, y: cy }]
        for (let ri = 1; ri <= ringCount; ri++) approx.push(getPos(grid, def.si, ri))
        return { approx, p1: null as Pt | null, p2: null as Pt | null, ctrl: null as Pt | null }
      } else {
        const sagFactor = 0.93 - (def.ri! / ringCount) * 0.04
        const p1 = getPos(grid, def.si, def.ri!)
        const p2 = getPos(grid, def.nextSi!, def.ri!)
        const ctrl = getRingCtrl(p1, p2, cx, cy, sagFactor)
        return { approx: bezierApprox(p1, ctrl, p2, 8), p1, p2, ctrl }
      }
    }

    function strokeStrand(def: StrandDef, cx: number, cy: number, ringCount: number, dx = 0, dy = 0) {
      const grid = gridRef.current
      ctx.beginPath()
      if (def.isSpoke) {
        ctx.save(); ctx.translate(dx, dy)
        traceSpoke(ctx, grid, def.si, ringCount, cx + dx, cy + dy)
        ctx.restore()
      } else {
        const sagFactor = 0.93 - (def.ri! / ringCount) * 0.04
        const p1 = getPos(grid, def.si, def.ri!)
        const p2 = getPos(grid, def.nextSi!, def.ri!)
        const ctrl = getRingCtrl(p1, p2, cx, cy, sagFactor)
        ctx.save(); ctx.translate(dx, dy)
        traceArc(ctx, p1, ctrl, p2)
        ctx.restore()
      }
      ctx.stroke()
    }

    // ─ Spider-Verse glitch render ─────────────────────────────────────────────
    function drawPrimary(def: StrandDef, cx: number, cy: number, ringCount: number) {
      const gs = glitchStateRef.current
      const palette = GLITCH_STATES[gs.idx]
      const isDropout = gs.countdown === 1 && Math.random() < 0.2

      if (isDropout) return  // strand blinks out completely for one frame

      // Thick base in current glitch color
      ctx.strokeStyle = palette.color
      ctx.lineWidth = 3.5
      strokeStrand(def, cx, cy, ringCount)

      // RGB split — sharp, large offsets (Spider-Verse chromatic aberration)
      const ox = 6 + Math.random() * 5
      const oy = (Math.random() - 0.5) * 4

      ctx.strokeStyle = palette.alt + 'cc'
      ctx.lineWidth = 2
      strokeStrand(def, cx, cy, ringCount, ox, oy)

      ctx.strokeStyle = palette.color + 'cc'
      ctx.lineWidth = 2
      strokeStrand(def, cx, cy, ringCount, -ox * 1.2, -oy)

      // Bright white flash overlay on top
      if (Math.random() < 0.55) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'
        ctx.lineWidth = 1
        strokeStrand(def, cx, cy, ringCount)
      }

      // Glow: draw blurred copy underneath using filter
      ctx.filter = `blur(4px)`
      ctx.strokeStyle = palette.color + '88'
      ctx.lineWidth = 8
      strokeStrand(def, cx, cy, ringCount)
      ctx.filter = 'none'
    }

    function drawVicinity(def: StrandDef, cx: number, cy: number, ringCount: number, falloff: number) {
      const palette = GLITCH_STATES[glitchStateRef.current.idx]
      // Subtle tint toward the active glitch color, stronger the closer we are
      const alpha = Math.round(falloff * 200).toString(16).padStart(2, '0')

      ctx.filter = `blur(2px)`
      ctx.strokeStyle = palette.color + alpha
      ctx.lineWidth = 3
      strokeStrand(def, cx, cy, ringCount)
      ctx.filter = 'none'

      // Solid slightly-brighter base on top
      ctx.strokeStyle = `rgba(255,255,255,${0.7 + falloff * 0.25})`
      ctx.lineWidth = 2
      strokeStrand(def, cx, cy, ringCount)
    }

    // ── Main loop ─────────────────────────────────────────────────────────────

    function tick(t: number) {
      const { lineColor, ringCount, hoverRadius, vicinityRadius } = configRef.current
      const mouse = mouseRef.current
      const w = canvas.width, h = canvas.height
      const cx = w / 2, cy = h / 2

      // Smoothed mouse + velocity (from react-bits/Waves)
      mouse.sx += (mouse.x - mouse.sx) * 0.1
      mouse.sy += (mouse.y - mouse.sy) * 0.1
      const mdx = mouse.x - mouse.lx, mdy = mouse.y - mouse.ly
      const spd = Math.hypot(mdx, mdy)
      mouse.vs += (spd - mouse.vs) * 0.1
      mouse.vs = Math.min(100, mouse.vs)
      mouse.lx = mouse.x; mouse.ly = mouse.y
      mouse.a = Math.atan2(mdy, mdx)

      // Advance abrupt glitch state — snaps to a new color every 4-12 frames
      const gs = glitchStateRef.current
      if (gs.countdown <= 0) {
        gs.idx = Math.floor(Math.random() * GLITCH_STATES.length)
        gs.countdown = 4 + Math.floor(Math.random() * 8)
      }
      gs.countdown--

      movePoints(t)

      // Classify strands by distance from mouse
      const strandDists = new Map<string, number>()
      for (const def of strandDefsRef.current) {
        const { approx } = getStrandGeom(def, cx, cy, ringCount)
        strandDists.set(def.id, distToPolyline(mouse.x, mouse.y, approx))
      }

      // Find primary (closest within hoverRadius)
      let primaryId: string | null = null
      let primaryDist = Infinity
      for (const [id, d] of strandDists) {
        if (d < primaryDist) { primaryDist = d; if (d < hoverRadius) primaryId = id }
      }

      ctx.clearRect(0, 0, w, h)

      // Draw all strands — normal first, then vicinity, then primary on top
      for (const def of strandDefsRef.current) {
        const dist = strandDists.get(def.id) ?? Infinity
        if (def.id === primaryId) continue  // drawn last

        if (dist < vicinityRadius) {
          const falloff = Math.max(0, 1 - (dist - hoverRadius) / (vicinityRadius - hoverRadius))
          if (falloff > 0.02) {
            drawVicinity(def, cx, cy, ringCount, falloff)
            continue
          }
        }

        // Normal static strand
        ctx.beginPath()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 2
        if (def.isSpoke) {
          traceSpoke(ctx, gridRef.current, def.si, ringCount, cx, cy)
        } else {
          const sagFactor = 0.93 - (def.ri! / ringCount) * 0.04
          const p1 = getPos(gridRef.current, def.si, def.ri!)
          const p2 = getPos(gridRef.current, def.nextSi!, def.ri!)
          traceArc(ctx, p1, getRingCtrl(p1, p2, cx, cy, sagFactor), p2)
        }
        ctx.stroke()
      }

      // Draw primary on top
      if (primaryId) {
        const def = strandDefsRef.current.find(d => d.id === primaryId)!
        drawPrimary(def, cx, cy, ringCount)
      }

      frameIdRef.current = requestAnimationFrame(tick)
    }

    function onMouseMove(e: MouseEvent) {
      const b = container.getBoundingClientRect()
      const m = mouseRef.current
      m.x = e.clientX - b.left; m.y = e.clientY - b.top
      if (!m.set) { m.sx = m.x; m.sy = m.y; m.lx = m.x; m.ly = m.y; m.set = true }
    }
    function onMouseLeave() {
      const m = mouseRef.current
      m.x = -10; m.y = 0; m.vs = 0; m.set = false
    }

    frameIdRef.current = requestAnimationFrame(tick)
    window.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(frameIdRef.current)
      window.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...style }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
