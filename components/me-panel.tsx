'use client'

import { useEffect, useState, useCallback } from 'react'
import useSWR, { mutate } from 'swr'
import { useAuth } from '@/lib/auth-context'
import type { Member } from '@/types/member'
import { PolaroidCard, POLAROID_WIDTH, POLAROID_HEIGHT } from './polaroid-card'
import { ProfilePictureField } from './join-form'

interface ProfileResponse {
  member: Member
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
  const [website, setWebsite] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [twitter, setTwitter] = useState('')
  const [github, setGithub] = useState('')
  const [stillUrl, setStillUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useSWR<ProfileResponse>(user ? '/api/me/profile' : null, fetcher, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    if (!data?.member) return
    const m = data.member
    setWebsite(m.embedUrl || m.socials.website || '')
    setLinkedin(m.socials.linkedin || '')
    setTwitter(m.socials.twitter || '')
    setGithub(m.socials.github || '')
    setStillUrl(m.polaroid_still_url || '')
    setLiveUrl(m.polaroid_live_url || '')
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

        const rawWebsite = website.trim()
        let websiteToSend = rawWebsite
        if (rawWebsite && !/^https?:\/\//i.test(rawWebsite)) {
          websiteToSend = `https://${rawWebsite}`
        }

        const res = await fetch('/api/me/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            website_link: websiteToSend,
            linkedin_handle: linkedin.trim(),
            twitter_handle: twitter.trim(),
            github_handle: github.trim(),
            polaroid_still_url: stillUrl.trim(),
            polaroid_live_url: liveUrl.trim(),
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
    [user, data?.member, website, linkedin, twitter, github, stillUrl, liveUrl, cooldownSeconds, saving]
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
        embedUrl: website || member.embedUrl,
        polaroid_still_url: stillUrl || member.polaroid_still_url || null,
        polaroid_live_url: liveUrl || member.polaroid_live_url || null,
      }
    : null

  const handleMediaUpload = useCallback(
    async (kind: 'still' | 'live', file: File | null) => {
      if (!user || !data?.member) return
      setError(null)
      if (!file) {
        // Clearing media: just clear local state; user can save to persist
        if (kind === 'still') setStillUrl('')
        else setLiveUrl('')
        return
      }
      try {
        setUploading(true)
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
          setStillUrl(payload.polaroid_still_url)
        }
        if (typeof payload.polaroid_live_url === 'string') {
          setLiveUrl(payload.polaroid_live_url)
        }
        // Do not auto-PATCH here; the main Save button will persist media + other fields
      } catch {
        setError('failed to upload media')
      } finally {
        setUploading(false)
      }
    },
    [user, data?.member]
  )

  return (
    <div className="absolute inset-0 flex flex-col lg:flex-row items-center justify-center gap-10 px-6 lg:px-16 pointer-events-none">
      <div className="relative pointer-events-auto flex items-center justify-center">
        <div
          className="w-[min(340px,80vw)]"
          style={{
            aspectRatio: `${POLAROID_WIDTH} / ${POLAROID_HEIGHT}`,
            position: 'relative',
          }}
        >
          {previewMember && (
            <PolaroidCard
              member={previewMember}
              x={POLAROID_WIDTH / 2}
              y={POLAROID_HEIGHT / 2}
              noTilt
            />
          )}
        </div>
      </div>

      <div className="w-full max-w-md pointer-events-auto bg-white/80 backdrop-blur-xl border border-black/5 rounded-3xl px-6 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.16)]">
        <div className="flex items-baseline justify-between mb-3">
          <h2
            className="text-sm text-neutral-900 lowercase tracking-[0.18em]"
            style={{
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            }}
          >
            me
          </h2>
          <span className="text-[11px] text-neutral-500 font-mono lowercase">
            {member?.name ?? user.name}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 font-mono lowercase">
              website / embed url
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full text-sm px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-500 font-mono lowercase">
                linkedin
              </label>
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="handle"
                className="w-full text-sm px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-500 font-mono lowercase">
                twitter
              </label>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="handle"
                className="w-full text-sm px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-neutral-500 font-mono lowercase">
                github
              </label>
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="username"
                className="w-full text-sm px-3 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 font-mono lowercase">
              current photo
            </label>
            <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-hidden flex items-center justify-center">
              {previewMember?.polaroid_still_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewMember.polaroid_still_url}
                  alt="current polaroid still"
                  className="max-h-40 w-auto object-cover"
                />
              ) : (
                <span className="text-[11px] text-neutral-400 py-6 font-mono lowercase">
                  no photo uploaded yet
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-neutral-500 font-mono lowercase">
              current live clip
            </label>
            <div className="w-full rounded-xl border border-neutral-200 bg-white overflow-hidden flex items-center justify-center">
              {previewMember?.polaroid_live_url ? (
                <video
                  src={previewMember.polaroid_live_url}
                  className="max-h-40 w-auto object-cover"
                  muted
                  controls
                  playsInline
                />
              ) : (
                <span className="text-[11px] text-neutral-400 py-6 font-mono lowercase">
                  no live clip uploaded yet
                </span>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <ProfilePictureField
              label="new polaroid still (photo)"
              requiredNote="heic, jpg, jpeg, png"
              helperText="upload a new still image for your polaroid"
              value={null}
              onChange={(file) => {
                if (file) void handleMediaUpload('still', file)
              }}
              error={undefined}
              accept=".heic,.heif,.jpg,.jpeg,.png,image/*"
            />

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
            />
          </div>

          {error && (
            <p className="text-[11px] font-mono text-red-500 pt-1 lowercase">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={saving || cooldownSeconds > 0 || isLoading || uploading}
              className="px-4 py-2 rounded-full text-xs font-medium lowercase tracking-[0.16em] bg-black text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving
                ? 'saving…'
                : cooldownSeconds > 0
                ? `wait ${cooldownSeconds}s`
                : 'save changes'}
            </button>
            <a
              href="/forgot-password"
              className="text-[11px] font-mono text-neutral-500 hover:text-neutral-800 lowercase"
            >
              change password
            </a>
          </div>

          {savedAt && !error && (
            <p className="text-[10px] font-mono text-neutral-400 pt-1 lowercase">
              changes saved
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

