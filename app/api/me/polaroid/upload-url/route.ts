import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyAuthToken } from '@/lib/token'
import { buildLiveKey, buildStillPath, s3PublicUrlFromKey, SUPABASE_STILL_BUCKET } from '@/lib/media-storage'
import { createLiveClipPresignedPutUrl } from '@/lib/s3'

const STILL_ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'] as const
const LIVE_ALLOWED = ['mov', 'mp4', 'webm'] as const
const MAX_LIVE_BYTES = 50 * 1024 * 1024 // 50MB

function getAuthUser(request: Request) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return verifyAuthToken(token)
}

export async function POST(request: Request) {
  const authUser = getAuthUser(request)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | { kind?: 'still' | 'live'; fileName?: string; contentType?: string; size?: number }
    | null

  if (!body || !body.kind || !body.fileName || typeof body.size !== 'number') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const extRaw = body.fileName.split('.').pop()?.toLowerCase() || ''
  const size = body.size
  const kind = body.kind

  if (kind === 'live') {
    if (size > MAX_LIVE_BYTES) {
      return NextResponse.json(
        { error: 'Video is too large (max 50MB). Try a shorter clip.' },
        { status: 400 }
      )
    }
    if (!LIVE_ALLOWED.includes(extRaw as (typeof LIVE_ALLOWED)[number])) {
      return NextResponse.json({ error: 'Invalid live clip format (use MOV or MP4)' }, { status: 400 })
    }
  } else {
    if (!STILL_ALLOWED.includes(extRaw as (typeof STILL_ALLOWED)[number])) {
      return NextResponse.json(
        { error: 'Invalid still image format (use JPG, PNG, WEBP, or HEIC/HEIF)' },
        { status: 400 }
      )
    }
  }

  const supabase = getSupabaseAdmin()

  if (kind === 'still') {
    const stillPath = buildStillPath(authUser.id, body.fileName)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(SUPABASE_STILL_BUCKET)
      // storage-js supports `upsert` for signed URLs; for our use case we don't want overwrites.
      .createSignedUploadUrl(stillPath, { upsert: false } as any)

    if (signedErr || !signedData) {
      return NextResponse.json({ error: 'Failed to create signed upload URL' }, { status: 500 })
    }

    const publicUrl = supabase.storage.from(SUPABASE_STILL_BUCKET).getPublicUrl(stillPath).data.publicUrl

    return NextResponse.json({
      provider: 'supabase',
      path: signedData.path || stillPath,
      token: signedData.token,
      signedUrl: signedData.signedUrl,
      publicUrl,
    })
  }

  // Live clips go to S3 directly with presigned PUT URL.
  const key = buildLiveKey(authUser.id, body.fileName)
  const putUrl = await createLiveClipPresignedPutUrl({ key, contentType: body.contentType || 'video/webm' })
  return NextResponse.json({
    provider: 's3',
    key,
    putUrl,
    publicUrl: s3PublicUrlFromKey(key),
  })
}

