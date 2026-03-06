import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

export interface ApprovalMemberInfo {
  name: string
  email: string
  program: string
  website_link: string | null
  profile_picture_url: string | null
  linkedin_handle: string | null
  twitter_handle: string | null
  github_handle: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendApprovalEmail(
  adminEmail: string,
  member: ApprovalMemberInfo,
  approveUrl: string
): Promise<void> {
  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:6px 12px 6px 0;color:#888;font-size:13px;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;">${escapeHtml(value)}</td></tr>`
      : ''

  const socialRows = [
    member.linkedin_handle ? row('LinkedIn', `https://linkedin.com/in/${member.linkedin_handle}`) : '',
    member.twitter_handle ? row('Twitter', `https://x.com/${member.twitter_handle}`) : '',
    member.github_handle ? row('GitHub', `https://github.com/${member.github_handle}`) : '',
  ].filter(Boolean).join('')

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: adminEmail,
    subject: `[SYDE 30 Webring] Approve: ${member.name}`,
    html: `
      <p style="font-family:sans-serif;font-size:14px;color:#333;">A new member has requested to join the SYDE 30 webring.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;">
        ${row('Name', member.name)}
        ${row('Email', member.email)}
        ${row('Program', member.program)}
        ${row('Website', member.website_link)}
        ${member.profile_picture_url ? row('Profile picture', member.profile_picture_url) : ''}
        ${socialRows}
      </table>
      <p style="margin-top:20px;"><a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#E8251A;color:#fff;text-decoration:none;font-weight:600;border-radius:4px;">Approve member</a></p>
      <p style="font-size:12px;color:#666;margin-top:16px;">This link expires in 7 days.</p>
    `,
  })
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: '[SYDE 30 Webring] Reset your password',
    html: `
      <p style="font-family:sans-serif;font-size:14px;color:#333;">You requested to reset your password for the SYDE 30 webring.</p>
      <p style="margin-top:20px;"><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#E8251A;color:#fff;text-decoration:none;font-weight:600;border-radius:4px;">Reset password</a></p>
      <p style="font-size:12px;color:#666;margin-top:16px;">This link expires in 1 hour. If you didn&apos;t request this, you can ignore this email.</p>
    `,
  })
}
