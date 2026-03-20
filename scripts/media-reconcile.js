/* eslint-disable no-console */
/**
 * Unified production media reconciliation:
 * - Supabase Storage: keep only active still-photo objects
 * - S3: keep only active live-clip objects
 * - Audit DB references for malformed/misplaced/missing objects
 *
 * Usage:
 *   node scripts/media-reconcile.js --dry-run
 *   node scripts/media-reconcile.js --cleanup
 *   node scripts/media-reconcile.js --audit-only
 */

const { createClient } = require('@supabase/supabase-js')
const {
  S3Client,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3')

const SUPABASE_STILL_BUCKET = 'profile-website-pictures'
const S3_PREFIX = 'members/'

const DRY_RUN = process.argv.includes('--dry-run')
const CLEANUP = process.argv.includes('--cleanup')
const AUDIT_ONLY = process.argv.includes('--audit-only')
const APPLY_DELETES = CLEANUP && !DRY_RUN && !AUDIT_ONLY

function parseSupabaseStillPathFromUrl(publicUrl, bucket) {
  if (!publicUrl) return null
  try {
    const u = new URL(publicUrl)
    const marker = `/storage/v1/object/public/${bucket}/`
    const idx = u.pathname.indexOf(marker)
    if (idx >= 0) return decodeURIComponent(u.pathname.slice(idx + marker.length)) || null
    const marker2 = `/public/${bucket}/`
    const idx2 = u.pathname.indexOf(marker2)
    if (idx2 >= 0) return decodeURIComponent(u.pathname.slice(idx2 + marker2.length)) || null
  } catch {
    return null
  }
  return null
}

function parseS3KeyFromUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.replace(/^\/+/, '')) || null
  } catch {
    return null
  }
}

function isLikelySupabaseStorageUrl(url) {
  if (!url) return false
  return /\/storage\/v1\/object\/public\//.test(url) || /supabase\.co/i.test(url)
}

function isLikelyS3Url(url, bucket) {
  if (!url) return false
  return url.includes(`https://${bucket}.s3.`) || url.includes(`https://s3.`) || url.includes(`${bucket}.s3`)
}

async function listAllSupabaseObjects(supabase, bucket) {
  const allFiles = []
  const queue = ['']
  const limit = 100

  while (queue.length > 0) {
    const prefix = queue.shift()
    let offset = 0
    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset })
      if (error) throw error
      const entries = data || []
      if (entries.length === 0) break

      for (const entry of entries) {
        if (!entry || !entry.name) continue
        const currentPath = prefix ? `${prefix}/${entry.name}` : entry.name

        // Supabase returns folders with null-ish id/metadata; files have metadata/id.
        const isFolder = !entry.id && !entry.metadata
        if (isFolder) queue.push(currentPath)
        else allFiles.push(currentPath)
      }

      offset += entries.length
      if (entries.length < limit) break
    }
  }

  return allFiles
}

