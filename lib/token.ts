import crypto from 'crypto'

const SECRET = process.env.APPROVAL_SECRET || ''

export function signToken(payload: object): string {
  const data = JSON.stringify({
    payload,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  })
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

export function verifyToken(token: string): { payload: unknown } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf-8')
    ) as { data: string; sig: string }
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(decoded.data)
      .digest('hex')
    if (decoded.sig !== expected) return null
    const parsed = JSON.parse(decoded.data) as { payload: unknown; exp: number }
    if (parsed.exp < Date.now()) return null
    return { payload: parsed.payload }
  } catch {
    return null
  }
}

/** Auth token for logged-in members (7-day expiry) */
export function signAuthToken(payload: { id: string; email: string; name: string }): string {
  return signToken(payload)
}

export function verifyAuthToken(token: string): { id: string; email: string; name: string } | null {
  const result = verifyToken(token)
  if (!result) return null
  const p = result.payload as Record<string, unknown>
  if (typeof p?.id === 'string' && typeof p?.email === 'string' && typeof p?.name === 'string') {
    return { id: p.id, email: p.email, name: p.name }
  }
  return null
}

/** Password reset token (1 hour expiry) */
function signTokenWithExpiry(payload: object, expiryMs: number): string {
  const data = JSON.stringify({ payload, exp: Date.now() + expiryMs })
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

export function signResetToken(email: string): string {
  return signTokenWithExpiry({ email }, 60 * 60 * 1000) // 1 hour
}

export function verifyResetToken(token: string): { email: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf-8')
    ) as { data: string; sig: string }
    const expected = crypto
      .createHmac('sha256', SECRET)
      .update(decoded.data)
      .digest('hex')
    if (decoded.sig !== expected) return null
    const parsed = JSON.parse(decoded.data) as { payload: { email?: string }; exp: number }
    if (parsed.exp < Date.now()) return null
    if (typeof parsed.payload?.email === 'string') {
      return { email: parsed.payload.email }
    }
    return null
  } catch {
    return null
  }
}
