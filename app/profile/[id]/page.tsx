'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { MOCK_MEMBERS } from '@/lib/mock-data'
import { parseSocialLink } from '@/lib/parse-social'
import { Github, Linkedin, Twitter, Globe2 } from 'lucide-react'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const member = MOCK_MEMBERS.find(m => m.id === id)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [bioVisible, setBioVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  if (!member) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black mb-2">Member not found</h1>
          <button
            onClick={() => router.push('/?view=webring')}
            className="text-sm text-black/50 hover:text-black underline"
          >
            back
          </button>
        </div>
      </div>
    )
  }

  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(
    member.embedUrl,
  )}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800&viewport.deviceScaleFactor=2`

  // Slight delay before showing bio details to give the live preview a head start
  useEffect(() => {
    setBioVisible(false)
    const id = setTimeout(() => setBioVisible(true), 200)
    return () => clearTimeout(id)
  }, [member.id])

  // Normalize socials into icons + handle + URL (using the same parsing logic as signup)
  const socialEntries: { key: string; label: string; handle: string; url: string; icon: JSX.Element }[] = []

  if (member.socials.github) {
    const p = parseSocialLink('github', member.socials.github)
    if (p) {
      socialEntries.push({
        key: 'github',
        label: 'GitHub',
        handle: p.username,
        url: p.url,
        icon: <Github className="w-4 h-4" />,
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
        icon: <Twitter className="w-4 h-4" />,
      })
    }
  }
  if (member.socials.linkedin) {
    const p = parseSocialLink('linkedin', member.socials.linkedin)
    if (p) {
      socialEntries.push({
        key: 'linkedin',
        label: 'LinkedIn',
        handle: p.username,
        url: p.url,
        icon: <Linkedin className="w-4 h-4" />,
      })
    }
  }
  if (member.socials.website) {
    socialEntries.push({
      key: 'website',
      label: 'Website',
      handle: new URL(member.socials.website).hostname.replace(/^www\./, ''),
      url: member.socials.website,
      icon: <Globe2 className="w-4 h-4" />,
    })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Back button — same styling as webring view */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => {
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
        {/* Site preview – first to load, since it's the heaviest */}
        <div
          className="mt-8 rounded-lg overflow-hidden border border-black/10 shadow-lg relative bg-gray-50"
          style={{ aspectRatio: '16 / 10' }}
        >
          {/* Screenshot (always visible baseline preview) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={`${member.name}'s website`}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Iframe – fades in on top once fully loaded */}
          <iframe
            src={member.embedUrl}
            title={`${member.name}'s website`}
            className="absolute inset-0 w-full h-full border-0 transition-opacity duration-300"
            style={{ opacity: iframeLoaded ? 1 : 0 }}
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin"
          />

          {/* Loading overlay with blur + text while live preview initializes */}
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-md z-10">
              <div className="flex items-center gap-2 text-sm text-neutral-800">
                <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                <span>loading live preview…</span>
              </div>
            </div>
          )}
        </div>

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

          {/* Site URL */}
          <a
            href={member.embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-black/50 hover:text-black transition-colors underline underline-offset-2"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {member.embedUrl}
          </a>

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
