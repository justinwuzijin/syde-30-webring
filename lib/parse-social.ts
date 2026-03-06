type SocialPlatform = 'linkedin' | 'twitter' | 'github'

export function parseSocialLink(
  platform: SocialPlatform,
  input: string
): { username: string; url: string } | null {
  const raw = input.trim().replace(/^@/, '')
  if (!raw) return null

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw)
      const pathParts = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
      let username = ''

      if (platform === 'linkedin') {
        username = pathParts[0] === 'in' ? (pathParts[1] ?? pathParts[0] ?? raw) : (pathParts[1] ?? pathParts[0] ?? raw)
      } else if (platform === 'twitter') {
        username = (url.hostname.includes('twitter.com') || url.hostname.includes('x.com'))
          ? (pathParts[0] ?? raw)
          : (pathParts[pathParts.length - 1] ?? raw)
      } else if (platform === 'github') {
        username = url.hostname.includes('github.com')
          ? (pathParts[0] ?? raw)
          : (pathParts[pathParts.length - 1] ?? raw)
      }

      if (!username) username = raw
      const urlMap: Record<SocialPlatform, (u: string) => string> = {
        linkedin: (u) => `https://linkedin.com/in/${u}`,
        twitter: (u) => `https://x.com/${u}`,
        github: (u) => `https://github.com/${u}`,
      }
      return { username, url: urlMap[platform](username) }
    }

    const username = raw
    const urlMap: Record<SocialPlatform, (u: string) => string> = {
      linkedin: (u) => `https://linkedin.com/in/${u}`,
      twitter: (u) => `https://x.com/${u}`,
      github: (u) => `https://github.com/${u}`,
    }
    return { username, url: urlMap[platform](username) }
  } catch {
    return null
  }
}
