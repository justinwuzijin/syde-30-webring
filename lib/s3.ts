import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { S3_LIVE_BUCKET, S3_REGION } from './media-storage'

let _s3Client: S3Client | null = null

export function getS3Client(): S3Client {
  if (!_s3Client) {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !S3_LIVE_BUCKET) {
      throw new Error('AWS S3 env vars are not fully configured')
    }
    _s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  }
  return _s3Client
}

export async function createLiveClipPresignedPutUrl(params: {
  key: string
  contentType: string
  expiresInSeconds?: number
}) {
  const s3 = getS3Client()
  const command = new PutObjectCommand({
    Bucket: S3_LIVE_BUCKET,
    Key: params.key,
    ContentType: params.contentType || 'video/mp4',
    // MVP: public-read simplifies direct playback from stored URL.
    ACL: 'public-read',
  })
  const url = await getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds ?? 300 })
  return url
}

export async function deleteLiveClipByKey(key: string) {
  if (!key) return
  const s3 = getS3Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_LIVE_BUCKET,
      Key: key,
    })
  )
}

