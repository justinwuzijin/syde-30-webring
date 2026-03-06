'use client'

import { useEffect, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaultyTerminalProps {
  scale?: number
  gridMul?: [number, number]
  digitSize?: number
  timeScale?: number
  pause?: boolean
  scanlineIntensity?: number
  glitchAmount?: number
  flickerAmount?: number
  noiseAmp?: number
  chromaticAberration?: number
  dither?: number
  curvature?: number
  tint?: string
  mouseReact?: boolean
  mouseStrength?: number
  pageLoadAnimation?: boolean
  brightness?: number
  className?: string
}

// ─── Hex → [r, g, b] (0–1) ───────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [0.655, 0.937, 0.62]
}

// ─── Shaders ─────────────────────────────────────────────────────────────────

const vert = /* glsl */ `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// 3×5 bitmap font for digits 0–9.
// Bit index = row * 3 + col  (row 0 = bottom, row 4 = top)
// Value = Σ 2^bitIndex for every lit pixel.
//
//  0=11114  1=9879  2=31119  3=31207  4=23524
//  5=29671  6=29679  7=30994  8=31727  9=31719

const frag = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform vec2  uMouse;
uniform float uScale;
uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform float uMouseStrength;
uniform float uBrightness;
uniform float uLoadProgress;

varying vec2 vUv;

// ---- Hash / noise ----------------------------------------------------------
float hash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash1(float p) {
  return fract(sin(p * 127.1) * 43758.5453);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i+vec2(1,0)), u.x),
             mix(hash2(i+vec2(0,1)), hash2(i+vec2(1,1)), u.x), u.y);
}

// ---- CRT barrel distortion ------------------------------------------------
vec2 barrel(vec2 uv, float k) {
  uv = uv * 2.0 - 1.0;
  uv *= 1.0 + k * dot(uv, uv) * 0.25;
  return uv * 0.5 + 0.5;
}

// ---- 3×5 digit bitmaps -----------------------------------------------------
float getDigitBitmap(float d) {
  if (d < 0.5) return 11114.0;
  if (d < 1.5) return  9879.0;
  if (d < 2.5) return 31119.0;
  if (d < 3.5) return 31207.0;
  if (d < 4.5) return 23524.0;
  if (d < 5.5) return 29671.0;
  if (d < 6.5) return 29679.0;
  if (d < 7.5) return 30994.0;
  if (d < 8.5) return 31727.0;
  return 31719.0;
}

// p in [0,1]² within the character cell; row 4 = top of screen
float sampleDigit(float bitmap, vec2 p) {
  if (p.x < 0.0 || p.x >= 1.0 || p.y < 0.0 || p.y >= 1.0) return 0.0;
  vec2 pi  = floor(p * vec2(3.0, 5.0));
  float bit = (4.0 - pi.y) * 3.0 + pi.x;
  return floor(mod(bitmap / exp2(bit), 2.0));
}

// Phosphor glow: hard pixel + soft falloff at pixel edges
float sampleDigitGlow(float bitmap, vec2 p) {
  float hard = sampleDigit(bitmap, p);
  // sub-pixel position within the character pixel (0=center, 1=edge)
  vec2 sp = fract(p * vec2(3.0, 5.0));
  float edgeDist = max(abs(sp.x - 0.5), abs(sp.y - 0.5)) * 2.0;
  float glow = hard * (1.0 - edgeDist * 0.25);
  // soft halo from adjacent pixels
  float step3 = 1.0 / 3.0;
  float step5 = 1.0 / 5.0;
  float neighbours =
    sampleDigit(bitmap, p + vec2( step3,  0)) +
    sampleDigit(bitmap, p + vec2(-step3,  0)) +
    sampleDigit(bitmap, p + vec2( 0,  step5)) +
    sampleDigit(bitmap, p + vec2( 0, -step5));
  return clamp(glow + neighbours * 0.08, 0.0, 1.0);
}

// ---- Full grid sample (used per colour channel) ----------------------------
float sampleGrid(vec2 uvSample) {
  // cells: larger scale → fewer cells (bigger chars)
  vec2 gridRes = uResolution / (14.0 * uScale) * uGridMul;
  vec2 gridUV  = uvSample * gridRes;
  vec2 cellIdx = floor(gridUV);
  vec2 cellUV  = fract(gridUV);

  // digit changes over time (snaps every ~0.5 s at timeScale=1)
  float t        = floor(uTime * 2.0);
  float digitIdx = floor(hash2(cellIdx + vec2(t * 0.11, t * 0.19 + 0.3)) * 10.0);
  float bitmap   = getDigitBitmap(digitIdx);

  // centre digit in cell with digitSize scaling
  float margin  = (1.0 - uDigitSize) * 0.5;
  vec2 digitUV  = (cellUV - margin) / uDigitSize;
  float px      = sampleDigitGlow(bitmap, digitUV);

  // per-cell activity: some cells are bright, some dim, some dark
  float activity = hash2(cellIdx * 3.71);
  float flkT     = floor(uTime * 3.0);
  float flicker  = hash2(vec2(activity * 11.3, flkT));
  float cellBrt  = step(0.22, activity) * (0.15 + flicker * 0.85);

  // noise amplitude modulates additional brightness
  float noiseB = vnoise(cellIdx * 0.4 + uTime * 0.15) * uNoiseAmp * 0.3;

  return px * clamp(cellBrt + noiseB, 0.0, 1.0);
}

void main() {
  // --- Barrel distortion ---
  vec2 uv = barrel(vUv, uCurvature * 0.5);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // --- Mouse parallax ---
  vec2 mouseShift = (uMouse - 0.5) * uMouseStrength * 0.018;
  uv = clamp(uv + mouseShift, 0.0, 1.0);

  // --- Chromatic aberration ---
  float caAmt  = uChromaticAberration * 0.005;
  vec2  caAxis = normalize(uv - 0.5 + 0.0001) * caAmt;
  vec2  uvR    = clamp(uv + caAxis, 0.0, 1.0);
  vec2  uvG    = uv;
  vec2  uvB    = clamp(uv - caAxis, 0.0, 1.0);

  // --- Glitch: horizontal row displacement ---
  float gTime   = floor(uTime * 5.0);
  float gRow    = floor(uv.y * 80.0);
  float isGlitch = step(1.0 - uGlitchAmount * 0.045, hash2(vec2(gRow, gTime)));
  float gDx     = (hash2(vec2(gTime * 2.9, gRow)) - 0.5) * 0.03 * isGlitch * uGlitchAmount;
  uvR.x = clamp(uvR.x + gDx, 0.0, 1.0);
  uvG.x = clamp(uvG.x + gDx, 0.0, 1.0);
  uvB.x = clamp(uvB.x + gDx, 0.0, 1.0);

  // --- Sample digit grid per channel ---
  float r = sampleGrid(uvR);
  float g = sampleGrid(uvG);
  float b = sampleGrid(uvB);
  vec3  col = vec3(r, g, b) * uTint;

  // --- Scanlines ---
  float scanline = sin(uvG.y * uResolution.y * 1.3) * 0.5 + 0.5;
  float scanMask = 1.0 - scanline * uScanlineIntensity * 0.65;

  // --- Global flicker ---
  float flickerT   = floor(uTime * 12.0);
  float flickerVal = 1.0 - hash1(flickerT) * uFlickerAmount * 0.07;

  // --- Noise overlay ---
  float noiseOvl = vnoise(uvG * uResolution * 0.004 + uTime * 0.4) * uNoiseAmp * 0.06;
  col += noiseOvl * uTint;

  // --- Vignette ---
  vec2  vigUV = uvG * (1.0 - uvG);
  float vig   = clamp(pow(vigUV.x * vigUV.y * 16.0, 0.38), 0.0, 1.0);

  // --- Dither ---
  float ditherNoise = hash2(floor(gl_FragCoord.xy / 2.0)) - 0.5;
  float ditherVal   = ditherNoise * uDither * 0.04;

  // --- Compose ---
  col  = clamp(col, 0.0, 1.0);
  col *= uBrightness * scanMask * flickerVal * vig;
  col  = clamp(col + ditherVal, 0.0, 1.0);
  col *= uLoadProgress;

  gl_FragColor = vec4(col, 1.0);
}
`

