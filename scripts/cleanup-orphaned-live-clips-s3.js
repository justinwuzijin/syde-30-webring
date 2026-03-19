/* eslint-disable no-console */
/**
 * Deletes orphaned S3 live clips not referenced by `members.polaroid_live_url`.
 *
 * Run:
 * $env:NEXT_PUBLIC_SUPABASE_URL="..."
 * $env:SUPABASE_SERVICE_ROLE_KEY="..."
 * $env:AWS_ACCESS_KEY_ID="..."
 * $env:AWS_SECRET_ACCESS_KEY="..."
 * $env:AWS_REGION="us-east-1"
 * $env:S3_BUCKET_NAME="syde30webring-778000734037-us-east-1-an"
 * node scripts/cleanup-orphaned-live-clips-s3.js --dry-run
 * node scripts/cleanup-orphaned-live-clips-s3.js
 */

const { createClient } = require('@supabase/supabase-js')
const { S3Client, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const DRY_RUN = process.argv.includes('--dry-run')

function s3KeyFromUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (!u.pathname) return null
    return decodeURIComponent(u.pathname.replace(/^\/+/, ''))
  } catch {
    return null
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const bucket = process.env.S3_BUCKET_NAME
  const region = process.env.AWS_REGION || 'us-east-1'

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Missing S3 env vars')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  const { data: members, error } = await supabase.from('members').select('polaroid_live_url')
  if (error) throw error

  const activeKeys = new Set()
  for (const m of members || []) {
    const k = s3KeyFromUrl(m.polaroid_live_url)
    if (k) activeKeys.add(k)
  }

  let token = undefined
  let removed = 0
  let candidates = 0

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'members/',
        ContinuationToken: token,
      })
    )
    const objects = list.Contents || []
    for (const obj of objects) {
      const key = obj.Key
      if (!key) continue
      if (!activeKeys.has(key)) {
        candidates++
        if (DRY_RUN) {
          console.log(`[dry-run] Would remove orphaned live clip: ${key}`)
        } else {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
          removed++
          console.log(`Removed orphaned live clip: ${key}`)
        }
      }
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined
  } while (token)

  if (DRY_RUN) {
    console.log(`Dry run complete. Found ${candidates} orphaned live clips.`)
  } else {
    console.log(`Cleanup complete. Removed ${removed} orphaned live clips.`)
  }
}

main().catch((err) => {
  console.error('cleanup-orphaned-live-clips-s3 failed:', err)
  process.exit(1)
})

