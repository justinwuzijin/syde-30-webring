'use client'

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const MAX_CLIP_SECONDS = 3.0
const MAX_DIMENSION = 1080

let ffmpeg: FFmpeg | null = null
let ffmpegLoadPromise: Promise<FFmpeg> | null = null

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  if (!ffmpegLoadPromise) {
    ffmpegLoadPromise = (async () => {
      const instance = new FFmpeg()
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await instance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
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
      `scale='if(gt(iw,${MAX_DIMENSION}),${MAX_DIMENSION},iw)':'if(gt(ih,${MAX_DIMENSION}),${MAX_DIMENSION},ih)':force_original_aspect_ratio=decrease`,
      '-c:v',
      'libvpx-vp9',
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
  } finally {
    await engine.deleteFile(inName).catch(() => {})
    await engine.deleteFile(outName).catch(() => {})
  }
}

