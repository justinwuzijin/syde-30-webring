'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

const MAX_CLIP_SECONDS = 3.0
const MAX_DIMENSION = 1080
// Temporary safety switch:
// ffmpeg.wasm is currently crashing with "memory access out of bounds" on some inputs.
// We keep the duration policy checks, but skip actual transcoding/audio-stripping for now.
// Next pass can re-enable transcoding once we add a more robust pipeline.
const ENABLE_FFMPEG_TRANSCODE = false

let ffmpeg: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

async function getFfmpeg(): Promise<FFmpeg> {
  if (!ENABLE_FFMPEG_TRANSCODE) {
    throw new Error('Live clip transcoding is temporarily disabled due to processing instability.')
  }
  if (ffmpeg) return ffmpeg
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const instance = new FFmpeg()
      // Use ffmpeg-wasm's built-in static CORE_URL/wasm resolution.
      // This avoids Next/webpack issues with dynamically provided module URLs
      // ("expression is too dynamic") inside the worker.
      await instance.load()
      ffmpeg = instance
      return instance
    })()
  }
  return ffmpegLoadPromise
}

async function getVideoDurationSeconds(file: File): Promise<number> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      URL.revokeObjectURL(url)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to read video metadata'))
    }
    video.src = url
  })
}

export async function enforceLiveClipPolicy(inputFile: File): Promise<File> {
  const duration = await getVideoDurationSeconds(inputFile)
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Could not read video duration. Please choose a different file.')
  }
  if (duration > MAX_CLIP_SECONDS) {
    throw new Error('Live clip must be 3.0 seconds or shorter.')
  }

  if (!ENABLE_FFMPEG_TRANSCODE) {
    // Cost-safe interim behavior:
    // validate duration only, then upload original file.
    // This keeps the direct-to-S3 upload architecture unchanged.
    return inputFile
  }

  const engine = await getFfmpeg()
  const inName = `in-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const outName = `out-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`

  await engine.writeFile(inName, await fetchFile(inputFile))
  try {
    // Strict policy:
    // - hard max duration 3.0s
    // - remove all audio tracks
    // - preserve quality up to 1080p (never upscale)
    // - consistent web-safe output (WebM VP9)
    await engine.exec([
      '-i',
      inName,
      '-t',
      String(MAX_CLIP_SECONDS),
      '-an',
      '-vf',
      `scale='if(gte(iw,ih),min(iw,${MAX_DIMENSION}),-2)':'if(gte(ih,iw),min(ih,${MAX_DIMENSION}),-2)'`,
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '31',
      '-b:v',
      '0',
      '-deadline',
      'good',
      '-row-mt',
      '1',
      outName,
    ])

    const out = await engine.readFile(outName)
    const blob = new Blob([out], { type: 'video/webm' })
    const baseName = inputFile.name.replace(/\.[^.]+$/, '') || 'live-clip'
    return new File([blob], `${baseName}.webm`, { type: 'video/webm' })
  } catch (err) {
    const detail = err instanceof Error ? err.message : typeof err === 'string' ? err : 'unknown ffmpeg error'
    throw new Error(`Live clip processing failed: ${detail}`)
  } finally {
    await engine.deleteFile(inName).catch(() => {})
    await engine.deleteFile(outName).catch(() => {})
  }
}

