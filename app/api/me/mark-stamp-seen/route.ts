import { NextResponse } from 'next/server'
import { verifyAuthToken } from '@/lib/token'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = verifyAuthToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { error } = await supabaseAdmin
    .from('members')
    .update({ has_seen_join_stamp_animation: true })
    .eq('id', user.id)

  if (error) {
    console.error('Mark stamp seen error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
