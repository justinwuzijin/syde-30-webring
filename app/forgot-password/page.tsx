'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || 'something went wrong')
      }
    } catch {
      setError('something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-sans text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-white/70"
          >
            <ArrowLeft className="w-3 h-3" />
            back to log in
          </Link>
          <h1
            className="leading-none text-white lowercase"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              letterSpacing: '0.02em',
            }}
          >
            check your email
          </h1>
          <p className="font-sans mt-4 text-white/80">
            if we have an account for that email, we&apos;ve sent a reset link. it expires in 1 hour.
          </p>
          <Link href="/login" className="font-sans text-xs text-white/70 hover:text-white mt-6">
            back to log in
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
          href="/login"
          className="inline-flex items-center gap-1.5 font-sans text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-white/70"
        >
          <ArrowLeft className="w-3 h-3" />
          back to log in
        </Link>

        <h1
          className="leading-none text-white lowercase"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
            fontSize: 'clamp(2.5rem, 8vw, 4rem)',
            letterSpacing: '0.02em',
          }}
        >
          forgot password
        </h1>
        <p className="font-sans mt-4 text-white/80" style={{ fontSize: 'clamp(12px, 2vw, 1rem)' }}>
          enter your email and we&apos;ll send you a reset link
        </p>

        <div
          className="mt-6 sm:mt-8 mb-8"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="font-sans text-xs text-white/70">
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
          {error && <p className="font-sans text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 font-sans text-xs sm:text-sm font-medium lowercase transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{
              background: 'var(--accent-red)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
            }}
          >
            {loading ? 'sending…' : 'send reset link'}
          </button>
        </form>

        <p className="font-sans text-xs text-white/50 mt-6">
          don&apos;t have an account?{' '}
          <Link href="/join" className="text-white/80 hover:text-white transition-colors">
            sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
