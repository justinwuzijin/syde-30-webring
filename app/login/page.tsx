'use client'

import { useState, useCallback } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { AuthCelebration } from '@/components/auth-celebration'
import { StretchText } from '@/components/stretch-text'
import { usePageTransition } from '@/components/page-transition'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const { login } = useAuth()
  const router = useRouter()
  const { endTransition } = usePageTransition()

  const handleCelebrationComplete = useCallback(() => {
    router.push('/')
  }, [router])

  useEffect(() => {
    // Allow the global transition overlay to dismiss once this page is mounted.
    endTransition()
  }, [endTransition])

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
        setError(data.error || 'log in failed')
        return
      }
      login(data.token)
      setShowCelebration(true)
    } catch {
      setError('something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <AnimatePresence>
      {showCelebration && (
        <AuthCelebration type="signin" onComplete={handleCelebrationComplete} />
      )}
    </AnimatePresence>
    <div
      className="min-h-screen flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24"
      style={{ background: '#ffffff' }}
    >
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 font-sans text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 text-black/50"
        >
          <ArrowLeft className="w-3 h-3" />
          back
        </a>

        {/* Heading — compressed text to match landing page */}
        <div className="w-[50%] sm:w-[40%] mb-8">
          <div className="relative w-full" style={{ paddingTop: '50%' }}>
            <StretchText
              lines={["log in"]}
              viewBox="0 0 300 170"
              fontSize={160}
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-xs text-black/50 lowercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>
              email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. example@gmail.com"
              required
              className="font-sans text-sm px-4 py-3 outline-none text-black placeholder:text-black/40 w-full"
              style={{
                background: '#f7f7f7',
                border: `1px solid ${error ? '#ef4444' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs text-black/50 lowercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}>
                password
              </label>
              <Link
                href="/forgot-password"
                className="font-sans text-xs text-black/40 hover:text-black/70 transition-colors"
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
                className="font-sans text-sm px-4 py-3 pr-12 outline-none text-black placeholder:text-black/40 w-full"
                style={{
                  background: '#f7f7f7',
                  border: `1px solid ${error ? '#ef4444' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 'var(--radius)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/40 hover:text-black/70 transition-colors"
                aria-label={showPassword ? 'hide password' : 'show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <p className="font-sans text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 font-sans text-xs sm:text-sm font-medium lowercase transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            style={{
              background: '#333',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
            }}
          >
            {loading ? 'signing in…' : 'log in'}
          </button>
        </form>

        <p className="font-sans text-xs text-black/40 mt-6">
          don&apos;t have an account?{' '}
          <Link href="/join" className="text-black/70 hover:text-black transition-colors">
            sign up
          </Link>
        </p>
      </div>
    </div>
    </>
  )
}
