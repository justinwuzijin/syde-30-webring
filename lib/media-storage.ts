import { createHash } from 'crypto'

export const SUPABASE_STILL_BUCKET = 'profile-website-pictures'
export const S3_LIVE_BUCKET = process.env.S3_BUCKET_NAME || ''
export const S3_REGION = process.env.AWS_REGION || 'us-east-1'

export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function extFromName(name: string, fallback: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || fallback
  return ext.replace(/[^a-z0-9]/g, '') || fallback
}

/** Derives first-last slug from display name for folder naming. */
export function deriveFirstLastSlug(name: string): string {
  const n = (name || '').trim().replace(/\s+/g, ' ')
  if (!n) return 'member'
  const parts = n.split(' ').filter(Boolean)
  const first = parts[0] || 'member'
  const last = parts[parts.length - 1] || first
  const joined = `${first}-${last}`
  return sanitizeFileName(joined) || 'member'
}

export function buildStillPath(memberId: string, fileName: string, memberName?: string): string {
  const ext = extFromName(fileName, 'jpg')
  const base = sanitizeFileName(fileName.replace(/\.[^.]+$/, '')) || 'still'
  const segment = memberName ? `${deriveFirstLastSlug(memberName)}-${memberId}` : memberId
  return `members/${segment}/still/${Date.now()}-${base}.${ext}`
}

export function buildLiveKey(memberId: string, fileName: string, memberName?: string): string {
  const base = sanitizeFileName(fileName.replace(/\.[^.]+$/, '')) || 'live'
  const segment = memberName ? `${deriveFirstLastSlug(memberName)}-${memberId}` : memberId
  return `members/${segment}/live/${Date.now()}-${base}.webm`
}

export function pendingMemberIdFromEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  const digest = createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `pending-${digest}`
}

export function s3PublicUrlFromKey(key: string): string {
  return `https://${S3_LIVE_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

export function s3KeyFromUrl(url: string): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    // https://bucket.s3.region.amazonaws.com/key
    if (u.pathname.startsWith('/')) return decodeURIComponent(u.pathname.slice(1))
  } catch {
    // ignore
  }
  return null
}

