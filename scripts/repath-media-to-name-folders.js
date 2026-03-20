/* eslint-disable no-console */
/**
 * Repath media objects for better traceability.
 *
 * - Supabase stills (bucket: profile-website-pictures):
 *   members/{uuid}/still/{file} -> members/{first-last}-{uuid}/still/{first-last}-{file}
 *   and updates members.polaroid_still_url (+ profile_picture_url).
 *
 * - S3 live clips (bucket: $S3_BUCKET_NAME):
 *   members/{uuid}/live/{file} -> members/{first-last}-{uuid}/live/{first-last}-{file}
 *   and updates members.polaroid_live_url.
 *
 * Usage:
 *   node scripts/repath-media-to-name-folders.js --dry-run
 *   node scripts/repath-media-to-name-folders.js --apply
 *   node scripts/repath-media-to-name-folders.js --apply --keep-source
 *
 * Notes:
 * - When applying, the script deletes source objects after the DB update succeeds
 *   to avoid leaving extra S3/Supabase "member folders" behind.
 */

const crypto = require('crypto')
const { createClient } = require('@supabase/supabase-js')
const {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3')

const SUPABASE_STILL_BUCKET = 'profile-website-pictures'
const DRY_RUN = !process.argv.includes('--apply')
const APPLY = process.argv.includes('--apply')
const KEEP_SOURCE = process.argv.includes('--keep-source')
const DELETE_SOURCE = APPLY && !KEEP_SOURCE

const APPROVED_ONLY = !process.argv.includes('--no-approved-only')
const INCLUDE_PENDING = !process.argv.includes('--no-pending')
const INCLUDE_EXPIRED_PENDING = process.argv.includes('--include-expired-pending')
const DO_ORPHAN_CLEANUP = !process.argv.includes('--no-orphan-cleanup')

function sanitizeSegment(input) {
  return (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function deriveFirstLastSlug(name) {
  const n = (name || '').trim().replace(/\s+/g, ' ')
  if (!n) return 'member'
  const parts = n.split(' ').filter(Boolean)
  const first = parts[0] || 'member'
  const last = parts[parts.length - 1] || first
  const joined = `${first}-${last}`
  const slug = sanitizeSegment(joined)
  return slug || 'member'
}

function pendingMemberIdFromEmail(email) {
  const normalized = (email || '').trim().toLowerCase()
  const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `pending-${digest}`
}

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
    // ignore
  }
  return null
}

function parseS3KeyFromUrl(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.replace(/^\/+/, '')) || null
  } catch {
    // ignore
  }
  return null
}

