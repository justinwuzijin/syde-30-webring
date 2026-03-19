/* eslint-disable no-console */
/**
 * Deletes Supabase still-photo objects in `profile-website-pictures`
 * that are not referenced by any member row's `polaroid_still_url`.
 *
 * Run manually:
 * $env:NEXT_PUBLIC_SUPABASE_URL="..."
 * $env:SUPABASE_SERVICE_ROLE_KEY="..."
 * node scripts/cleanup-orphaned-polaroids.js --dry-run
 * node scripts/cleanup-orphaned-polaroids.js
 */

const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'profile-website-pictures'
const DRY_RUN = process.argv.includes('--dry-run')

function storagePathFromPublicUrl(publicUrl, bucket) {
  if (!publicUrl) return null
  try {
    const u = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx >= 0) return u.pathname.slice(idx + marker.length) || null

    const marker2 = `/public/${bucket}/`
    const idx2 = u.pathname.indexOf(marker2)
    if (idx2 >= 0) return u.pathname.slice(idx2 + marker2.length) || null
  } catch {
    // ignore malformed URL
  }
  return null
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 1) Build active still path set from DB
  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('polaroid_still_url')

  if (membersErr) throw membersErr

  const activeStillPaths = new Set()
  for (const m of members || []) {
    const p = storagePathFromPublicUrl(m.polaroid_still_url, BUCKET)
    if (p) activeStillPaths.add(p)
  }

  // 2) List all still objects in bucket and delete orphans
  const limit = 100
  let offset = 0
  let removed = 0
  let candidates = 0

  while (true) {
    const { data: objects, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit, offset })

    if (listErr) throw listErr

    if (!objects || objects.length === 0) break

    for (const obj of objects) {
      const name = obj.name
      if (!name) continue

      if (!activeStillPaths.has(name)) {
        candidates++
        if (DRY_RUN) {
          console.log(`[dry-run] Would remove orphaned still: ${name}`)
        } else {
          await supabase.storage.from(BUCKET).remove([name])
          removed++
          console.log(`Removed orphaned still: ${name}`)
        }
      }
    }

    offset += objects.length
    if (objects.length < limit) break
  }

  if (DRY_RUN) {
    console.log(`Dry run complete. Found ${candidates} orphaned still files.`)
  } else {
    console.log(`Cleanup complete. Removed ${removed} orphaned still files.`)
  }
}

main().catch((err) => {
  console.error('cleanup-orphaned-polaroids failed:', err)
  process.exit(1)
})

