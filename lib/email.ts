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

function firstNameOrFallback(fullName: string, fallback: string = 'there'): string {
  const trimmed = fullName.trim()
  if (!trimmed) return fallback
  const first = trimmed.split(/\s+/)[0]
  return first || fallback
}

/** Returns the HTML for the admin approval email (for preview or sending) */
export function getAdminApprovalEmailHtml(
  member: ApprovalMemberInfo,
  approveUrl: string
): string {
  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td class="em-text-muted" style="padding:8px 16px 8px 0;font-size:13px;">${escapeHtml(label)}</td><td class="em-text" style="padding:8px 0;font-size:14px;">${escapeHtml(value)}</td></tr>`
      : ''

  const socialRows = [
    member.linkedin_handle ? row('LinkedIn', `https://linkedin.com/in/${member.linkedin_handle}`) : '',
    member.twitter_handle ? row('Twitter', `https://x.com/${member.twitter_handle}`) : '',
    member.github_handle ? row('GitHub', `https://github.com/${member.github_handle}`) : '',
  ].filter(Boolean).join('')

  return emailShell('New member request', `
              <p class="em-text-secondary" style="margin:0 0 20px;font-size:14px;line-height:1.5;">A new member has requested to join the SYDE 30 webring. Please review the details below and approve if everything looks correct.</p>
              <table style="border-collapse:collapse;margin:0 0 24px;width:100%;">
                ${row('Name', member.name)}
                ${row('Email', member.email)}
                ${row('Website', member.website_link)}
                ${row('Polaroid still', member.polaroid_still_url)}
                ${row('Polaroid live clip', member.polaroid_live_url)}
                ${socialRows}
              </table>
              <div style="text-align:center;margin:0 0 20px;">
                <a href="${escapeHtml(approveUrl)}" class="em-link" style="font-weight:600;font-size:14px;">Approve member</a>
              </div>
              <p class="em-text-muted" style="margin:0;font-size:12px;">This link expires in 7 days.</p>`)
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

/** Shared email wrapper — transparent, theme-aware text. No backgrounds. */
function emailShell(title: string, bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <style>
    /* Light mode (default): dark text */
    .em-text { color: #333 !important; }
    .em-text-secondary { color: #555 !important; }
    .em-text-muted { color: #888 !important; }
    .em-link { color: #333 !important; text-decoration: underline !important; }
    .em-code { color: #333 !important; border-color: #ccc !important; }
    @media (prefers-color-scheme: dark) {
      .em-text { color: #e5e5e5 !important; }
      .em-text-secondary { color: #b0b0b0 !important; }
      .em-text-muted { color: #888 !important; }
      .em-link { color: #7eb8ff !important; }
      .em-code { color: #e5e5e5 !important; border-color: #555 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
    <tr>
      <td style="padding:48px 24px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
          <tr>
            <td style="padding:0 0 32px;text-align:center;">
              <span class="em-text-muted" style="font-size:11px;font-weight:600;letter-spacing:0.25em;text-transform:uppercase;">SYDE 30 webring</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;">
${bodyContent}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0 0;text-align:center;">
              <p class="em-text-muted" style="margin:0 0 6px;font-size:11px;">SYDE 2030 · systems design engineering</p>
              <p class="em-text-muted" style="margin:0;font-size:11px;">built by justin wu and leo zhang</p>
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
  const firstName = firstNameOrFallback(name)
  return emailShell('verify your email', `
              <p class="em-text" style="margin:0 0 8px;font-size:16px;">hi ${escapeHtml(firstName)},</p>
              <p class="em-text-secondary" style="margin:0 0 28px;font-size:14px;line-height:1.6;">enter this code to verify your email:</p>
              <div style="text-align:center;margin:0 0 28px;">
                <span class="em-code" style="display:inline-block;padding:18px 32px;border:1px solid;border-radius:8px;font-family:'JetBrains Mono',monospace;font-size:32px;letter-spacing:0.5em;font-weight:600;">${escapeHtml(code)}</span>
              </div>
              <p class="em-text-muted" style="margin:0;font-size:12px;">code expires in 5 minutes.</p>
              <p class="em-text-muted" style="margin:12px 0 0;font-size:12px;">if you didn&apos;t request this, you can ignore this email.</p>`)
}

export async function sendVerificationCodeEmail(
  toEmail: string,
  name: string,
  code: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: 'your verification code — SYDE 30 webring',
    html: getVerificationCodeEmailHtml(name, code),
  })
}

/** Returns the HTML for the approval confirmation email (for preview or sending) */
export function getApprovalConfirmationEmailHtml(
  name: string,
  siteUrl: string
): string {
  const firstName = firstNameOrFallback(name)
  return emailShell("You're approved", `
              <p class="em-text" style="margin:0 0 8px;font-size:16px;">Hi ${escapeHtml(firstName)},</p>
              <p class="em-text-secondary" style="margin:0 0 24px;font-size:14px;line-height:1.6;">You&apos;re in! Your membership to the SYDE 30 webring has been approved.</p>
              <p class="em-text-secondary" style="margin:0 0 28px;font-size:14px;line-height:1.6;">Log in to see your polaroid and explore your cohort&apos;s sites.</p>
              <div style="text-align:center;">
                <a href="${escapeHtml(siteUrl)}" class="em-link" style="font-weight:600;font-size:14px;">View the webring</a>
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
  return emailShell('reset your password', `
              <p class="em-text" style="margin:0 0 8px;font-size:16px;">reset your password</p>
              <p class="em-text-secondary" style="margin:0 0 28px;font-size:14px;line-height:1.6;">you asked to reset your password. click below to set a new one.</p>
              <div style="text-align:center;margin:0 0 28px;">
                <a href="${escapeHtml(resetUrl)}" class="em-link" style="font-weight:600;font-size:14px;">reset password</a>
              </div>
              <p class="em-text-muted" style="margin:0;font-size:12px;">link expires in 1 hour. if you didn&apos;t request this, you can ignore this email.</p>`)
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: getFrom(),
    to: toEmail,
    subject: '[SYDE 30 webring] reset your password',
    html: getPasswordResetEmailHtml(resetUrl),
  })
}
