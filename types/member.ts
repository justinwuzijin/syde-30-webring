export interface Member {
  id: string
  name: string
  program: string
  embedUrl: string
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
