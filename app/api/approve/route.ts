import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/token'
import { supabaseAdmin } from '@/lib/supabase'
import { sendApprovalConfirmationEmail } from '@/lib/email'

interface TokenPayload {
  name: string
  email: string
  password_hash: string
  website_link: string | null
  polaroid_still_url: string | null
  polaroid_live_url: string | null
  linkedin_handle: string | null
  twitter_handle: string | null
  github_handle: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Invalid</title></head><body><h1>Invalid or missing token</h1><p><a href="/">Back to webring</a></p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const result = verifyToken(token)
  if (!result) {
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Expired</title></head><body><h1>Link expired or invalid</h1><p><a href="/">Back to webring</a></p></body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const payload = result.payload as TokenPayload
  const {
    name,
    email,
    password_hash,
    website_link,
    polaroid_still_url,
    polaroid_live_url,
    linkedin_handle,
    twitter_handle,
    github_handle,
  } = payload

  const { error } = await supabaseAdmin.from('members').insert({
    name,
    email,
    password_hash,
    program: 'SYDE 2030',
    website_link: website_link || null,
    profile_picture_url: polaroid_still_url || null,
    polaroid_still_url: polaroid_still_url || null,
    polaroid_live_url: polaroid_live_url || null,
    linkedin_handle: linkedin_handle || null,
    twitter_handle: twitter_handle || null,
    github_handle: github_handle || null,
    approved: true,
  })

  if (error) {
    if (error.code === '23505') {
      return new NextResponse(
        '<!DOCTYPE html><html><head><title>Already registered</title></head><body><h1>This email is already registered</h1><p><a href="/">Back to webring</a></p></body></html>',
        { status: 409, headers: { 'Content-Type': 'text/html' } }
      )
    }
    console.error('Approve insert error:', error)
    return new NextResponse(
      '<!DOCTYPE html><html><head><title>Error</title></head><body><h1>Something went wrong</h1><p><a href="/">Back to webring</a></p></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  sendApprovalConfirmationEmail(email, name, baseUrl).catch((err) =>
    console.error('Failed to send approval confirmation email:', err)
  )

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Approved</title>
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0a0a0f; color: #f0f0f0; font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; }
    h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(2.5rem, 8vw, 5rem); letter-spacing: 0.02em; margin: 0; }
    p { margin: 1rem 0 0; opacity: 0.85; max-width: 24rem; text-align: center; }
    a { color: #ff2020; text-decoration: none; margin-top: 2rem; display: inline-block; font-size: 0.875rem; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>APPROVED</h1>
  <p>${name} has been added to the webring.</p>
  <a href="/">Back to the web</a>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  )
}
