'use client'

import { useRouter } from 'next/navigation'
import { MOCK_MEMBERS } from '@/lib/mock-data'
import { use } from 'react'

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { id } = use(params)
  const router = useRouter()
  const member = MOCK_MEMBERS.find(m => m.id === id)

  if (!member) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-black mb-2">Member not found</h1>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-black/50 hover:text-black underline"
          >
            Back to webring
          </button>
        </div>
      </div>
    )
  }

  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(member.embedUrl)}&screenshot=true&meta=false&embed=screenshot.url`

  return (
    <div className="min-h-screen bg-white">
      {/* Back button */}
      <div className="fixed top-6 left-6 z-50">
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 text-sm text-black/60 hover:text-black border border-black/15 hover:border-black/30 rounded-full transition-colors bg-white/80 backdrop-blur-sm"
          style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif' }}
        >
          &larr; Back to webring
        </button>
      </div>

      {/* Profile content */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-16">
        {/* Name */}
        <h1
          className="text-5xl font-bold text-black mb-2 lowercase"
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
          {member.embedUrl} &nearr;
        </a>

        {/* Screenshot preview */}
        <div className="mt-8 rounded-lg overflow-hidden border border-black/10 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt={`${member.name}'s website`}
            className="w-full h-auto"
          />
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
            Visit site &nearr;
          </a>
        </div>
      </div>
    </div>
  )
}
