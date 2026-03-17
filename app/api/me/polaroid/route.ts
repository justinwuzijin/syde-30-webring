import { NextResponse } from 'next/server'
import heicConvert from 'heic-convert'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAuthToken } from '@/lib/token'

const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = verifyAuthToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const formData = await request.formData()
  const polaroidStill = formData.get('polaroidStill') as File | null
  const polaroidLive = formData.get('polaroidLive') as File | null

  if (!polaroidStill && !polaroidLive) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  let polaroid_still_url: string | undefined
  let polaroid_live_url: string | undefined
  let uploadedStillPath: string | null = null
  let uploadedLivePath: string | null = null

  try {
    // ── Still image (optional) ──
    if (polaroidStill && polaroidStill instanceof File && polaroidStill.size > 0) {
      const stillExtRaw = polaroidStill.name.split('.').pop()?.toLowerCase() || 'jpg'
      const allowedStill = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
      if (!allowedStill.includes(stillExtRaw)) {
        return NextResponse.json(
          { errors: { polaroidStill: 'Invalid format — please use JPG, PNG, or HEIC' } },
          { status: 400 }
        )
      }

      const isHeic = ['heic', 'heif'].includes(stillExtRaw)
      let stillUploadData: Blob | Buffer = polaroidStill
      let stillContentType = polaroidStill.type
      let stillExt = stillExtRaw
      if (isHeic) {
        const inputBuffer = await polaroidStill.arrayBuffer()
        const jpegBuffer = await heicConvert({
          buffer: inputBuffer as ArrayBuffer,
          format: 'JPEG',
          quality: 0.9,
        })
        stillUploadData = Buffer.from(jpegBuffer)
        stillContentType = 'image/jpeg'
        stillExt = 'jpg'
      }
      const stillFileName = `${Date.now()}-still-${Math.random().toString(36).slice(2)}.${stillExt}`
      const { data: stillUpload, error: stillErr } = await supabaseAdmin.storage
        .from('profile-website-pictures')
        .upload(stillFileName, stillUploadData, { contentType: stillContentType, upsert: false })
      if (stillErr) {
        return NextResponse.json(
          { errors: { polaroidStill: 'Failed to upload still image' } },
          { status: 500 }
        )
      }
      uploadedStillPath = stillUpload.path
      const { data: stillUrlData } = supabaseAdmin.storage
        .from('profile-website-pictures')
        .getPublicUrl(stillUpload.path)
      polaroid_still_url = stillUrlData.publicUrl
    }

    // ── Live clip (optional) ──
    if (polaroidLive && polaroidLive instanceof File && polaroidLive.size > 0) {
      if (polaroidLive.size > MAX_VIDEO_BYTES) {
        return NextResponse.json(
          { errors: { polaroidLive: 'Video is too large (max 50MB). Try a shorter clip.' } },
          { status: 400 }
        )
      }
      const liveExtRaw = polaroidLive.name.split('.').pop()?.toLowerCase() || 'mov'
      const allowedLive = ['mov', 'mp4']
      if (!allowedLive.includes(liveExtRaw)) {
        return NextResponse.json(
          { errors: { polaroidLive: 'Invalid live clip format (use MOV or MP4)' } },
          { status: 400 }
        )
      }

      const liveFileName = `${Date.now()}-live-${Math.random()
        .toString(36)
        .slice(2)}.${liveExtRaw}`
      const { data: liveUpload, error: liveErr } = await supabaseAdmin.storage
        .from('profile-website-pictures')
        .upload(liveFileName, polaroidLive, {
          contentType: polaroidLive.type,
          upsert: false,
        })
      if (liveErr) {
        if (uploadedStillPath) {
          await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath])
        }
        const msg =
          liveErr.message?.includes('Payload too large') ||
          liveErr.message?.includes('Entity too large')
            ? 'Video file is too large (max 50MB). Try a shorter clip.'
            : `Failed to upload live clip: ${liveErr.message || 'Unknown error'}`
        return NextResponse.json({ errors: { polaroidLive: msg } }, { status: 500 })
      }
      if (!liveUpload?.path) {
        if (uploadedStillPath) {
          await supabaseAdmin.storage.from('profile-website-pictures').remove([uploadedStillPath])
        }
        return NextResponse.json(
          { errors: { polaroidLive: 'Upload succeeded but no path returned' } },
          { status: 500 }
        )
      }
      uploadedLivePath = liveUpload.path
      const { data: liveUrlData } = supabaseAdmin.storage
        .from('profile-website-pictures')
        .getPublicUrl(liveUpload.path)
      polaroid_live_url = liveUrlData.publicUrl
    }

    return NextResponse.json({ polaroid_still_url, polaroid_live_url })
  } catch (err) {
    console.error('Me polaroid upload error:', err)
    if (uploadedStillPath || uploadedLivePath) {
      await supabaseAdmin.storage
        .from('profile-website-pictures')
        .remove([uploadedStillPath, uploadedLivePath].filter(Boolean) as string[])
    }
    return NextResponse.json({ error: 'Failed to upload media' }, { status: 500 })
  }
}

