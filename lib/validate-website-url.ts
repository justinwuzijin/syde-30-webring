/**
 * Validates that a URL is a valid external website suitable for embedding in a preview.
 * Rejects: empty, relative, same-origin, or invalid URLs.
 */
export function isValidExternalWebsiteUrl(
  url: string | null | undefined,
  appOrigin?: string
): url is string {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return false

  try {
    // Reject relative URLs (starts with /)
    if (raw.startsWith('/')) return false

    const parsed = new URL(raw)

    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false

    // Reject same-origin (webring app)
    const origin = appOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '')
    if (origin && parsed.origin === origin) return false

    // Reject localhost / 127.0.0.1 in production context
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') {
      if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * Normalizes a website URL for preview use.
 * Adds https:// if missing. Returns null if invalid.
 */
export function normalizeWebsiteUrl(
  url: string | null | undefined,
  appOrigin?: string
): string | null {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return null

  try {
    let toParse = raw
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      toParse = `https://${raw}`
    }
    const parsed = new URL(toParse)
    const normalized = parsed.href

    if (!isValidExternalWebsiteUrl(normalized, appOrigin)) return null
    return normalized
  } catch {
    return null
  }
}
