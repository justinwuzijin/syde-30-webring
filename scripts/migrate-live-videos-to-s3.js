/* eslint-disable no-console */
/**
 * One-time migration: move legacy member live clips from Supabase Storage to S3.
 *
 * Usage:
 *   node scripts/migrate-live-videos-to-s3.js --dry-run
 *   node scripts/migrate-live-videos-to-s3.js --migrate
 *   node scripts/migrate-live-videos-to-s3.js --migrate --delete-source
 *
 * Notes:
 * - DB source-of-truth field: members.polaroid_live_url
 * - Legacy source bucket: profile-website-pictures
 * - Destination: S3 bucket from S3_BUCKET_NAME env
 * - Source deletion is optional and only happens after successful upload + DB update.
 */

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3')

const SUPABASE_BUCKET = 'profile-website-pictures'
const DRY_RUN = process.argv.includes('--dry-run')
const DO_MIGRATE = process.argv.includes('--migrate')
const DELETE_SOURCE = process.argv.includes('--delete-source')
const APPLY = DO_MIGRATE && !DRY_RUN

function sanitizeSegment(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function isSupabaseStorageUrl(url) {
  if (!url) return false
  return /\/storage\/v1\/object\/public\//.test(url) || /supabase\.co/i.test(url)
}

function isS3UrlForBucket(url, bucket) {
  if (!url || !bucket) return false
  return (
    url.includes(`https://${bucket}.s3.`) ||
    url.includes(`https://s3.`) && url.includes(`/${bucket}/`) ||
    url.includes(`${bucket}.s3`)
  )
}

function storagePathFromPublicUrl(publicUrl, bucket) {
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
    // ignore
  }
  return null
}

function extFromPath(path) {
  const ext = path.split('.').pop()?.toLowerCase() || 'mp4'
  return ext.replace(/[^a-z0-9]/g, '') || 'mp4'
}

function buildDestinationKey(memberId, sourcePathOrUrl) {
  const seed = sourcePathOrUrl || `${Date.now()}`
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12)
  const sourceName = sourcePathOrUrl.split('/').pop() || 'legacy-live'
  const base = sanitizeSegment(sourceName.replace(/\.[^.]+$/, '')) || 'legacy-live'
  const ext = extFromPath(sourceName)
  return `members/${memberId}/live/migrated-${hash}-${base}.${ext}`
}

