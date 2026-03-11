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

const FROM_HEADER = process.env.EMAIL_FROM_HEADER || 'SYDE 30 Webring'
const fromAddress = process.env.GMAIL_USER || 'noreply@syde30webring.com'

function getFrom() {
  return `${FROM_HEADER} <${fromAddress}>`
}

export interface ApprovalMemberInfo {
  name: string
  email: string
  website_link: string | null
  polaroid_still_url: string | null
  polaroid_live_url: string | null
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
    from: getFrom(),
    to: adminEmail,
    subject: `[SYDE 30 Webring] Approve: ${member.name}`,
    html: `
      <p style="font-family:sans-serif;font-size:14px;color:#333;">A new member has requested to join the SYDE 30 webring.</p>
      <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;">
        ${row('Name', member.name)}
        ${row('Email', member.email)}
        ${row('Website', member.website_link)}
        ${row('Polaroid still', member.polaroid_still_url)}
        ${row('Polaroid live clip', member.polaroid_live_url)}
        ${socialRows}
      </table>
      <p style="margin-top:20px;"><a href="${approveUrl}" style="display:inline-block;padding:10px 20px;background:#E8251A;color:#fff;text-decoration:none;font-weight:600;border-radius:4px;">Approve member</a></p>
      <p style="font-size:12px;color:#666;margin-top:16px;">This link expires in 7 days.</p>
    `,
  })
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  name: string,
  code: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: 'Your verification code — SYDE 30 Webring',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0a0a0f;">
    <tr>
      <td style="padding:48px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:0.08em;color:#f0f0f0;">SYDE 30 WEBRING</span>
            </td>
          </tr>
          <tr>
            <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:40px 32px;">
              <p style="margin:0 0 8px;font-size:16px;color:#f0f0f0;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 24px;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.5;">Thanks for signing up. Use this code to verify your email address:</p>
              <div style="text-align:center;margin:0 0 24px;">
                <span style="display:inline-block;padding:16px 28px;background:rgba(255,255,255,0.08);border:2px solid rgba(255,255,255,0.2);border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:28px;letter-spacing:0.4em;color:#f0f0f0;font-weight:500;">${escapeHtml(code)}</span>
              </div>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);">This code expires in 5 minutes.</p>
              <p style="margin:16px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">If you didn&apos;t request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.35);">SYDE 2030 · Systems Design Engineering</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  })
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: '[SYDE 30 Webring] Reset your password',
    html: `
      <p style="font-family:sans-serif;font-size:14px;color:#333;">You requested to reset your password for the SYDE 30 webring.</p>
      <p style="margin-top:20px;"><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#E8251A;color:#fff;text-decoration:none;font-weight:600;border-radius:4px;">Reset password</a></p>
      <p style="font-size:12px;color:#666;margin-top:16px;">This link expires in 1 hour. If you didn&apos;t request this, you can ignore this email.</p>
    `,
  })
}
