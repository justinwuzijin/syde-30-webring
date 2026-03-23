/* eslint-disable no-console */
/**
 * Deletes all pending signups:
 * - Removes their still images from Supabase storage (profile-website-pictures)
 * - Removes their live videos from S3
 * - Deletes all rows from pending_signups
 *
 * Run:
 * $env:NEXT_PUBLIC_SUPABASE_URL="..."
 * $env:SUPABASE_SERVICE_ROLE_KEY="..."
 * $env:AWS_ACCESS_KEY_ID="..."
 * $env:AWS_SECRET_ACCESS_KEY="..."
 * $env:AWS_REGION="us-east-1"
 * $env:S3_BUCKET_NAME="your-bucket-name"
 * node scripts/delete-all-pending-signups.js --dry-run
 * node scripts/delete-all-pending-signups.js
 */

const { createClient } = require('@supabase/supabase-js')
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const BUCKET = 'profile-website-pictures'
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const s3Bucket = process.env.S3_BUCKET_NAME
  const region = process.env.AWS_REGION || 'us-east-1'

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  let s3Client = null
  const hasS3 =
    s3Bucket &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY
  if (hasS3) {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  } else {
    console.warn('S3 env vars not set — will skip live video deletion. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME.')
  }

  const { data: pending, error: fetchErr } = await supabase
    .from('pending_signups')
    .select('id, email, polaroid_still_path, polaroid_live_path')

  if (fetchErr) throw fetchErr
  const count = pending?.length ?? 0
  if (count === 0) {
    console.log('No pending signups to delete.')
    return
  }

  console.log(`Found ${count} pending signup(s).`)
  if (DRY_RUN) {
    console.log('[dry-run] Would delete the following:')
    for (const p of pending) {
      console.log(`  - ${p.email}: still=${p.polaroid_still_path || '(none)'}, live=${p.polaroid_live_path || '(none)'}`)
    }
    console.log('[dry-run] Run without --dry-run to execute.')
    return
  }

  let stillsRemoved = 0
  let livesRemoved = 0

  for (const p of pending) {
    if (p.polaroid_still_path) {
      const { error: removeErr } = await supabase.storage
        .from(BUCKET)
        .remove([p.polaroid_still_path])
      if (removeErr) {
        console.error(`Failed to remove still ${p.polaroid_still_path}:`, removeErr.message)
      } else {
        stillsRemoved++
        console.log(`Removed still: ${p.polaroid_still_path}`)
      }
    }
    if (p.polaroid_live_path && s3Client) {
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: s3Bucket,
            Key: p.polaroid_live_path,
          })
        )
        livesRemoved++
        console.log(`Removed live: ${p.polaroid_live_path}`)
      } catch (err) {
        console.error(`Failed to remove live ${p.polaroid_live_path}:`, err.message)
      }
    }
  }

  const ids = pending.map((p) => p.id)
  const { error: deleteErr } = await supabase.from('pending_signups').delete().in('id', ids)
  if (deleteErr) throw deleteErr

  console.log(`Done. Deleted ${count} pending signup(s), ${stillsRemoved} still(s), ${livesRemoved} live video(s).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
