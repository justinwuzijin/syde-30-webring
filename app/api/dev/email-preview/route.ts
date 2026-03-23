import { NextRequest, NextResponse } from 'next/server'
import {
  getApprovalConfirmationEmailHtml,
  getVerificationCodeEmailHtml,
  getAdminApprovalEmailHtml,
  getPasswordResetEmailHtml,
} from '@/lib/email'

/** Returns the HTML for a given email template. Dev-only preview. */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const template = searchParams.get('template') || 'approval-confirmation'
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://syde-30-webring-eta.vercel.app')

  try {
    let html: string

    switch (template) {
      case 'approval-confirmation': {
        const name = searchParams.get('name') || 'Alex'
        const siteUrl = searchParams.get('siteUrl') || baseUrl
        html = getApprovalConfirmationEmailHtml(name, siteUrl)
        break
      }
      case 'verification-code': {
        const name = searchParams.get('name') || 'Alex'
        const code = searchParams.get('code') || '847291'
        html = getVerificationCodeEmailHtml(name, code)
        break
      }
      case 'admin-approval': {
        const member = {
          name: searchParams.get('name') || 'Alex Chen',
          email: searchParams.get('email') || 'alex@example.com',
          website_link: searchParams.get('website_link') || 'https://alexchen.dev',
          polaroid_still_url: searchParams.get('polaroid_still_url') || 'https://example.com/still.jpg',
          polaroid_live_url: searchParams.get('polaroid_live_url') || 'https://example.com/live.mov',
          linkedin_handle: searchParams.get('linkedin_handle') || 'alexchen',
          twitter_handle: searchParams.get('twitter_handle') || 'alexchen_dev',
          github_handle: searchParams.get('github_handle') || 'alexchen',
        }
        const approveUrl = searchParams.get('approveUrl') || `${baseUrl}/api/approve?token=sample-token`
        html = getAdminApprovalEmailHtml(member, approveUrl)
        break
      }
      case 'password-reset': {
        const resetUrl = searchParams.get('resetUrl') || `${baseUrl}/reset-password?token=sample-token`
        html = getPasswordResetEmailHtml(resetUrl)
        break
      }
      default:
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('Email preview error:', err)
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
