import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { signResetToken } from '@/lib/token'
import { sendPasswordResetEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string)?.trim() ?? ''

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, email')
      .eq('email', email)
      .single()

    if (!member) {
      return NextResponse.json(
        { error: 'No account found with this email. Please sign up.' },
        { status: 404 }
      )
    }

    const token = signResetToken(member.email)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://syde-30-webring-eta.vercel.app')
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(member.email, resetUrl)

    return NextResponse.json({ message: 'If an account exists, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
