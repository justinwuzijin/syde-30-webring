export interface Member {
  id: string
  name: string
  embedUrl: string
  /** Optional URLs to uploaded media for the polaroid */
  polaroid_still_url?: string | null
  polaroid_live_url?: string | null
  socials: {
    website?: string
    twitter?: string
    instagram?: string
    linkedin?: string
    github?: string
  }
  connections: string[]
  approved: boolean
  joinedAt: string
}

export const ACCENT_COLORS = [
  '#e8203a',
  '#1a5fff',
  '#f0c800',
  '#e85c00',
  '#b845e8',
  '#00b87a',
] as const

export function getAccentColor(index: number): string {
  return ACCENT_COLORS[index % ACCENT_COLORS.length]
}

/** Returns the best URL to display for a member: embedUrl if set, otherwise first available social.
 * Display priority when no website: LinkedIn → X (Twitter) → GitHub → Instagram */
export function getDisplayUrl(member: Member): string {
  if (member.embedUrl) return member.embedUrl
  const s = member.socials
  if (s.website) return s.website
  if (s.linkedin) return s.linkedin.startsWith('http') ? s.linkedin : `https://linkedin.com/in/${s.linkedin}`
  if (s.twitter) return `https://x.com/${s.twitter}`
  if (s.github) return `https://github.com/${s.github}`
  if (s.instagram) return `https://instagram.com/${s.instagram}`
  return ''
}
