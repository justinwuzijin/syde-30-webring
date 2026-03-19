import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  buildLiveKey,
  buildStillPath,
  pendingMemberIdFromEmail,
  s3PublicUrlFromKey,
  SUPABASE_STILL_BUCKET,
} from '@/lib/media-storage'
import { createLiveClipPresignedPutUrl } from '@/lib/s3'

const STILL_ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const
const LIVE_ALLOWED = ['mov', 'mp4', 'webm'] as const
const MAX_STILL_BYTES = 25 * 1024 * 1024 // 25MB
const MAX_LIVE_BYTES = 50 * 1024 * 1024 // 50MB

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        email?: string
        kind?: 'still' | 'live'
        fileName?: string
        contentType?: string
        size?: number
      }
    | null

  if (!body || !body.email || !body.kind || !body.fileName || typeof body.size !== 'number') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please provide a valid email first' }, { status: 400 })
  }

  const extRaw = body.fileName.split('.').pop()?.toLowerCase() || ''
  if (body.kind === 'still') {
    if (!STILL_ALLOWED.includes(extRaw as (typeof STILL_ALLOWED)[number])) {
      return NextResponse.json(
        { error: 'Invalid still image format (use JPG, PNG, WEBP, or HEIC/HEIF)' },
        { status: 400 }
      )
    }
    if (body.size > MAX_STILL_BYTES) {
      return NextResponse.json({ error: 'Still image is too large (max 25MB).' }, { status: 400 })
    }
  } else {
    if (!LIVE_ALLOWED.includes(extRaw as (typeof LIVE_ALLOWED)[number])) {
      return NextResponse.json({ error: 'Invalid live clip format (use MOV or MP4)' }, { status: 400 })
    }
    if (body.size > MAX_LIVE_BYTES) {
      return NextResponse.json({ error: 'Video is too large (max 50MB).' }, { status: 400 })
    }
  }

  const memberId = pendingMemberIdFromEmail(email)

  if (body.kind === 'still') {
    const supabase = getSupabaseAdmin()
    const path = buildStillPath(memberId, body.fileName)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(SUPABASE_STILL_BUCKET)
      .createSignedUploadUrl(path, { upsert: false } as any)
    if (signedErr || !signedData) {
      return NextResponse.json({ error: 'Failed to create signed upload URL' }, { status: 500 })
    }
    const publicUrl = supabase.storage.from(SUPABASE_STILL_BUCKET).getPublicUrl(path).data.publicUrl
    return NextResponse.json({
      provider: 'supabase',
      path: signedData.path || path,
      token: signedData.token,
      signedUrl: signedData.signedUrl,
      publicUrl,
    })
  }

  const key = buildLiveKey(memberId, body.fileName)
  const putUrl = await createLiveClipPresignedPutUrl({ key, contentType: body.contentType || 'video/webm' })
  return NextResponse.json({
    provider: 's3',
    key,
    putUrl,
    publicUrl: s3PublicUrlFromKey(key),
  })
}

