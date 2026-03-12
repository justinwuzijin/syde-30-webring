'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const TEMPLATES = [
  { id: 'verification-code', label: 'Verification code (email auth)', params: ['name', 'code'] },
  { id: 'admin-approval', label: 'Admin approval request', params: ['name', 'email', 'website_link', 'linkedin_handle', 'twitter_handle', 'github_handle'] },
  { id: 'approval-confirmation', label: 'Approval confirmation (to member)', params: ['name', 'siteUrl'] },
  { id: 'password-reset', label: 'Forgot password / reset', params: ['resetUrl'] },
] as const

const DEFAULT_PARAMS: Record<string, string> = {
  name: 'Alex',
  email: 'alex@example.com',
  website_link: 'https://alexchen.dev',
  polaroid_still_url: 'https://example.com/still.jpg',
  polaroid_live_url: 'https://example.com/live.mov',
  linkedin_handle: 'alexchen',
  twitter_handle: 'alexchen_dev',
  github_handle: 'alexchen',
  code: '847291',
  siteUrl: 'https://syde30webring.vercel.app',
  resetUrl: 'https://syde30webring.vercel.app/reset-password?token=sample',
  approveUrl: 'https://syde30webring.vercel.app/api/approve?token=sample',
}

type PreviewBg = 'light' | 'dark' | 'default'

const BG_OPTIONS: { value: PreviewBg; label: string; className: string }[] = [
  { value: 'light', label: 'light', className: 'bg-[#f7f7f7]' },
  { value: 'dark', label: 'dark', className: 'bg-[#1a1a1a]' },
  { value: 'default', label: 'default', className: 'bg-[var(--bg)]' },
]

export default function EmailPreviewPage() {
  const [template, setTemplate] = useState<string>('verification-code')
  const [params, setParams] = useState<Record<string, string>>({})
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [previewBg, setPreviewBg] = useState<PreviewBg>('default')

  const currentTemplate = TEMPLATES.find((t) => t.id === template)

  useEffect(() => {
    const initial: Record<string, string> = {}
    currentTemplate?.params.forEach((p) => {
      initial[p] = params[p] ?? DEFAULT_PARAMS[p] ?? ''
    })
    setParams((prev) => ({ ...DEFAULT_PARAMS, ...prev, ...initial }))
  }, [template])

  useEffect(() => {
    setLoading(true)
    const searchParams = new URLSearchParams({ template })
    Object.entries(params).forEach(([k, v]) => {
      if (v) searchParams.set(k, v)
    })
    fetch(`/api/dev/email-preview?${searchParams}`)
      .then((res) => res.text())
      .then(setHtml)
      .catch(() => setHtml('<p style="color:#ef4444;padding:2rem">Failed to load preview</p>'))
      .finally(() => setLoading(false))
  }, [template, params])

  const updateParam = (key: string, value: string) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-3 h-3" />
          back
        </Link>
        <span className="font-mono text-xs text-white/50">Email preview (dev)</span>
      </div>

      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        <div className="flex flex-col gap-4 w-72 shrink-0 overflow-y-auto">
          <div>
            <label className="font-mono text-xs text-white/70 block mb-2">Template</label>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="w-full font-sans text-sm px-3 py-2 rounded bg-white/5 border border-white/10 text-white"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#111] text-white">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {currentTemplate?.params.map((param) => (
            <div key={param}>
              <label className="font-mono text-xs text-white/70 block mb-1">
                {param.replace(/_/g, ' ')}
              </label>
              <input
                type={param.includes('url') || param.includes('link') ? 'url' : 'text'}
                value={params[param] ?? ''}
                onChange={(e) => updateParam(param, e.target.value)}
                className="w-full font-sans text-sm px-3 py-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/30"
                placeholder={DEFAULT_PARAMS[param]}
              />
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs text-white/50">
              Preview · {currentTemplate?.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-white/50">background</span>
              <div className="flex rounded overflow-hidden border border-white/10">
                {BG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPreviewBg(opt.value)}
                    className={`px-3 py-1.5 font-mono text-[10px] transition-colors ${
                      previewBg === opt.value
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60 hover:text-white/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div
            className={`flex-1 rounded-lg overflow-hidden border border-white/10 ${BG_OPTIONS.find((o) => o.value === previewBg)?.className ?? 'bg-white'}`}
            style={{ minHeight: 400 }}
          >
            {loading ? (
              <div className="h-full flex items-center justify-center text-white/50 font-mono text-sm">
                loading…
              </div>
            ) : (
              <iframe
                srcDoc={html}
                title="Email preview"
                className="w-full h-full min-h-[500px] border-0"
                sandbox="allow-same-origin"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
