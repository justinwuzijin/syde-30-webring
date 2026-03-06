import { NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/token'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = verifyAuthToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
  return NextResponse.json({ user })
}
