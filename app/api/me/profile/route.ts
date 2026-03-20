import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyAuthToken } from '@/lib/token'
import { parseSocialLink } from '@/lib/parse-social'
import type { Member } from '@/types/member'
import { storagePathFromPublicUrl } from '@/lib/storage-path'
import { s3KeyFromUrl } from '@/lib/media-storage'
import { deleteLiveClipByKey } from '@/lib/s3'

const PROFILE_SAVE_COOLDOWN_MS = 30_000 // 30s between profile rewrites

function normalizeWebsiteForStorage(input: string): string {
  const raw = input.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

function isValidName(name: string): boolean {
  const n = name.trim()
  if (n.length < 2 || n.length > 60) return false
  return /^[a-zA-Z\s']+$/.test(n)
}

function isValidUrlLikeOrHandle(value: string): boolean {
  const v = value.trim()
  if (!v) return true
  if (v.startsWith('http://') || v.startsWith('https://')) {
    try {
      // eslint-disable-next-line no-new
      new URL(v)
      return true
    } catch {
      return false
    }
  }
  const cleaned = v.replace(/^@/, '')
  return /^[A-Za-z0-9_.-]{1,100}$/.test(cleaned)
}

function normalizeHandle(platform: 'linkedin' | 'twitter' | 'github', value: string): string {
  const v = value.trim()
  if (!v) return ''
  const parsed = parseSocialLink(platform, v)
  return (parsed?.username ?? v).replace(/^@/, '').trim()
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function rowToMember(row: any): Member {
  return {
    id: toSlug(row.name || ''),
    name: row.name || '',
    embedUrl: row.website_link || '',
    polaroid_still_url: row.polaroid_still_url || null,
    polaroid_live_url: row.polaroid_live_url || null,
    socials: {
      website: row.website_link || undefined,
      linkedin: row.linkedin_handle || undefined,
      twitter: row.twitter_handle || undefined,
      github: row.github_handle || undefined,
    },
    connections: [],
    approved: row.approved ?? true,
    joinedAt: row.joined_at || row.created_at || new Date().toISOString(),
  }
}

function getAuthUser(request: Request) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  return verifyAuthToken(token)
}

export async function GET(request: Request) {
  const authUser = getAuthUser(request)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  // First try by id, then fall back to email in case legacy tokens or data mismatch
  let { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle()

  if ((!data || error) && authUser.email) {
    const fallback = await supabase
      .from('members')
      .select('*')
      // Use ilike to avoid casing mismatches (emails are logically case-insensitive)
      .ilike('email', authUser.email)
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (error || !data) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const member = rowToMember(data)
  return NextResponse.json({ member })
}

export async function PATCH(request: Request) {
  const authUser = getAuthUser(request)
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (typeof body.name === 'string') {
    const nextName = body.name.trim()
    if (!isValidName(nextName)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    updates.name = nextName
  }

  if (typeof body.website_link === 'string') {
    const normalized = normalizeWebsiteForStorage(body.website_link)
    if (normalized) {
      try {
        // eslint-disable-next-line no-new
        new URL(normalized)
      } catch {
        return NextResponse.json({ error: 'Invalid website URL' }, { status: 400 })
      }
    }
    updates.website_link = normalized || null
  }
  if (typeof body.linkedin_handle === 'string') {
    const v = normalizeHandle('linkedin', body.linkedin_handle)
    if (!isValidUrlLikeOrHandle(v)) {
      return NextResponse.json({ error: 'Invalid LinkedIn value' }, { status: 400 })
    }
    updates.linkedin_handle = v || null
  }
  if (typeof body.twitter_handle === 'string') {
    const v = normalizeHandle('twitter', body.twitter_handle)
    if (!isValidUrlLikeOrHandle(v)) {
      return NextResponse.json({ error: 'Invalid Twitter value' }, { status: 400 })
    }
    updates.twitter_handle = v || null
  }
  if (typeof body.github_handle === 'string') {
    const v = normalizeHandle('github', body.github_handle)
    if (!isValidUrlLikeOrHandle(v)) {
      return NextResponse.json({ error: 'Invalid GitHub value' }, { status: 400 })
    }
    updates.github_handle = v || null
  }
  if (typeof body.polaroid_still_url === 'string') {
    const v = body.polaroid_still_url.trim()
    updates.polaroid_still_url = v ? v : null
  }
  if (typeof body.polaroid_live_url === 'string') {
    const v = body.polaroid_live_url.trim()
    updates.polaroid_live_url = v ? v : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Look up the member by id, with an email fallback
  let { data: existing, error: fetchError } = await supabase
    .from('members')
    .select('id, last_profile_update_at, polaroid_still_url, polaroid_live_url')
    .eq('id', authUser.id)
    .maybeSingle()

  if ((!existing || fetchError) && authUser.email) {
    const fallback = await supabase
      .from('members')
      .select('id, last_profile_update_at, polaroid_still_url, polaroid_live_url')
      // Use ilike to avoid casing mismatches (emails are logically case-insensitive)
      .ilike('email', authUser.email)
      .maybeSingle()
    existing = fallback.data
    fetchError = fallback.error
  }

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const oldStillUrl: string | null = existing.polaroid_still_url || null
  const oldLiveUrl: string | null = existing.polaroid_live_url || null

  const now = Date.now()
  const last = existing.last_profile_update_at ? new Date(existing.last_profile_update_at as string).getTime() : 0

  if (last && now - last < PROFILE_SAVE_COOLDOWN_MS) {
    const retryAfter = Math.ceil((PROFILE_SAVE_COOLDOWN_MS - (now - last)) / 1000)
    return NextResponse.json(
      { error: 'You are updating too quickly. Please wait a bit before saving again.', retryAfter },
      { status: 429 }
    )
  }

  const { data, error } = await supabase
    .from('members')
    .update({
      ...updates,
      last_profile_update_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select('*')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  // ── Orphan cleanup on media updates ──
  const BUCKET = 'profile-website-pictures'
  const nextStillUrl: string | null =
    typeof body.polaroid_still_url === 'string' ? (body.polaroid_still_url.trim() || null) : oldStillUrl
  const nextLiveUrl: string | null =
    typeof body.polaroid_live_url === 'string' ? (body.polaroid_live_url.trim() || null) : oldLiveUrl
  const stillChanged = typeof body.polaroid_still_url === 'string' && oldStillUrl !== nextStillUrl
  const liveChanged = typeof body.polaroid_live_url === 'string' && oldLiveUrl !== nextLiveUrl

  const deleteStillIfOrphan = async (oldUrl: string | null) => {
    if (!oldUrl) return
    if (oldUrl === nextStillUrl) return
    const stillUsers = await supabase
      .from('members')
      .select('id')
      .eq('polaroid_still_url', oldUrl)
      .neq('id', existing.id)
      .limit(1)
    if ((stillUsers.data?.length ?? 0) > 0) return
    const oldPath = storagePathFromPublicUrl(oldUrl, BUCKET)
    if (!oldPath) return
    await supabase.storage.from(BUCKET).remove([oldPath]).catch((e) => {
      console.warn('Failed to remove orphaned still file:', e)
    })
  }

  const deleteLiveIfOrphan = async (oldUrl: string | null) => {
    if (!oldUrl) return
    if (oldUrl === nextLiveUrl) return
    const liveUsers = await supabase
      .from('members')
      .select('id')
      .eq('polaroid_live_url', oldUrl)
      .neq('id', existing.id)
      .limit(1)
    if ((liveUsers.data?.length ?? 0) > 0) return
    const oldKey = s3KeyFromUrl(oldUrl)
    if (!oldKey) return
    await deleteLiveClipByKey(oldKey).catch((e) => {
      console.warn('Failed to remove orphaned live clip:', e)
    })
  }

  // Only touch storage backends if media actually changed.
  const cleanupTasks: Promise<void>[] = []
  if (stillChanged) cleanupTasks.push(deleteStillIfOrphan(oldStillUrl))
  if (liveChanged) cleanupTasks.push(deleteLiveIfOrphan(oldLiveUrl))
  if (cleanupTasks.length > 0) await Promise.all(cleanupTasks)

  const member = rowToMember(data)
  return NextResponse.json({ member })
}