async function listAllS3Objects(s3, bucket, prefix) {
  const allKeys = []
  let token = undefined
  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    )
    const objects = list.Contents || []
    for (const obj of objects) if (obj.Key) allKeys.push(obj.Key)
    token = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (token)
  return allKeys
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const awsRegion = process.env.AWS_REGION || 'us-east-1'
  const s3Bucket = process.env.S3_BUCKET_NAME
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!s3Bucket || !awsAccessKeyId || !awsSecret) {
    throw new Error('Missing S3 env vars (S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const s3 = new S3Client({
    region: awsRegion,
    credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecret },
  })

  console.log('--- Media Reconciliation ---')
  console.log(`Mode: ${AUDIT_ONLY ? 'audit-only' : DRY_RUN ? 'dry-run' : CLEANUP ? 'cleanup' : 'audit-only (default)'}`)
  console.log(`Supabase bucket: ${SUPABASE_STILL_BUCKET}`)
  console.log(`S3 bucket: ${s3Bucket}`)
  console.log(`S3 prefix: ${S3_PREFIX}`)

  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('id, approved, polaroid_still_url, polaroid_live_url')
  if (membersErr) throw membersErr

  const activeMembers = (members || []).filter((m) => m.approved !== false)
  const activeStillPaths = new Set()
  const activeLiveKeys = new Set()
  const mismatches = []

  for (const m of activeMembers) {
    const stillUrl = m.polaroid_still_url || null
    const liveUrl = m.polaroid_live_url || null

    if (stillUrl) {
      const stillPath = parseSupabaseStillPathFromUrl(stillUrl, SUPABASE_STILL_BUCKET)
      if (!stillPath) {
        mismatches.push({
          memberId: m.id,
          type: 'DB_STILL_URL_MALFORMED_OR_NOT_SUPABASE',
          url: stillUrl,
        })
      } else {
        activeStillPaths.add(stillPath)
      }
    }

    if (!liveUrl) {
      mismatches.push({ memberId: m.id, type: 'DB_LIVE_URL_MISSING' })
    } else {
      if (isLikelySupabaseStorageUrl(liveUrl)) {
        mismatches.push({
          memberId: m.id,
          type: 'DB_LIVE_URL_POINTS_TO_SUPABASE_INVALID',
          url: liveUrl,
        })
      }
      if (!isLikelyS3Url(liveUrl, s3Bucket)) {
        mismatches.push({
          memberId: m.id,
          type: 'DB_LIVE_URL_NOT_IN_EXPECTED_S3_BUCKET',
          url: liveUrl,
        })
      }
      const liveKey = parseS3KeyFromUrl(liveUrl)
      if (!liveKey) {
        mismatches.push({
          memberId: m.id,
          type: 'DB_LIVE_URL_MALFORMED',
          url: liveUrl,
        })
      } else {
        activeLiveKeys.add(liveKey)
      }
    }
  }

  const supabaseObjects = await listAllSupabaseObjects(supabase, SUPABASE_STILL_BUCKET)
  const s3Objects = await listAllS3Objects(s3, s3Bucket, S3_PREFIX)
  const supabaseObjectSet = new Set(supabaseObjects)
  const s3ObjectSet = new Set(s3Objects)

  // Existence audit for DB references
  for (const p of activeStillPaths) {
    if (!supabaseObjectSet.has(p)) {
      mismatches.push({ type: 'DB_STILL_PATH_MISSING_IN_SUPABASE', path: p })
    }
  }
  for (const key of activeLiveKeys) {
    if (!s3ObjectSet.has(key)) {
      // Confirm via HEAD for eventual consistency edge-cases
      let exists = false
      try {
        await s3.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: key }))
        exists = true
      } catch {
        exists = false
      }
      if (!exists) mismatches.push({ type: 'DB_LIVE_KEY_MISSING_IN_S3', key })
    }
  }

  // Cleanup candidates
  const supabaseDeleteCandidates = supabaseObjects.filter((p) => !activeStillPaths.has(p))
  const s3DeleteCandidates = s3Objects.filter((k) => !activeLiveKeys.has(k))

  let supabaseDeleted = 0
  let s3Deleted = 0

  if (AUDIT_ONLY) {
    console.log('Audit-only mode: no deletes will be performed.')
  } else {
    for (const p of supabaseDeleteCandidates) {
      if (!APPLY_DELETES) {
        console.log(`[dry-run] Supabase delete candidate: ${p}`)
      } else {
        await supabase.storage.from(SUPABASE_STILL_BUCKET).remove([p])
        supabaseDeleted++
        console.log(`Deleted Supabase orphan still: ${p}`)
      }
    }

    for (const key of s3DeleteCandidates) {
      if (!APPLY_DELETES) {
        console.log(`[dry-run] S3 delete candidate: ${key}`)
      } else {
        await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }))
        s3Deleted++
        console.log(`Deleted S3 orphan live clip: ${key}`)
      }
    }
  }

  console.log('\n--- Reconciliation Summary ---')
  console.log(`Active members scanned: ${activeMembers.length}`)
  console.log(`Active still references found: ${activeStillPaths.size}`)
  console.log(`Active live references found: ${activeLiveKeys.size}`)
  console.log(`Supabase objects scanned: ${supabaseObjects.length}`)
  console.log(`S3 objects scanned: ${s3Objects.length}`)
  console.log(`Supabase delete candidates: ${supabaseDeleteCandidates.length}`)
  console.log(`S3 delete candidates: ${s3DeleteCandidates.length}`)
  console.log(`Supabase objects deleted: ${supabaseDeleted}`)
  console.log(`S3 objects deleted: ${s3Deleted}`)
  console.log(`Mismatches found: ${mismatches.length}`)

  if (mismatches.length > 0) {
    console.log('\n--- Mismatch Report ---')
    for (const m of mismatches) console.log(JSON.stringify(m))
  }
}

main().catch((err) => {
  console.error('media-reconcile failed:', err)
  process.exit(1)
})

