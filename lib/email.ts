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

/** Returns the HTML for the admin approval email (for preview or sending) */
export function getAdminApprovalEmailHtml(
  member: ApprovalMemberInfo,
  approveUrl: string
): string {
  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:8px 16px 8px 0;color:#999;font-size:13px;">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:14px;color:#333;">${escapeHtml(value)}</td></tr>`
      : ''

  const socialRows = [
    member.linkedin_handle ? row('LinkedIn', `https://linkedin.com/in/${member.linkedin_handle}`) : '',
    member.twitter_handle ? row('Twitter', `https://x.com/${member.twitter_handle}`) : '',
    member.github_handle ? row('GitHub', `https://github.com/${member.github_handle}`) : '',
  ].filter(Boolean).join('')

  return emailShell('New member request', `
              <p style="margin:0 0 20px;font-size:14px;color:#666;">A new member has requested to join the SYDE 30 webring.</p>
              <table style="border-collapse:collapse;margin:0 0 24px;width:100%;">
                ${row('Name', member.name)}
                ${row('Email', member.email)}
                ${row('Website', member.website_link)}
                ${row('Polaroid still', member.polaroid_still_url)}
                ${row('Polaroid live clip', member.polaroid_live_url)}
                ${socialRows}
              </table>
              <div style="text-align:center;margin:0 0 20px;">
                <a href="${escapeHtml(approveUrl)}" style="display:inline-block;padding:12px 28px;background:#333;color:#fff;text-decoration:none;font-weight:600;font-size:14px;border-radius:6px;">Approve member</a>
              </div>
              <p style="margin:0;font-size:12px;color:#aaa;">This link expires in 7 days.</p>`)
}

export async function sendApprovalEmail(
  adminEmail: string,
  member: ApprovalMemberInfo,
  approveUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: adminEmail,
    subject: `[SYDE 30 Webring] Approve: ${member.name}`,
    html: getAdminApprovalEmailHtml(member, approveUrl),
  })
}

/** Shared light-themed email wrapper */
function emailShell(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f7f7;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f7f7f7;">
    <tr>
      <td style="padding:48px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
          <!-- Header -->
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span style="font-family:'Inter',-apple-system,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;color:#bbb;">syde 30 webring</span>
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:40px 32px;">
${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#bbb;">syde 2030 · systems design engineering</p>
              <p style="margin:0;font-size:11px;color:#ccc;">built by justin wu and leo zhang</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Returns the HTML for the verification code email (for preview or sending) */
export function getVerificationCodeEmailHtml(name: string, code: string): string {
  return emailShell('Verify your email', `
              <p style="margin:0 0 8px;font-size:16px;color:#333;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">Thanks for signing up. Use this code to verify your email address:</p>
              <div style="text-align:center;margin:0 0 28px;">
                <span style="display:inline-block;padding:18px 32px;background:#f7f7f7;border:1px solid #e5e5e5;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:0.5em;color:#333;font-weight:600;">${escapeHtml(code)}</span>
              </div>
              <p style="margin:0;font-size:12px;color:#aaa;">This code expires in 5 minutes.</p>
              <p style="margin:12px 0 0;font-size:12px;color:#aaa;">If you didn&apos;t request this, you can safely ignore this email.</p>`)
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
    html: getVerificationCodeEmailHtml(name, code),
  })
}

/** Returns the HTML for the approval confirmation email (for preview or sending) */
export function getApprovalConfirmationEmailHtml(
  name: string,
  siteUrl: string
): string {
  return emailShell("You're approved", `
              <p style="margin:0 0 8px;font-size:16px;color:#333;">Hi ${escapeHtml(name)},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.6;">You&apos;re in! Your membership to the SYDE 30 webring has been approved.</p>
              <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">Log in to see your polaroid on the web and explore your cohort&apos;s sites.</p>
              <div style="text-align:center;">
                <a href="${escapeHtml(siteUrl)}" style="display:inline-block;padding:12px 28px;background:#333;color:#fff;text-decoration:none;font-weight:600;font-size:14px;border-radius:6px;">Check out the webring</a>
              </div>`)
}

export async function sendApprovalConfirmationEmail(
  toEmail: string,
  name: string,
  siteUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: "You're in! — SYDE 30 Webring",
    html: getApprovalConfirmationEmailHtml(name, siteUrl),
  })
}

/** Returns the HTML for the password reset email (for preview or sending) */
export function getPasswordResetEmailHtml(resetUrl: string): string {
  return emailShell('Reset your password', `
              <p style="margin:0 0 8px;font-size:16px;color:#333;">Reset your password</p>
              <p style="margin:0 0 28px;font-size:14px;color:#666;line-height:1.6;">You requested to reset your password for the SYDE 30 webring. Click the button below to set a new one.</p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 28px;background:#333;color:#fff;text-decoration:none;font-weight:600;font-size:14px;border-radius:6px;">Reset password</a>
              </div>
              <p style="margin:0;font-size:12px;color:#aaa;">This link expires in 1 hour. If you didn&apos;t request this, you can safely ignore this email.</p>`)
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: '[SYDE 30 Webring] Reset your password',
    html: getPasswordResetEmailHtml(resetUrl),
  })
}