function s3PublicUrl(bucket, region, key) {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

function parseExpectedMembersPath(pathOrKey, expectedType) {
  // expected format:
  //  - still: members/{uuid}/still/{filename}
  //  - live:  members/{uuid}/live/{filename}
  const parts = (pathOrKey || '').split('/').filter(Boolean)
  if (parts.length < 4) return null
  if (parts[0] !== 'members') return null
  if (parts[2] !== expectedType) return null
  const memberId = parts[1]
  const fileName = parts.slice(3).join('/')
  return { memberId, fileName, expectedType }
}

function ensureFilePrefixed(fileName, firstLastSlug) {
  const prefix = `${firstLastSlug}-`
  if (fileName.startsWith(prefix)) return fileName
  return `${prefix}${fileName}`
}

function buildNewSupabaseStillPath(oldStillPath, memberId, firstLastSlug) {
  const expectedMemberSegment = `${firstLastSlug}-${memberId}`
  const parsed = parseExpectedMembersPath(oldStillPath, 'still')

  if (parsed) {
    const oldFileName = parsed.fileName
    const newFileName = ensureFilePrefixed(oldFileName, firstLastSlug)
    const alreadyCorrect =
      parsed.memberId === expectedMemberSegment && newFileName === oldFileName
    if (alreadyCorrect) return oldStillPath
    return `members/${expectedMemberSegment}/still/${newFileName}`
  }

  // Fallback: sometimes Supabase still keys are stored as just a filename.
  const oldFileName = (oldStillPath || '').split('/').filter(Boolean).pop() || 'still'
  const newFileName = ensureFilePrefixed(oldFileName, firstLastSlug)
  return `members/${expectedMemberSegment}/still/${newFileName}`
}

function buildNewS3LiveKey(oldLiveKey, memberId, firstLastSlug) {
  const expectedMemberSegment = `${firstLastSlug}-${memberId}`
  const parsed = parseExpectedMembersPath(oldLiveKey, 'live')

  if (parsed) {
    const oldFileName = parsed.fileName
    const newFileName = ensureFilePrefixed(oldFileName, firstLastSlug)
    const alreadyCorrect =
      parsed.memberId === expectedMemberSegment && newFileName === oldFileName
    if (alreadyCorrect) return oldLiveKey
    return `members/${expectedMemberSegment}/live/${newFileName}`
  }

  // Fallback for unexpected key formats
  const oldFileName = (oldLiveKey || '').split('/').filter(Boolean).pop() || 'live'
  const newFileName = ensureFilePrefixed(oldFileName, firstLastSlug)
  return `members/${expectedMemberSegment}/live/${newFileName}`
}

async function s3KeyExists(s3, bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch {
    return false
  }
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
    credentials: { accessKeyId: awsAccessKeyId, secretAccessKey: awsSecret },
  })

  console.log('--- Repath Media: Name Folders ---')
  console.log(`Mode: ${DRY_RUN ? 'dry-run' : 'apply'}`)
  console.log(`Delete source: ${APPLY && DELETE_SOURCE ? 'yes' : 'no'}`)
  console.log(`Approved only: ${APPROVED_ONLY ? 'yes' : 'no'}`)

  const membersQuery = supabase
    .from('members')
    .select('id, name, approved, polaroid_still_url, polaroid_live_url, profile_picture_url')
  if (APPROVED_ONLY) membersQuery.eq('approved', true)
  const { data: members, error: membersErr } = await membersQuery.order('joined_at', { ascending: true })
  if (membersErr) throw membersErr

  let scanned = 0
  let movedStill = 0
  let movedLive = 0
  let updatedDb = 0
  let failures = 0

  let pendingScanned = 0
  let pendingMovedStill = 0
  let pendingMovedLive = 0
  let pendingUpdatedDb = 0

  for (const m of members || []) {
    scanned++
    const memberId = m.id
    const name = m.name || ''
    const firstLastSlug = deriveFirstLastSlug(name)

    const stillUrl = m.polaroid_still_url || null
    const liveUrl = m.polaroid_live_url || null

    let stillUpdates = null
    let liveUpdates = null

    if (stillUrl) {
      const oldStillPath = parseSupabaseStillPathFromUrl(stillUrl, SUPABASE_STILL_BUCKET)
      if (!oldStillPath) {
        failures++
        console.log(`[fail still url parse] member=${memberId} stillUrl=${stillUrl}`)
      } else {
        const newStillPath = buildNewSupabaseStillPath(oldStillPath, memberId, firstLastSlug)
        if (!newStillPath) {
          failures++
          console.log(`[fail still path build] member=${memberId} old=${oldStillPath}`)
        } else if (newStillPath !== oldStillPath) {
          const newStillUrl = supabase.storage.from(SUPABASE_STILL_BUCKET).getPublicUrl(newStillPath).data.publicUrl
          stillUpdates = { oldStillPath, newStillPath, newStillUrl }
        }
      }
    }

    if (liveUrl) {
      const oldLiveKey = parseS3KeyFromUrl(liveUrl)
      if (!oldLiveKey) {
        failures++
        console.log(`[fail live url parse] member=${memberId} liveUrl=${liveUrl}`)
      } else {
        const newLiveKey = buildNewS3LiveKey(oldLiveKey, memberId, firstLastSlug)
        if (!newLiveKey) {
          failures++
          console.log(`[fail live key build] member=${memberId} old=${oldLiveKey}`)
        } else if (newLiveKey !== oldLiveKey) {
          const newLiveUrl = s3PublicUrl(s3Bucket, awsRegion, newLiveKey)
          liveUpdates = { oldLiveKey, newLiveKey, newLiveUrl }
        }
      }
    }

    if (!stillUpdates && !liveUpdates) continue

    console.log(`[member] ${name} (${memberId}) firstLast=${firstLastSlug}`)
    if (stillUpdates) {
      console.log(`  still: ${stillUpdates.oldStillPath} -> ${stillUpdates.newStillPath}`)
    }
    if (liveUpdates) {
      console.log(`  live:  ${liveUpdates.oldLiveKey} -> ${liveUpdates.newLiveKey}`)
    }

    if (DRY_RUN) continue

    // 1) Move stills (Supabase)
    if (stillUpdates) {
      const { data: sourceBlob, error: downloadErr } = await supabase.storage
        .from(SUPABASE_STILL_BUCKET)
        .download(stillUpdates.oldStillPath)

      if (downloadErr || !sourceBlob) {
        failures++
        console.log(`  [fail download still] ${stillUpdates.oldStillPath}: ${downloadErr?.message || 'missing sourceBlob'}`)
      } else {
        const { data: destBlob, error: destErr } = await supabase.storage
          .from(SUPABASE_STILL_BUCKET)
          .download(stillUpdates.newStillPath)
        const existingDest = !!destBlob && !destErr

        if (!existingDest) {
          const bytes = Buffer.from(await sourceBlob.arrayBuffer())
          const contentType = sourceBlob.type || 'image/jpeg'
          const { error: uploadErr } = await supabase.storage
            .from(SUPABASE_STILL_BUCKET)
            .upload(stillUpdates.newStillPath, bytes, { contentType, upsert: false })

          if (uploadErr) {
            failures++
            console.log(`  [fail upload still] ${stillUpdates.newStillPath}: ${uploadErr.message}`)
            stillUpdates = null
          } else {
            movedStill++
          }
        } else {
          // Destination exists; assume it is already migrated.
        }
      }
    }

    // 2) Move live clips (S3)
    if (liveUpdates) {
      const destExists = await s3KeyExists(s3, s3Bucket, liveUpdates.newLiveKey)

      if (!destExists) {
        const copySource = `${s3Bucket}/${liveUpdates.oldLiveKey}`
        await s3.send(
          new CopyObjectCommand({
            Bucket: s3Bucket,
            Key: liveUpdates.newLiveKey,
            CopySource: copySource,
            MetadataDirective: 'COPY',
          })
        )
        const verified = await s3KeyExists(s3, s3Bucket, liveUpdates.newLiveKey)
        if (!verified) {
          failures++
          console.log(`  [fail verify copied live] ${liveUpdates.newLiveKey}`)
          liveUpdates = null
        } else {
          movedLive++
        }
      } else {
        // Destination exists; assume it is already migrated.
      }
    }

    if (!stillUpdates && !liveUpdates) continue

    // 3) Update DB
    const updates = {}
    if (stillUpdates) {
      updates.polaroid_still_url = stillUpdates.newStillUrl
      updates.profile_picture_url = stillUpdates.newStillUrl
    }
    if (liveUpdates) {
      updates.polaroid_live_url = liveUpdates.newLiveUrl
    }

    const { error: updateErr } = await supabase.from('members').update(updates).eq('id', memberId)
    if (updateErr) {
      failures++
      console.log(`  [fail db update] member=${memberId}: ${updateErr.message}`)
      continue
    }

    updatedDb++

    // 4) Delete source only after DB update succeeded
    if (APPLY && DELETE_SOURCE) {
      if (stillUpdates && stillUpdates.oldStillPath) {
        const { error: removeErr } = await supabase.storage.from(SUPABASE_STILL_BUCKET).remove([stillUpdates.oldStillPath])
        if (removeErr) console.log(`  [warn delete still source failed] ${stillUpdates.oldStillPath}: ${removeErr.message}`)
      }
      if (liveUpdates && liveUpdates.oldLiveKey) {
        await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: liveUpdates.oldLiveKey }))
      }
    }
  }

  // ── Pending signups (not yet inserted into members) ──
  if (INCLUDE_PENDING) {
    const pendingQueryBase = supabase
      .from('pending_signups')
      .select('id,email,payload,code_expires_at,polaroid_still_path,polaroid_live_path,created_at')
      .order('created_at', { ascending: true })

    const nowIso = new Date().toISOString()
    const pendingQuery = INCLUDE_EXPIRED_PENDING ? pendingQueryBase : pendingQueryBase.gt('code_expires_at', nowIso)
    const { data: pendingRows, error: pendingErr } = await pendingQuery
    if (pendingErr) throw pendingErr

    for (const p of pendingRows || []) {
      pendingScanned++
      const pendingId = p.id
      const email = p.email
      const payload = p.payload || {}
      const name = payload.name || ''
      const firstLastSlug = deriveFirstLastSlug(name)
      const pendingMemberId = pendingMemberIdFromEmail(email)

      const oldStillPath = p.polaroid_still_path || null
      const oldLiveKey = p.polaroid_live_path || null

      let stillUpdates = null
      let liveUpdates = null

      if (oldStillPath) {
        const newStillPath = buildNewSupabaseStillPath(oldStillPath, pendingMemberId, firstLastSlug)
        if (newStillPath !== oldStillPath) {
          const newStillUrl = supabase.storage.from(SUPABASE_STILL_BUCKET).getPublicUrl(newStillPath).data.publicUrl
          stillUpdates = { oldStillPath, newStillPath, newStillUrl }
        }
      }

      if (oldLiveKey) {
        const newLiveKey = buildNewS3LiveKey(oldLiveKey, pendingMemberId, firstLastSlug)
        if (newLiveKey !== oldLiveKey) {
          const newLiveUrl = s3PublicUrl(s3Bucket, awsRegion, newLiveKey)
          liveUpdates = { oldLiveKey, newLiveKey, newLiveUrl }
        }
      }

      if (!stillUpdates && !liveUpdates) continue

      console.log(`[pending] ${name} (${pendingId}) firstLast=${firstLastSlug}`)
      if (stillUpdates) console.log(`  still: ${stillUpdates.oldStillPath} -> ${stillUpdates.newStillPath}`)
      if (liveUpdates) console.log(`  live:  ${liveUpdates.oldLiveKey} -> ${liveUpdates.newLiveKey}`)

      if (DRY_RUN) continue

      // 1) Move stills (Supabase)
      if (stillUpdates) {
        const { data: sourceBlob, error: downloadErr } = await supabase.storage
          .from(SUPABASE_STILL_BUCKET)
          .download(stillUpdates.oldStillPath)

        if (downloadErr || !sourceBlob) {
          failures++
          console.log(`  [fail download pending still] ${stillUpdates.oldStillPath}: ${downloadErr?.message || 'missing sourceBlob'}`)
          stillUpdates = null
        } else {
          const { data: destBlob, error: destErr } = await supabase.storage
            .from(SUPABASE_STILL_BUCKET)
            .download(stillUpdates.newStillPath)
          const existingDest = !!destBlob && !destErr

          if (!existingDest) {
            const bytes = Buffer.from(await sourceBlob.arrayBuffer())
            const contentType = sourceBlob.type || 'image/jpeg'
            const { error: uploadErr } = await supabase.storage
              .from(SUPABASE_STILL_BUCKET)
              .upload(stillUpdates.newStillPath, bytes, { contentType, upsert: false })

            if (uploadErr) {
              failures++
              console.log(`  [fail upload pending still] ${stillUpdates.newStillPath}: ${uploadErr.message}`)
              stillUpdates = null
            } else {
              pendingMovedStill++
            }
          }
        }
      }

      // 2) Move live clips (S3)
      if (liveUpdates) {
        const destExists = await s3KeyExists(s3, s3Bucket, liveUpdates.newLiveKey)

        if (!destExists) {
          const copySource = `${s3Bucket}/${liveUpdates.oldLiveKey}`
          await s3.send(
            new CopyObjectCommand({
              Bucket: s3Bucket,
              Key: liveUpdates.newLiveKey,
              CopySource: copySource,
              MetadataDirective: 'COPY',
            })
          )

          const verified = await s3KeyExists(s3, s3Bucket, liveUpdates.newLiveKey)
          if (!verified) {
            failures++
            console.log(`  [fail verify copied pending live] ${liveUpdates.newLiveKey}`)
            liveUpdates = null
          } else {
            pendingMovedLive++
          }
        }
      }

      if (!stillUpdates && !liveUpdates) continue

      // 3) Update pending DB
      const normalizedName = String(name || '')
        .trim()
        .replace(/\s+/g, ' ')

      const newPayload = { ...payload, name: normalizedName }
      if (stillUpdates) newPayload.polaroid_still_url = stillUpdates.newStillUrl
      if (liveUpdates) newPayload.polaroid_live_url = liveUpdates.newLiveUrl

      const updates = { payload: newPayload }
      if (stillUpdates) updates.polaroid_still_path = stillUpdates.newStillPath
      if (liveUpdates) updates.polaroid_live_path = liveUpdates.newLiveKey

      const { error: updateErr } = await supabase
        .from('pending_signups')
        .update(updates)
        .eq('id', pendingId)

      if (updateErr) {
        failures++
        console.log(`  [fail db update pending] pendingId=${pendingId}: ${updateErr.message}`)
        continue
      }

      pendingUpdatedDb++

      // 4) Delete sources only after DB update succeeds
      if (APPLY && DELETE_SOURCE) {
        if (stillUpdates && stillUpdates.oldStillPath) {
          const { error: removeErr } = await supabase.storage.from(SUPABASE_STILL_BUCKET).remove([stillUpdates.oldStillPath])
          if (removeErr) console.log(`  [warn delete pending still source failed] ${stillUpdates.oldStillPath}: ${removeErr.message}`)
        }
        if (liveUpdates && liveUpdates.oldLiveKey) {
          await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: liveUpdates.oldLiveKey }))
        }
      }
    }
  }

  // ── Orphan cleanup (so we don't accumulate extra prefixes over time) ──
  if (DO_ORPHAN_CLEANUP) {
    const nowIso = new Date().toISOString()

    const { data: membersForCleanup, error: membersCleanupErr } = await supabase
      .from('members')
      .select('polaroid_still_url,polaroid_live_url')
      .eq('approved', true)

    if (membersCleanupErr) throw membersCleanupErr

    const activeStillPaths = new Set()
    const activeLiveKeys = new Set()

    for (const m of membersForCleanup || []) {
      const p = parseSupabaseStillPathFromUrl(m.polaroid_still_url, SUPABASE_STILL_BUCKET)
      if (p) activeStillPaths.add(p)
      const k = parseS3KeyFromUrl(m.polaroid_live_url)
      if (k) activeLiveKeys.add(k)
    }

    if (INCLUDE_PENDING) {
      const pendingCleanupQueryBase = supabase
        .from('pending_signups')
        .select('code_expires_at,polaroid_still_path,polaroid_live_path,email,payload')

      const pendingCleanupQuery = INCLUDE_EXPIRED_PENDING ? pendingCleanupQueryBase : pendingCleanupQueryBase.gt('code_expires_at', nowIso)
      const { data: pendingForCleanup, error: pendingCleanupErr } = await pendingCleanupQuery
      if (pendingCleanupErr) throw pendingCleanupErr

      for (const p of pendingForCleanup || []) {
        if (p.polaroid_still_path) activeStillPaths.add(p.polaroid_still_path)
        if (p.polaroid_live_path) activeLiveKeys.add(p.polaroid_live_path)
      }
    }

    console.log('\n--- Orphan cleanup (active: members approved + pending signups) ---')

    // S3 live clips
    const s3Objects = await listAllS3Objects(s3, s3Bucket, 'members/')
    let liveOrphans = 0
    let liveRemoved = 0
    for (const key of s3Objects) {
      if (!activeLiveKeys.has(key)) {
        liveOrphans++
        if (!DRY_RUN) {
          await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: key }))
          liveRemoved++
        }
      }
    }
    console.log(`S3 orphan live clips: ${liveOrphans}${DRY_RUN ? ' (dry-run)' : `, removed ${liveRemoved}`}`)

    // Supabase stills
    const supabaseObjects = await listAllSupabaseObjects(supabase, SUPABASE_STILL_BUCKET)
    let stillOrphans = 0
    let stillRemoved = 0
    for (const objKey of supabaseObjects) {
      if (!activeStillPaths.has(objKey)) {
        stillOrphans++
        if (!DRY_RUN) {
          const { error: removeErr } = await supabase.storage.from(SUPABASE_STILL_BUCKET).remove([objKey])
          if (removeErr) {
            failures++
            console.log(`  [warn remove orphan still failed] ${objKey}: ${removeErr.message}`)
          } else {
            stillRemoved++
          }
        }
      }
    }
    console.log(
      `Supabase orphan stills: ${stillOrphans}${DRY_RUN ? ' (dry-run)' : `, removed ${stillRemoved}`}`
    )
  }

  console.log('\n--- Summary ---')
  console.log(`Members scanned: ${scanned}`)
  console.log(`Still moved/uploaded: ${movedStill}`)
  console.log(`Live copied: ${movedLive}`)
  console.log(`DB rows updated: ${updatedDb}`)
  if (INCLUDE_PENDING) {
    console.log(`Pending scanned: ${pendingScanned}`)
    console.log(`Pending still moved/uploaded: ${pendingMovedStill}`)
    console.log(`Pending live copied: ${pendingMovedLive}`)
    console.log(`Pending DB rows updated: ${pendingUpdatedDb}`)
  }
  console.log(`Failures: ${failures}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

