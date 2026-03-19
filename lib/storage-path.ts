export function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  if (!publicUrl) return null
  try {
    const u = new URL(publicUrl)
    // Supabase public URLs typically look like:
    // /storage/v1/object/public/<bucket>/<path>
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx >= 0) {
      const start = idx + marker.length
      const path = u.pathname.slice(start)
      return path || null
    }

    // Fallback: try to find `/public/<bucket>/` segment.
    const marker2 = `/public/${bucket}/`
    const idx2 = u.pathname.indexOf(marker2)
    if (idx2 >= 0) {
      const start2 = idx2 + marker2.length
      const path = u.pathname.slice(start2)
      return path || null
    }
  } catch {
    // ignore
  }
  return null
}

