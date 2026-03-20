'use client'

import { useRouter } from 'next/navigation'
import { type ReactElement, useState, useEffect, useMemo } from 'react'
import { use } from 'react'
import useSWR from 'swr'
import { getDisplayUrl, type Member } from '@/types/member'
import { parseSocialLink } from '@/lib/parse-social'
import { useSound } from '@/lib/use-sound'
import { usePageTransition } from '@/components/page-transition'
import { normalizeWebsiteUrl } from '@/lib/validate-website-url'
import { FaGithub, FaLinkedin, FaXTwitter } from 'react-icons/fa6'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  const data = await r.json()
  if (!r.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data as Member
}

/** Social platforms block framing via CSP. Only embed actual personal websites. */
function isEmbeddableUrl(url: string | null): boolean {
  if (!url) return false
  try {
    const host = new URL(url).hostname.toLowerCase()
    const blocked = ['linkedin.com', 'www.linkedin.com', 'x.com', 'twitter.com', 'github.com', 'www.github.com', 'instagram.com', 'www.instagram.com']
    return !blocked.some((b) => host === b || host.endsWith('.' + b))
  } catch {
    return false
  }
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const playClick = useSound('/click.mp3', { volume: 0.4 })
  const { startTransition, endTransition } = usePageTransition()
  const { data: member, error, isLoading } = useSWR<Member>(
    id ? `/api/members/${id}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  )
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [bioVisible, setBioVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Resolve website URL from member record — only valid external URLs, never webring origin
  const websiteUrl = useMemo(() => {
    if (!member) return null
    const raw = getDisplayUrl(member)
    return normalizeWebsiteUrl(raw)
  }, [member])
  const hasValidWebsite = !!websiteUrl
  const canEmbedInIframe = hasValidWebsite && websiteUrl && isEmbeddableUrl(websiteUrl)

  // Signal page ready when iframe loads, or when no website / social-only (no iframe)
  useEffect(() => {
    if (!member) return
    if (!hasValidWebsite || !canEmbedInIframe) {
      endTransition()
    }
  }, [member?.id, hasValidWebsite, canEmbedInIframe, endTransition])

  useEffect(() => {
    if (canEmbedInIframe && iframeLoaded) {
      endTransition()
    }
  }, [canEmbedInIframe, iframeLoaded, endTransition])

  // Must run unconditionally (Rules of Hooks) — only applies when member exists
  useEffect(() => {
    if (!member) return
    setBioVisible(false)
    const t = setTimeout(() => setBioVisible(true), 200)
    return () => clearTimeout(t)
  }, [member?.id])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-800 rounded-full animate-spin" />
          <p className="text-sm text-black/50">loading…</p>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black mb-2">Member not found</h1>
          <button
            onClick={() => {
              playClick()
              startTransition()
              router.push('/?view=webring')
            }}
            className="text-sm text-black/50 hover:text-black underline"
          >
            back
          </button>
        </div>
      </div>
    )
  }

  // Normalize socials into icons + handle + URL. Display priority: LinkedIn → X → GitHub
  const socialEntries: { key: string; label: string; handle: string; url: string; icon: ReactElement }[] = []

  if (member.socials.linkedin) {
    const p = parseSocialLink('linkedin', member.socials.linkedin)
    if (p) {
      socialEntries.push({
        key: 'linkedin',
        label: 'LinkedIn',
        handle: p.username,
        url: p.url,
        icon: <FaLinkedin className="w-4 h-4" />,
      })
    }
  }
  if (member.socials.twitter) {
    const p = parseSocialLink('twitter', member.socials.twitter)
    if (p) {
      socialEntries.push({
        key: 'twitter',
        label: 'X',
        handle: p.username,
        url: p.url,
        icon: <FaXTwitter className="w-4 h-4" />,
      })
    }
  }
  if (member.socials.github) {
    const p = parseSocialLink('github', member.socials.github)
    if (p) {
      socialEntries.push({
        key: 'github',
        label: 'GitHub',
        handle: p.username,
        url: p.url,
        icon: <FaGithub className="w-4 h-4" />,
      })
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Back button — same styling as webring view */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => {
            playClick()
            setLeaving(true)
            setTimeout(() => {
              router.push('/?view=webring')
            }, 220)
          }}
          className={
            'relative overflow-hidden rounded-full px-4 py-2 text-sm text-neutral-900 hover:text-neutral-950 ' +
            'bg-white/35 bg-gradient-to-b from-white/60 via-white/35 to-white/25 ' +
            'border border-white/60 ' +
            'backdrop-blur-3xl backdrop-saturate-150 ' +
            'shadow-[0_10px_30px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.8)] ' +
            'supports-[backdrop-filter]:bg-white/30 ' +
            'transition-colors transition-shadow duration-200 hover:bg-white/20'
          }
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          <span className="absolute inset-0 pointer-events-none rounded-full bg-gradient-to-b from-white/45 to-transparent opacity-70" />
          ← back
        </button>
      </div>

      {/* Main content container - all aligned to same width */}
      <div
        className="max-w-6xl mx-auto px-6 pt-24 pb-16"
        style={{
          opacity: leaving ? 0 : 1,
          transition: 'opacity 220ms ease',
        }}
      >
        {/* Site preview — when member has a link (website or social). Iframe only for embeddable URLs. */}
        {hasValidWebsite && websiteUrl && (
          <div
            className="mt-8 rounded-lg overflow-hidden border border-black/10 shadow-lg relative bg-gray-50"
            style={{ aspectRatio: '16 / 10' }}
          >
            {/* Screenshot (always visible baseline preview) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.microlink.io/?url=${encodeURIComponent(
                websiteUrl,
              )}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800&viewport.deviceScaleFactor=2`}
              alt={`${member.name}'s site`}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Iframe — only for embeddable URLs. LinkedIn, X, GitHub block framing via CSP. */}
            {canEmbedInIframe && (
              <>
                <iframe
                  src={websiteUrl}
                  title={`${member.name}'s website`}
                  className="absolute inset-0 w-full h-full border-0 transition-opacity duration-300"
                  style={{ opacity: iframeLoaded ? 1 : 0 }}
                  onLoad={() => setIframeLoaded(true)}
                  sandbox="allow-scripts allow-same-origin"
                />
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2 text-sm text-neutral-800">
                      <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                      <span>loading live preview…</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Bio + socials fade-in so transitions between bios feel smoother */}
        <div
          className="mt-8"
          style={{
            opacity: bioVisible ? 1 : 0,
            transition: 'opacity 280ms ease',
          }}
        >
          {/* Name */}
          <h1
            className="text-5xl font-bold text-black mb-2"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
          >
            {member.name}
          </h1>

          {/* Site URL — only when member has a valid external website */}
          {hasValidWebsite && websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-black/50 hover:text-black transition-colors underline underline-offset-2"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            >
              {websiteUrl}
            </a>
          )}

        {/* Socials with icons + handles (only provided ones) */}
        {socialEntries.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {socialEntries.map((s) => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-black/80 border border-black/10 rounded-full hover:bg-black/5 hover:border-black/20 transition-colors"
              >
                {s.icon}
                <span className="font-mono text-xs">@{s.handle}</span>
              </a>
            ))}
          </div>
        )}

          {/* (No separate visit CTA button needed; URL + live preview already present) */}
        </div>
      </div>

      {/* Soft white veil when leaving a bio to return to the collage */}
      <div
        className="pointer-events-none fixed inset-0 z-40 bg-white"
        style={{
          opacity: leaving ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      />
    </div>
  )
}
