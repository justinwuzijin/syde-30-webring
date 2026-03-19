/* eslint-disable no-console */
/**
 * Deletes storage objects in `profile-website-pictures` that are not referenced by any
 * member row's `polaroid_still_url` / `polaroid_live_url`.
 *
 * Run manually:
 * $env:NEXT_PUBLIC_SUPABASE_URL="insert_key"
 * $env:SUPABASE_SERVICE_ROLE_KEY="insert_key"
 * node scripts/cleanup-orphaned-polaroids.js
 * 
 */

const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'profile-website-pictures'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // 1) Build active URL set from DB
  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('polaroid_still_url, polaroid_live_url')

  if (membersErr) throw membersErr

  const activeUrls = new Set()
  for (const m of members || []) {
    if (m.polaroid_still_url) activeUrls.add(m.polaroid_still_url)
    if (m.polaroid_live_url) activeUrls.add(m.polaroid_live_url)
  }

  // 2) List all objects in bucket and delete orphans
  const limit = 100
  let offset = 0
  let removed = 0

  // We assume all objects are stored at bucket root (flat names).
  // If you introduce subfolders later, change `path` to the appropriate prefix.
  while (true) {
    const { data: objects, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list('', { limit, offset })

    if (listErr) throw listErr

    if (!objects || objects.length === 0) break

    for (const obj of objects) {
      const name = obj.name
      if (!name) continue

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(name)
      const publicUrl = publicUrlData?.publicUrl
      if (!publicUrl) continue

      if (!activeUrls.has(publicUrl)) {
        await supabase.storage.from(BUCKET).remove([name])
        removed++
        console.log(`Removed orphaned media: ${name}`)
      }
    }

    offset += objects.length
    if (objects.length < limit) break
  }

  console.log(`Cleanup complete. Removed ${removed} orphaned files.`)
}

main().catch((err) => {
  console.error('cleanup-orphaned-polaroids failed:', err)
  process.exit(1)
})

