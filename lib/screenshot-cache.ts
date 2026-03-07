/**
 * Cache for Microlink screenshot URLs.
 * Fetches once per URL, then reuses for instant display.
 */
const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

export async function getScreenshotUrl(embedUrl: string): Promise<string | null> {
  const key = embedUrl
  const cached = cache.get(key)
  if (cached) return cached

  const inFlight = pending.get(key)
  if (inFlight) return inFlight

  const promise = (async () => {
    try {
      const res = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(embedUrl)}&screenshot=true&meta=false`
      )
      const data = await res.json()
      const url = data?.data?.screenshot?.url ?? null
      if (url) cache.set(key, url)
      return url
    } catch {
      return null
    } finally {
      pending.delete(key)
    }
  })()

  pending.set(key, promise)
  return promise
}
