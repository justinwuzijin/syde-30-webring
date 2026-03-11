'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''

  const [email, setEmail] = useState(emailParam)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (emailParam) setEmail(emailParam)
  }, [emailParam])

  useEffect(() => {
    if (!resendCooldown) return
    const t = setInterval(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/verify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => router.push('/'), 2000)
      } else {
        setError(data.error || 'Verification failed')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError('')
    setResendLoading(true)
    try {
      const res = await fetch('/api/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResendCooldown(60)
      } else {
        setError(data.error || 'Failed to resend')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setResendLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(v)
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          <h1
            className="leading-none text-white"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(2.5rem, 8vw, 4rem)',
              letterSpacing: '0.02em',
            }}
          >
            EMAIL VERIFIED
          </h1>
          <p className="font-sans mt-4 text-white/80">
            Your request is in the spider&apos;s web. You&apos;ll hear back once an admin approves your membership.
          </p>
          <p className="font-mono text-xs text-white/50 mt-4">Redirecting you home…</p>
          <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-xs text-white/70 hover:text-white mt-6">
            <ArrowLeft className="w-3 h-3" />
            back to the web
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-white/70"
        >
          <ArrowLeft className="w-3 h-3" />
          back
        </Link>

        <h1
          className="leading-none text-white lowercase"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            letterSpacing: '0.02em',
          }}
        >
          verify your email
        </h1>
        <p className="font-sans mt-4 text-white/80" style={{ fontSize: 'clamp(12px, 2vw, 1rem)' }}>
          We sent a 6-digit code to your email. Enter it below. Codes expire in 5 minutes.
        </p>

        <div
          className="mt-6 sm:mt-8 mb-8"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        <form onSubmit={handleVerify} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="font-mono text-xs text-white/70">
              email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. example@gmail.com"
              required
              className="font-sans text-sm px-4 py-3 outline-none text-white placeholder:text-white/50 w-full"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="code" className="font-mono text-xs text-white/70">
              verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={handleCodeChange}
              placeholder="000000"
              autoComplete="one-time-code"
              className="font-mono text-[28px] tracking-[0.4em] px-4 py-4 text-center outline-none text-white placeholder:text-white/30 w-full"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 font-sans text-xs sm:text-sm font-medium lowercase transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{
              background: 'var(--accent-red)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
            }}
          >
            {loading ? 'verifying…' : 'verify'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/10">
          <p className="font-mono text-xs text-white/50 mb-2">Didn&apos;t get the code?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            className="font-mono text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : resendLoading
                ? 'Sending…'
                : 'Send another code'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <span className="font-mono text-xs text-white/50">loading…</span>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
