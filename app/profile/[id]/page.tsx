'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MOCK_MEMBERS } from '@/lib/mock-data'
import { use } from 'react'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const member = MOCK_MEMBERS.find(m => m.id === id)
  const [isHovering, setIsHovering] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)

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

  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(member.embedUrl)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=800&viewport.deviceScaleFactor=2`

  return (
    <div className="min-h-screen bg-white">
      {/* Back button — same styling as webring view */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => router.push('/?view=webring')}
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
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">
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

        {/* Site preview */}
        <div 
          className="mt-8 rounded-lg overflow-hidden border border-black/10 shadow-lg relative bg-gray-50"
          style={{ aspectRatio: '16 / 10' }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Screenshot (visible when not hovering or while iframe loads) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={`${member.name}'s website`}
            className="absolute inset-0 w-full h-full transition-opacity duration-300"
            style={{ 
              opacity: isHovering && iframeLoaded ? 0 : 1,
            }}
          />
          
          {/* Loading indicator */}
          {isHovering && !iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10">
              <div className="flex items-center gap-2 text-sm text-black/50">
                <div className="w-4 h-4 border-2 border-black/20 border-t-black/60 rounded-full animate-spin" />
                Loading site...
              </div>
            </div>
          )}
          
          {/* Iframe - always rendered (preloaded), shown on hover */}
          <iframe
            src={member.embedUrl}
            title={`${member.name}'s website`}
            className="absolute inset-0 w-full h-full border-0 transition-opacity duration-300"
            style={{ opacity: isHovering && iframeLoaded ? 1 : 0 }}
            onLoad={() => setIframeLoaded(true)}
            sandbox="allow-scripts allow-same-origin"
          />
          
          {/* Hover hint overlay (visible when not hovering) */}
          {!isHovering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors">
              <span className="opacity-0 group-hover:opacity-100 text-sm text-black/40 bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm">
                Hover to preview live site
              </span>
            </div>
          )}
        </div>
        {/* Socials */}
        {Object.entries(member.socials).some(([, v]) => v) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {member.socials.github && (
              <a
                href={`https://github.com/${member.socials.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-black/70 border border-black/15 rounded-full hover:bg-black/5 transition-colors"
              >
                GitHub
              </a>
            )}
            {member.socials.twitter && (
              <a
                href={`https://twitter.com/${member.socials.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-black/70 border border-black/15 rounded-full hover:bg-black/5 transition-colors"
              >
                Twitter
              </a>
            )}
            {member.socials.linkedin && (
              <a
                href={`https://linkedin.com/in/${member.socials.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-black/70 border border-black/15 rounded-full hover:bg-black/5 transition-colors"
              >
                LinkedIn
              </a>
            )}
            {member.socials.instagram && (
              <a
                href={`https://instagram.com/${member.socials.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-black/70 border border-black/15 rounded-full hover:bg-black/5 transition-colors"
              >
                Instagram
              </a>
            )}
            {member.socials.website && (
              <a
                href={member.socials.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm text-black/70 border border-black/15 rounded-full hover:bg-black/5 transition-colors"
              >
                Website
              </a>
            )}
          </div>
        )}

        {/* Visit site CTA */}
        <div className="mt-10">
          <a
            href={member.embedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-black/80 transition-colors"
          >
            Visit site
          </a>
        </div>
      </div>
    </div>
  )
}
