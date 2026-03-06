import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signAuthToken } from '@/lib/token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = (body.email as string)?.trim() ?? ''
    const password = (body.password as string) ?? ''

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const { data: member, error } = await supabaseAdmin
      .from('members')
      .select('id, name, email, password_hash, approved')
      .eq('email', email)
      .single()

    if (error || !member) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    if (!member.approved) {
      return NextResponse.json({ error: 'Your account is pending approval' }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, member.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = signAuthToken({
      id: member.id,
      email: member.email,
      name: member.name,
    })

    return NextResponse.json({
      token,
      user: { id: member.id, email: member.email, name: member.name },
    })
  } catch (err) {
    console.error('Login API error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
