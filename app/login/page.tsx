'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }
      login(data.token)
      router.push('/')
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
        <Link
          href="/"
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
          log in
        </h1>
        <p className="font-sans mt-4 text-white/80" style={{ fontSize: 'clamp(12px, 2vw, 1rem)' }}>
          Sign in with your approved webring account.
        </p>

        <div
          className="mt-6 sm:mt-8 mb-8"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs text-white/70 lowercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>
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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs text-white/70 lowercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>
                password
              </label>
              <Link
                href="/forgot-password"
                className="font-mono text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            {loading ? 'signing in…' : 'log in'}
          </button>
        </form>

        <p className="font-mono text-xs text-white/50 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/join" className="text-white/80 hover:text-white transition-colors">
            sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