function s3PublicUrl(bucket, region, key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

async function objectExistsInS3(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const awsRegion = process.env.AWS_REGION || 'us-east-1'
  const s3Bucket = process.env.S3_BUCKET_NAME
  const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
  const awsSecret = process.env.AWS_SECRET_ACCESS_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!s3Bucket || !awsAccessKeyId || !awsSecret) {
    throw new Error('Missing S3 env vars (S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)')
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  const s3 = new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecret,
    },
  })

  const { data: rows, error } = await supabase
    .from('members')
    .select('id, approved, polaroid_live_url')
    .order('id', { ascending: true })
  if (error) throw error

  let scanned = 0
  let foundSupabaseVideos = 0
  let migrated = 0
  let skipped = 0
  let failures = 0
  let missingSourceObjects = 0
  let sourceDeleted = 0
  const failureRows = []

  console.log('--- Live Video S3 Migration ---')
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : DO_MIGRATE ? 'migrate' : 'audit-only (default)'}`)
  console.log(`Delete source after success: ${DELETE_SOURCE ? 'yes' : 'no'}`)

  for (const row of rows || []) {
    scanned++
    const memberId = row.id
    const liveUrl = row.polaroid_live_url || null

    if (!liveUrl) {
      skipped++
      continue
    }

    if (isS3UrlForBucket(liveUrl, s3Bucket)) {
      skipped++
      continue
    }

    if (!isSupabaseStorageUrl(liveUrl)) {
      failures++
      failureRows.push({ memberId, reason: 'live URL is neither expected Supabase nor target S3', liveUrl })
      continue
    }

    const sourcePath = storagePathFromPublicUrl(liveUrl, SUPABASE_BUCKET)
    if (!sourcePath) {
      failures++
      failureRows.push({ memberId, reason: 'could not parse Supabase source path', liveUrl })
      continue
    }

    foundSupabaseVideos++
    const destKey = buildDestinationKey(memberId, sourcePath)
    const destUrl = s3PublicUrl(s3Bucket, awsRegion, destKey)

    if (!APPLY) {
      console.log(`[dry-run] member=${memberId} source=${sourcePath} -> s3://${s3Bucket}/${destKey}`)
      continue
    }

    try {
      const { data: sourceBlob, error: downloadErr } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(sourcePath)

      if (downloadErr || !sourceBlob) {
        missingSourceObjects++
        failures++
        failureRows.push({
          memberId,
          reason: 'source object missing or download failed',
          sourcePath,
          detail: downloadErr?.message,
        })
        continue
      }

      const bytes = Buffer.from(await sourceBlob.arrayBuffer())
      const contentType = sourceBlob.type || 'video/mp4'

      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: destKey,
          Body: bytes,
          ContentType: contentType,
        })
      )

      const { error: updateErr } = await supabase
        .from('members')
        .update({ polaroid_live_url: destUrl })
        .eq('id', memberId)

      if (updateErr) {
        failures++
        failureRows.push({
          memberId,
          reason: 'DB update failed after S3 upload',
          detail: updateErr.message,
          destKey,
        })
        continue
      }

      migrated++
      console.log(`Migrated member=${memberId} -> ${destUrl}`)

      if (DELETE_SOURCE) {
        const { error: removeErr } = await supabase.storage.from(SUPABASE_BUCKET).remove([sourcePath])
        if (removeErr) {
          failures++
          failureRows.push({
            memberId,
            reason: 'DB updated but old source deletion failed',
            sourcePath,
            detail: removeErr.message,
          })
        } else {
          sourceDeleted++
        }
      }
    } catch (e) {
      failures++
      failureRows.push({
        memberId,
        reason: 'unexpected migration error',
        detail: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Verification pass
  const { data: verifyRows, error: verifyErr } = await supabase
    .from('members')
    .select('id, approved, polaroid_live_url')
    .order('id', { ascending: true })
  if (verifyErr) throw verifyErr

  let stillPointingToSupabase = 0
  let s3MissingObjects = 0
  const verificationIssues = []

  for (const row of verifyRows || []) {
    const memberId = row.id
    const liveUrl = row.polaroid_live_url || null
    if (!liveUrl) continue

    if (isSupabaseStorageUrl(liveUrl)) {
      stillPointingToSupabase++
      verificationIssues.push({ memberId, reason: 'still points to Supabase', liveUrl })
      continue
    }

    if (isS3UrlForBucket(liveUrl, s3Bucket)) {
      let key = null
      try {
        key = decodeURIComponent(new URL(liveUrl).pathname.replace(/^\/+/, ''))
      } catch {
        key = null
      }
      if (!key) {
        verificationIssues.push({ memberId, reason: 'malformed S3 URL', liveUrl })
        continue
      }
      const exists = await objectExistsInS3(s3, s3Bucket, key)
      if (!exists) {
        s3MissingObjects++
        verificationIssues.push({ memberId, reason: 'DB points to missing S3 object', key, liveUrl })
      }
    }
  }

  console.log('\n--- Migration Summary ---')
  console.log(`Rows scanned: ${scanned}`)
  console.log(`Supabase videos found: ${foundSupabaseVideos}`)
  console.log(`Videos migrated: ${migrated}`)
  console.log(`Rows skipped: ${skipped}`)
  console.log(`Failures: ${failures}`)
  console.log(`Missing source objects: ${missingSourceObjects}`)
  console.log(`Old Supabase sources deleted: ${sourceDeleted}`)
  console.log(`Verification: rows still pointing to Supabase: ${stillPointingToSupabase}`)
  console.log(`Verification: DB rows pointing to missing S3 objects: ${s3MissingObjects}`)

  if (failureRows.length > 0) {
    console.log('\n--- Failure Rows ---')
    for (const item of failureRows) console.log(JSON.stringify(item))
  }

  if (verificationIssues.length > 0) {
    console.log('\n--- Verification Issues ---')
    for (const item of verificationIssues) console.log(JSON.stringify(item))
  }
}

main().catch((err) => {
  console.error('migrate-live-videos-to-s3 failed:', err)
  process.exit(1)
})

