'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) setError('reset link is missing. request a new one below.')
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) return
    if (password.length < 8) {
      setError('password needs at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError("passwords don't match")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'failed to reset password')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setError('something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div
        className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-white/70"
          >
            <ArrowLeft className="w-3 h-3" />
            back to log in
          </Link>
          <p className="font-mono text-sm text-red-400">{error}</p>
          <Link href="/forgot-password" className="font-mono text-xs text-white/80 hover:text-white mt-4">
            request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          <h1
            className="leading-none text-white lowercase"
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              letterSpacing: '0.02em',
            }}
          >
            password updated
          </h1>
          <p className="font-sans mt-4 text-white/80">
            redirecting you to log in…
          </p>
          <Link href="/login" className="font-mono text-xs text-white/70 hover:text-white mt-6">
            go to log in
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
          className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-white/70"
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
          reset password
        </h1>
        <p className="font-sans mt-4 text-white/80" style={{ fontSize: 'clamp(12px, 2vw, 1rem)' }}>
          enter your new password below
        </p>

        <div
          className="mt-6 sm:mt-8 mb-8"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="font-mono text-xs text-white/70">
              new password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="at least 8 characters"
                required
                minLength={8}
                className="font-sans text-sm px-4 py-3 pr-12 outline-none text-white placeholder:text-white/50 w-full"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white transition-colors"
                aria-label={showPassword ? 'hide password' : 'show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="confirmPassword" className="font-mono text-xs text-white/70">
              confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="re-enter your password"
                required
                minLength={8}
                className="font-sans text-sm px-4 py-3 pr-12 outline-none text-white placeholder:text-white/50 w-full"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/60 hover:text-white transition-colors"
                aria-label={showConfirmPassword ? 'hide password' : 'show password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
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
            {loading ? 'updating…' : 'reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p className="text-white/60">loading…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