// ─── Component ───────────────────────────────────────────────────────────────

export default function FaultyTerminal({
  scale              = 1.0,
  gridMul            = [1, 1],
  digitSize          = 1.0,
  timeScale          = 1.0,
  pause              = false,
  scanlineIntensity  = 0.5,
  glitchAmount       = 1.0,
  flickerAmount      = 1.0,
  noiseAmp           = 1.0,
  chromaticAberration = 0,
  dither             = 0,
  curvature          = 0.1,
  tint               = '#A7EF9E',
  mouseReact         = false,
  mouseStrength      = 0.5,
  pageLoadAnimation  = false,
  brightness         = 0.6,
  className          = '',
}: FaultyTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep latest props accessible inside the RAF loop without re-creating the effect
  const propsRef = useRef({
    scale, gridMul, digitSize, timeScale, pause,
    scanlineIntensity, glitchAmount, flickerAmount, noiseAmp,
    chromaticAberration, dither, curvature, tint, mouseReact,
    mouseStrength, pageLoadAnimation, brightness,
  })
  propsRef.current = {
    scale, gridMul, digitSize, timeScale, pause,
    scanlineIntensity, glitchAmount, flickerAmount, noiseAmp,
    chromaticAberration, dither, curvature, tint, mouseReact,
    mouseStrength, pageLoadAnimation, brightness,
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled   = false
    let animId      = 0
    let cleanupFn   = () => {}

    let mouseX = 0.5, mouseY = 0.5
    let targetX = 0.5, targetY = 0.5
    let pausedTime  = 0
    let lastNow     = 0
    let loadProgress = pageLoadAnimation ? 0 : 1

    const onMouseMove = (e: MouseEvent) => {
      if (!propsRef.current.mouseReact) return
      targetX = e.clientX / window.innerWidth
      targetY = 1.0 - e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })

    const init = async () => {
      const { Renderer, Program, Mesh, Triangle } = await import('ogl')
      if (cancelled) return

      const renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio, 1.5) })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 1)

      const canvas = gl.canvas as HTMLCanvasElement
      Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
      container.appendChild(canvas)

      const geometry = new Triangle(gl)
      const p = propsRef.current

      const program = new Program(gl, {
        vertex: vert,
        fragment: frag,
        uniforms: {
          uTime:                { value: 0 },
          uResolution:          { value: [container.clientWidth, container.clientHeight] },
          uMouse:               { value: [0.5, 0.5] },
          uScale:               { value: p.scale },
          uGridMul:             { value: p.gridMul },
          uDigitSize:           { value: p.digitSize },
          uScanlineIntensity:   { value: p.scanlineIntensity },
          uGlitchAmount:        { value: p.glitchAmount },
          uFlickerAmount:       { value: p.flickerAmount },
          uNoiseAmp:            { value: p.noiseAmp },
          uChromaticAberration: { value: p.chromaticAberration },
          uDither:              { value: p.dither },
          uCurvature:           { value: p.curvature },
          uTint:                { value: hexToRgb(p.tint) },
          uMouseStrength:       { value: p.mouseStrength },
          uBrightness:          { value: p.brightness },
          uLoadProgress:        { value: loadProgress },
        },
      })

      const mesh = new Mesh(gl, { geometry, program })

      const resize = () => {
        renderer.setSize(container.clientWidth, container.clientHeight)
        program.uniforms.uResolution.value = [container.clientWidth, container.clientHeight]
      }
      const ro = new ResizeObserver(resize)
      ro.observe(container)
      resize()

      const render = (now: number) => {
        if (cancelled) return
        const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 0
        lastNow = now

        mouseX += (targetX - mouseX) * 0.06
        mouseY += (targetY - mouseY) * 0.06

        const cp = propsRef.current
        if (!cp.pause) pausedTime += dt * cp.timeScale

        if (cp.pageLoadAnimation) loadProgress = Math.min(loadProgress + dt * 0.7, 1)
        else loadProgress = 1

        program.uniforms.uTime.value                = pausedTime
        program.uniforms.uMouse.value               = [mouseX, mouseY]
        program.uniforms.uScale.value               = cp.scale
        program.uniforms.uGridMul.value             = cp.gridMul
        program.uniforms.uDigitSize.value           = cp.digitSize
        program.uniforms.uScanlineIntensity.value   = cp.scanlineIntensity
        program.uniforms.uGlitchAmount.value        = cp.glitchAmount
        program.uniforms.uFlickerAmount.value       = cp.flickerAmount
        program.uniforms.uNoiseAmp.value            = cp.noiseAmp
        program.uniforms.uChromaticAberration.value = cp.chromaticAberration
        program.uniforms.uDither.value              = cp.dither
        program.uniforms.uCurvature.value           = cp.curvature
        program.uniforms.uTint.value                = hexToRgb(cp.tint)
        program.uniforms.uMouseStrength.value       = cp.mouseStrength
        program.uniforms.uBrightness.value          = cp.brightness
        program.uniforms.uLoadProgress.value        = loadProgress

        renderer.render({ scene: mesh })
        animId = requestAnimationFrame(render)
      }
      animId = requestAnimationFrame(render)

      cleanupFn = () => {
        cancelAnimationFrame(animId)
        ro.disconnect()
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
        ;(gl.getExtension('WEBGL_lose_context') as WEBGL_lose_context | null)?.loseContext()
      }
    }

    init()

    return () => {
      cancelled = true
      window.removeEventListener('mousemove', onMouseMove)
      cleanupFn()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      className={`faulty-terminal-container ${className}`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}
