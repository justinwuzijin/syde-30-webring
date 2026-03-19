'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/lib/auth-context'
import type { Member } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'
import { ProfilePictureField } from './join-form'

interface ProfileResponse {
  member: Member
}

type DraftProfile = {
  name: string
  website: string
  linkedin: string
  twitter: string
  github: string
  polaroid_still_url: string
  polaroid_live_url: string
}

const fetcher = (url: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('syde30_auth_token') : null
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => {
    if (!r.ok) throw r
    return r.json()
  })
}

export function MePanel() {
  const { user } = useAuth()
  const [draft, setDraft] = useState<DraftProfile>({
    name: '',
    website: '',
    linkedin: '',
    twitter: '',
    github: '',
    polaroid_still_url: '',
    polaroid_live_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingKind, setUploadingKind] = useState<'still' | 'live' | null>(null)
  const stillObjectUrlRef = useRef<string | null>(null)
  const liveObjectUrlRef = useRef<string | null>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(1)

  const { data, isLoading } = useSWR<ProfileResponse>(user ? '/api/me/profile' : null, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (!data?.member) return
    const m = data.member
    setDraft({
      name: m.name || '',
      website: m.embedUrl || m.socials.website || '',
      linkedin: m.socials.linkedin || '',
      twitter: m.socials.twitter || '',
      github: m.socials.github || '',
      polaroid_still_url: m.polaroid_still_url || '',
      polaroid_live_url: m.polaroid_live_url || '',
    })
  }, [data?.member])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const id = setInterval(() => {
      setCooldownSeconds((s) => (s > 1 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownSeconds])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!user || !data?.member) return
      if (cooldownSeconds > 0 || saving) return
      setSaving(true)
      setError(null)
      try {
        const token =
          typeof window !== 'undefined' ? localStorage.getItem('syde30_auth_token') : null

        const rawWebsite = draft.website.trim()
        const websiteToSend =
          rawWebsite && !/^https?:\/\//i.test(rawWebsite) ? `https://${rawWebsite}` : rawWebsite

        const res = await fetch('/api/me/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            name: draft.name.trim(),
            website_link: websiteToSend,
            linkedin_handle: draft.linkedin.trim(),
            twitter_handle: draft.twitter.trim(),
            github_handle: draft.github.trim(),
            polaroid_still_url: draft.polaroid_still_url.trim(),
            polaroid_live_url: draft.polaroid_live_url.trim(),
          }),
        })
        if (!res.ok) {
          let retry = 0
          let message = 'failed to update profile'
          try {
            const payload = await res.json()
            if (typeof payload.error === 'string') message = payload.error
            if (typeof payload.retryAfter === 'number') retry = payload.retryAfter
          } catch {
            // ignore
          }
          if (res.status === 429 && retry > 0) {
            setCooldownSeconds(retry)
          }
          setError(message)
          return
        }
        const payload: ProfileResponse = await res.json()
        setSavedAt(Date.now())
        // update local SWR cache for /api/me/profile
        mutate('/api/me/profile', payload, false)
        // refresh global members list so scrapbook/classroom reflect changes
        mutate('/api/members')
      } catch {
        setError('failed to update profile')
      } finally {
        setSaving(false)
      }
    },
    [user, data?.member, draft, cooldownSeconds, saving]
  )

  if (!user) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
        <p className="text-sm text-neutral-700 lowercase tracking-[0.16em]">
          log in to edit your profile
        </p>
      </div>
    )
  }

  const member = data?.member
  const previewMember: Member | null = member
    ? {
        ...member,
        name: draft.name || member.name,
        embedUrl: draft.website || member.embedUrl,
        socials: {
          ...member.socials,
          website: draft.website || member.socials.website,
          linkedin: draft.linkedin || member.socials.linkedin,
          twitter: draft.twitter || member.socials.twitter,
          github: draft.github || member.socials.github,
        },
        polaroid_still_url: draft.polaroid_still_url || member.polaroid_still_url || null,
        polaroid_live_url: draft.polaroid_live_url || member.polaroid_live_url || null,
      }
    : null

  const isDirty = useMemo(() => {
    if (!member) return false
    const saved: DraftProfile = {
      name: member.name || '',
      website: member.embedUrl || member.socials.website || '',
      linkedin: member.socials.linkedin || '',
      twitter: member.socials.twitter || '',
      github: member.socials.github || '',
      polaroid_still_url: member.polaroid_still_url || '',
      polaroid_live_url: member.polaroid_live_url || '',
    }
    return (
      saved.name !== draft.name ||
      saved.website !== draft.website ||
      saved.linkedin !== draft.linkedin ||
      saved.twitter !== draft.twitter ||
      saved.github !== draft.github ||
      saved.polaroid_still_url !== draft.polaroid_still_url ||
      saved.polaroid_live_url !== draft.polaroid_live_url
    )
  }, [member, draft])

  const handleMediaUpload = useCallback(
    async (kind: 'still' | 'live', file: File | null) => {
      if (!user || !data?.member) return
      setError(null)
      if (!file) {
        // Clearing media: just clear local state; user can save to persist
        if (kind === 'still') {
          if (stillObjectUrlRef.current) URL.revokeObjectURL(stillObjectUrlRef.current)
          stillObjectUrlRef.current = null
          setDraft((d) => ({ ...d, polaroid_still_url: '' }))
        } else {
          if (liveObjectUrlRef.current) URL.revokeObjectURL(liveObjectUrlRef.current)
          liveObjectUrlRef.current = null
          setDraft((d) => ({ ...d, polaroid_live_url: '' }))
        }
        return
      }
      try {
        setUploading(true)
        setUploadingKind(kind)

        // Immediate local preview while upload runs
        const objectUrl = URL.createObjectURL(file)
        if (kind === 'still') {
          if (stillObjectUrlRef.current) URL.revokeObjectURL(stillObjectUrlRef.current)
          stillObjectUrlRef.current = objectUrl
          setDraft((d) => ({ ...d, polaroid_still_url: objectUrl }))
        } else {
          if (liveObjectUrlRef.current) URL.revokeObjectURL(liveObjectUrlRef.current)
          liveObjectUrlRef.current = objectUrl
          setDraft((d) => ({ ...d, polaroid_live_url: objectUrl }))
        }

        const token =
          typeof window !== 'undefined' ? localStorage.getItem('syde30_auth_token') : null
        const fd = new FormData()
        if (kind === 'still') fd.set('polaroidStill', file)
        if (kind === 'live') fd.set('polaroidLive', file)
        const res = await fetch('/api/me/polaroid', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: fd,
        })
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg =
            (payload.errors && (payload.errors.polaroidStill || payload.errors.polaroidLive)) ||
            payload.error ||
            'failed to upload media'
          setError(msg)
          return
        }
        if (typeof payload.polaroid_still_url === 'string') {
          if (stillObjectUrlRef.current) URL.revokeObjectURL(stillObjectUrlRef.current)
          stillObjectUrlRef.current = null
          setDraft((d) => ({ ...d, polaroid_still_url: payload.polaroid_still_url }))
        }
        if (typeof payload.polaroid_live_url === 'string') {
          if (liveObjectUrlRef.current) URL.revokeObjectURL(liveObjectUrlRef.current)
          liveObjectUrlRef.current = null
          setDraft((d) => ({ ...d, polaroid_live_url: payload.polaroid_live_url }))
        }
        // Do not auto-PATCH here; the main Save button will persist media + other fields
      } catch {
        setError('failed to upload media')
      } finally {
        setUploading(false)
        setUploadingKind(null)
      }
    },
    [user, data?.member]
  )

  useEffect(() => {
    return () => {
      if (stillObjectUrlRef.current) URL.revokeObjectURL(stillObjectUrlRef.current)
      if (liveObjectUrlRef.current) URL.revokeObjectURL(liveObjectUrlRef.current)
    }
  }, [])

  // Keep the polaroid preview as a single scaled block so labels can align under it.
  useEffect(() => {
    const el = previewContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width
      // Cap scale so the preview never overwhelms the layout
      const s = Math.max(0.85, Math.min(1.75, w / POLAROID_WIDTH))
      setPreviewScale(s)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-x-hidden overflow-y-auto">
      <div className="min-h-full w-full flex flex-col">
        {/* Spacer for fixed nav (back button + tabs) */}
        <div className="h-24 shrink-0" />

        {/* Center main content in remaining viewport */}
        <div className="flex-1 px-4 sm:px-6 lg:px-10 py-10 flex items-center justify-center min-h-0">
          <div className="w-full max-w-6xl pointer-events-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,760px)] gap-12 items-center justify-center">
              {/* Left: live preview (centered beside editor) */}
              <div className="flex items-center justify-center">
                <div ref={previewContainerRef} className="flex flex-col items-center w-[min(340px,92vw)]">
                  {/* Scaled polaroid block (real visual) */}
                  <div
                    className="relative"
                    style={{
                      width: POLAROID_WIDTH * previewScale,
                      height: POLAROID_HEIGHT * previewScale,
                    }}
                  >
                    <div
                      style={{
                        width: POLAROID_WIDTH,
                        height: POLAROID_HEIGHT,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        left: 0,
                        top: 0,
                      }}
                    >
                      {previewMember && (
                        <PolaroidCard
                          member={previewMember}
                          x={0}
                          y={0}
                          noTilt
                        />
                      )}
                    </div>
                  </div>

                  {/* Label aligned directly under the visual block */}
                  <div
                    className="mt-3 flex items-center justify-center"
                    style={{ width: POLAROID_WIDTH * previewScale }}
                  >
                    <span className="text-[11px] text-neutral-500 font-mono lowercase">
                      live preview
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: editor */}
              <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-3xl shadow-[0_14px_40px_rgba(15,23,42,0.16)] overflow-hidden">
              <div className="px-5 py-4 border-b border-black/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-neutral-500 font-mono lowercase">
                      edit your profile
                    </span>
                    <span className="text-xs text-neutral-900 lowercase tracking-[0.12em]">
                      {isDirty ? 'unsaved changes' : 'up to date'}
                    </span>
                  </div>
                  <a
                    href="/forgot-password"
                    className="text-[11px] font-mono text-neutral-500 hover:text-neutral-800 lowercase"
                  >
                    change password
                  </a>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] text-neutral-500 font-mono lowercase">
                      display name (handwritten label)
                    </label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="e.g. leo zhang"
                      className="w-full text-[13px] px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] text-neutral-500 font-mono lowercase">
                      website / embed url
                    </label>
                    <input
                      type="text"
                      value={draft.website}
                      onChange={(e) => setDraft((d) => ({ ...d, website: e.target.value }))}
                      placeholder="https://example.com"
                      className="w-full text-[13px] px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                    <p className="text-[10px] text-neutral-400 font-mono lowercase mt-0.5">
                      paste any url — https added automatically
                    </p>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] text-neutral-500 font-mono lowercase">
                      social (linkedin, x / twitter, github)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={draft.linkedin}
                        onChange={(e) => setDraft((d) => ({ ...d, linkedin: e.target.value }))}
                        placeholder="linkedin"
                        className="w-full text-[12px] px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                      <input
                        type="text"
                        value={draft.twitter}
                        onChange={(e) => setDraft((d) => ({ ...d, twitter: e.target.value }))}
                        placeholder="x / twitter"
                        className="w-full text-[12px] px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                      <input
                        type="text"
                        value={draft.github}
                        onChange={(e) => setDraft((d) => ({ ...d, github: e.target.value }))}
                        placeholder="github"
                        className="w-full text-[12px] px-3 py-1.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-500 font-mono lowercase">
                        still photo
                      </span>
                      {uploading && uploadingKind === 'still' && (
                        <span className="text-[10px] text-neutral-400 font-mono lowercase">
                          uploading…
                        </span>
                      )}
                    </div>
                    <ProfilePictureField
                      label="new polaroid still (photo)"
                      requiredNote="heic, jpg, jpeg, png"
                      helperText="updates the preview immediately; hit save to persist"
                      value={null}
                      onChange={(file) => {
                        if (file) void handleMediaUpload('still', file)
                      }}
                      error={undefined}
                      accept=".heic,.heif,.jpg,.jpeg,.png,image/*"
                      dense
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-500 font-mono lowercase">
                        live clip
                      </span>
                      {uploading && uploadingKind === 'live' && (
                        <span className="text-[10px] text-neutral-400 font-mono lowercase">
                          uploading…
                        </span>
                      )}
                    </div>
                    <ProfilePictureField
                      label="new polaroid live clip"
                      requiredNote="mov or mp4"
                      helperText="short clip that plays when others hover your polaroid"
                      value={null}
                      onChange={(file) => {
                        if (file) void handleMediaUpload('live', file)
                      }}
                      error={undefined}
                      accept=".mov,.mp4,video/*"
                      dense
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-[11px] font-mono text-red-500 lowercase">
                    {error}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={!isDirty || saving || cooldownSeconds > 0 || isLoading || uploading}
                    className="px-4 py-2 rounded-full text-xs font-medium lowercase tracking-[0.16em] bg-black text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving
                      ? 'saving…'
                      : cooldownSeconds > 0
                      ? `wait ${cooldownSeconds}s`
                      : isDirty
                      ? 'save changes'
                      : 'saved'}
                  </button>

                  <div className="flex items-center gap-3">
                    {savedAt && !error && (
                      <p className="text-[10px] font-mono text-neutral-400 lowercase">
                        changes saved
                      </p>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}

