import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyResetToken } from '@/lib/token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = (body.token as string)?.trim() ?? ''
    const password = (body.password as string) ?? ''

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const payload = verifyResetToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      )
    }

    const password_hash = await bcrypt.hash(password, 10)

    const { error } = await supabaseAdmin
      .from('members')
      .update({ password_hash })
      .eq('email', payload.email)

    if (error) {
      console.error('Reset password update error:', error)
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Password updated. You can now log in.' })
  } catch (err) {
    console.error('Reset password API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
