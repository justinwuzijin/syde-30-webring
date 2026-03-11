'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, Trash2, Upload, X } from 'lucide-react'
import { parseSocialLink } from '@/lib/parse-social'

interface FormData {
  name: string
  email: string
  password: string
  websiteLink: string
  linkedin: string
  twitter: string
  github: string
  polaroidStill: File | null
  polaroidLive: File | null
}

const initialForm: FormData = {
  name: '',
  email: '',
  password: '',
  websiteLink: '',
  linkedin: '',
  twitter: '',
  github: '',
  polaroidStill: null,
  polaroidLive: null,
}

// Validation helpers
const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const isValidUrl = (url: string) => {
  if (!url.trim()) return true
  try {
    new URL(url.startsWith('http') ? url : `https://${url}`)
    return true
  } catch {
    return false
  }
}

// Accept handle (alphanumeric, dashes, underscores), @handle, or full URL
const isValidSocial = (value: string) => {
  if (!value.trim()) return true
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return isValidUrl(value)
  }
  const cleaned = value.trim().replace(/^@/, '')
  return /^[A-Za-z0-9_.-]{1,100}$/.test(cleaned)
}

const sfPro = { fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }

function InputField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
  error,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  type?: string
  mono?: boolean
  error?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-medium text-white lowercase"
        style={sfPro}
      >
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${mono ? 'font-mono' : 'font-sans'} w-full text-xs sm:text-sm px-4 py-3 outline-none transition-all duration-200 text-white placeholder:text-white/50`}
        style={{
          background: 'var(--surface)',
          border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
        }}
      />
      {error && (
        <span className="font-mono text-xs text-red-400">{error}</span>
      )}
    </div>
  )
}

function PasswordField({
  id,
  label,
  required,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  error?: string
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-medium text-white lowercase"
        style={sfPro}
      >
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="font-sans w-full text-xs sm:text-sm px-4 py-3 pr-12 outline-none transition-all duration-200 text-white placeholder:text-white/50"
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
          {showPassword ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {error && (
        <span className="font-mono text-xs text-red-400">{error}</span>
      )}
    </div>
  )
}

function ProfilePictureField({
  label,
  requiredNote,
  helperText,
  value,
  onChange,
  error,
  accept,
}: {
  label: string
  requiredNote?: string
  helperText?: string
  value: File | null
  onChange: (file: File | null) => void
  error?: string
  accept: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showEnlarged, setShowEnlarged] = useState(false)

  useEffect(() => {
    if (value) {
      const url = URL.createObjectURL(value)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [value])

  const acceptsVideo = accept.includes('video')
  const isVideoFile = (f: File) => f.type.startsWith('video/')
  const isImageFile = (f: File) => f.type.startsWith('image/')

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const file = e.clipboardData?.files?.[0]
      if (!file) return
      const valid = acceptsVideo ? isVideoFile(file) : isImageFile(file)
      if (valid) {
        e.preventDefault()
        onChangeRef.current(file)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [acceptsVideo])

  const handleFile = (file: File | null) => {
    if (file === null) {
      onChange(null)
      return
    }
    const valid = acceptsVideo ? isVideoFile(file) : isImageFile(file)
    if (valid) onChange(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0] ?? null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-white lowercase" style={sfPro}>
        {label}
        <span className="ml-0.5 text-red-400">*</span>
        {requiredNote && (
          <span className="font-normal normal-case italic ml-1 text-[10px] text-white/70">
            {requiredNote}
          </span>
        )}
      </span>
      <div
        className="flex flex-col items-center justify-center w-full min-h-[200px] rounded-lg border-2 border-dashed transition-colors cursor-pointer overflow-hidden relative"
        style={{
          background: isDragging ? 'rgba(255,255,255,0.05)' : 'var(--surface)',
          borderColor: error ? '#ef4444' : isDragging ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
        }}
        onClick={() => !previewUrl && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        tabIndex={0}
        role="button"
        aria-label={acceptsVideo ? 'Upload video clip' : 'Upload profile picture or paste image'}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        {previewUrl ? (
          <div className="flex flex-col items-center justify-center w-full h-full min-h-[200px] p-4">
            {value && isVideoFile(value) ? (
              <video
                src={previewUrl}
                className="max-w-full max-h-[180px] w-auto h-auto object-contain rounded cursor-zoom-in"
                controls
                muted
                loop
                playsInline
                onClick={(e) => {
                  e.stopPropagation()
                  setShowEnlarged(true)
                }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[180px] w-auto h-auto object-contain rounded cursor-zoom-in"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowEnlarged(true)
                }}
              />
            )}
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  inputRef.current?.click()
                }}
                className="font-mono text-xs text-white/70 hover:text-white transition-colors"
              >
                replace
              </button>
              <span className="text-white/30">|</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(null)
                }}
                className="font-mono text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                delete
              </button>
            </div>
            <p className="font-mono text-[10px] italic text-white/50 mt-0.5">
              {value && isVideoFile(value) ? 'click video to enlarge' : 'click image to enlarge'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <Upload className="w-10 h-10 text-white/40" />
            <span className="font-mono text-xs text-white/60">
              drag and drop, paste, or click to upload
            </span>
            {helperText && (
              <p className="font-mono text-[10px] italic text-white/50">
                {helperText}
              </p>
            )}
          </div>
        )}
      </div>

      {showEnlarged && previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={() => setShowEnlarged(false)}
        >
          <button
            type="button"
            onClick={() => setShowEnlarged(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
          {value && isVideoFile(value) ? (
            <video
              src={previewUrl}
              className="preview-zoom-in max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded"
              controls
              muted
              loop
              playsInline
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              className="preview-zoom-in max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
      {error && (
        <span className="font-mono text-xs text-red-400">{error}</span>
      )}
    </div>
  )
}

export function JoinForm() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<
    Partial<Record<keyof FormData | 'socials' | '_', string>>
  >({})

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData | 'socials', string>> = {}

    const nameTrimmed = form.name.trim()
    if (nameTrimmed.length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    } else if (!/^[a-zA-Z\s']+$/.test(nameTrimmed)) {
      newErrors.name = 'Name can only contain letters, spaces, and apostrophes'
    }

    if (!form.email.trim()) {
      newErrors.email = 'Please enter your email address'
    } else if (!isValidEmail(form.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!form.password) {
      newErrors.password = 'Password is required'
    } else if (form.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (form.websiteLink.trim() && !isValidUrl(form.websiteLink)) {
      newErrors.websiteLink = 'Enter a valid URL (e.g. https://example.com)'
    }

    const hasLinkedIn = form.linkedin.trim().length > 0
    const hasTwitter = form.twitter.trim().length > 0
    const hasGithub = form.github.trim().length > 0
    const hasAnySocial = hasLinkedIn || hasTwitter || hasGithub

    if (!form.polaroidStill || form.polaroidStill.size === 0) {
      newErrors.polaroidStill = 'Polaroid still photo is required'
    }
    if (!form.polaroidLive || form.polaroidLive.size === 0) {
      newErrors.polaroidLive = 'Polaroid live clip is required'
    } else if (form.polaroidLive.size > 50 * 1024 * 1024) {
      newErrors.polaroidLive = 'Video is too large (max 50MB). Try a shorter clip.'
    }

    if (!hasAnySocial) {
      newErrors.socials = 'At least one social link is required'
    } else {
      if (hasLinkedIn && !isValidSocial(form.linkedin)) {
        newErrors.linkedin = 'Enter handle (e.g. username) or full URL'
      }
      if (hasTwitter && !isValidSocial(form.twitter)) {
        newErrors.twitter = 'Enter handle (e.g. username) or full URL'
      }
      if (hasGithub && !isValidSocial(form.github)) {
        newErrors.github = 'Enter handle (e.g. username) or full URL'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const linkedin = parseSocialLink('linkedin', form.linkedin)
      const twitter = parseSocialLink('twitter', form.twitter)
      const github = parseSocialLink('github', form.github)
      const fd = new FormData()
      fd.set('name', form.name.trim())
      fd.set('email', form.email.trim())
      fd.set('password', form.password)
      fd.set('websiteLink', form.websiteLink.trim())
      fd.set('linkedin', form.linkedin.trim())
      fd.set('twitter', form.twitter.trim())
      fd.set('github', form.github.trim())
      fd.set('polaroidStill', form.polaroidStill!)
      fd.set('polaroidLive', form.polaroidLive!)

      const res = await fetch('/api/join', { method: 'POST', body: fd })
      if (res.status === 202) {
        const data = await res.json().catch(() => ({}))
        if (data.needsVerification && data.email) {
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
          return
        }
        setSubmitted(true)
        router.push('/')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.errors && typeof data.errors === 'object') {
        setErrors((prev) => ({ ...prev, ...data.errors }))
      } else {
        setErrors({ _: 'Something went wrong. Please try again.' })
      }
    } catch {
      setErrors({ _: 'Something went wrong. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const update =
    (field: keyof Omit<FormData, 'polaroidStill' | 'polaroidLive'>) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
      if (field === 'linkedin' || field === 'twitter' || field === 'github') {
        if (errors.socials) setErrors((prev) => ({ ...prev, socials: undefined }))
      }
    }

  const updatePolaroidStill = (file: File | null) => {
    setForm((prev) => ({ ...prev, polaroidStill: file }))
    if (file && errors.polaroidStill) {
      setErrors((prev) => ({ ...prev, polaroidStill: undefined }))
    }
  }

  const updatePolaroidLive = (file: File | null) => {
    setForm((prev) => ({ ...prev, polaroidLive: file }))
    if (file && errors.polaroidLive) {
      setErrors((prev) => ({ ...prev, polaroidLive: undefined }))
    }
  }

  if (submitted) {
    return (
      <div
        className="h-screen overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center px-6 scrollbar-blend"
        style={{ background: 'var(--bg)' }}
      >
        <h1
          className="text-center leading-none text-white"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          web incoming
        </h1>
        <p
          className="font-sans mt-6 text-center max-w-sm leading-relaxed text-white/80"
          style={{
            fontSize: 'clamp(12px, 2vw, 1rem)',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
          }}
        >
          {
            "your request is in the spider's web. you'll hear back once an admin approves your membership."
          }
        </p>
        <div
          className="mt-8 mb-8"
          style={{
            width: '32px',
            height: '1px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
          }}
        />
        <a
          href="/"
          className="font-mono text-xs flex items-center gap-2 transition-opacity hover:opacity-80 text-white/70"
          style={{
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both',
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back to the web
        </a>
      </div>
    )
  }

  return (
    <div
      className="h-screen overflow-y-auto overflow-x-hidden flex flex-col px-4 sm:px-6 md:px-8 lg:px-12 py-8 sm:py-16 md:py-24 scrollbar-blend"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-xl sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex-1">
        {/* Back */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs tracking-wider lowercase transition-opacity hover:opacity-80 mb-8 sm:mb-12 text-white/70"
        >
          <ArrowLeft className="w-3 h-3" />
          back
        </a>

        {/* Heading */}
        <h1
          className="leading-none text-white lowercase"
          style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif',
            fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
            letterSpacing: '0.02em',
          }}
        >
          sign up
        </h1>
        <p
          className="font-sans mt-4 leading-relaxed text-white/80 md:whitespace-nowrap"
          style={{ fontSize: 'clamp(12px, 2vw, 1rem)' }}
        >
          Join the SYDE 2030 webring. Share your personal site and connect with your cohort.
        </p>

        {/* Divider */}
        <div
          className="mt-6 sm:mt-8 mb-8 sm:mb-10"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 sm:gap-7">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-7">
            <InputField
              id="name"
              label="name"
              required
              value={form.name}
              onChange={update('name')}
              placeholder="e.g. leo zhang"
              error={errors.name}
            />

            <InputField
              id="email"
              label="email"
              required
              value={form.email}
              onChange={update('email')}
              placeholder="e.g. example@gmail.com"
              type="email"
              error={errors.email}
            />

            <PasswordField
              id="password"
              label="password"
              required
              value={form.password}
              onChange={update('password')}
              placeholder="e.g. 12345678"
              error={errors.password}
            />

            <div className="flex flex-col gap-2 lg:col-span-2">
              <InputField
                id="websiteLink"
                label="website link"
                value={form.websiteLink}
                onChange={update('websiteLink')}
                placeholder="e.g. https://example.com"
                type="url"
                mono
                error={errors.websiteLink}
              />
              <p className="font-mono text-[10px] italic -mt-2 text-white/50">
                we will automatically capture a screenshot of your website&apos;s
                landing page
              </p>
            </div>
          </div>

          {/* Social links */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium text-white lowercase" style={sfPro}>
              social links
              <span className="ml-0.5 text-red-400">*</span>
              <span className="font-normal normal-case italic ml-1 text-[10px] text-white/70">
                (at least one)
              </span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="linkedin"
                  className="text-xs text-white/70 lowercase"
                  style={sfPro}
                >
                  linkedin
                </label>
                <input
                  id="linkedin"
                  type="text"
                  value={form.linkedin}
                  onChange={update('linkedin')}
                  placeholder="username or URL"
                  className="font-mono text-xs sm:text-sm px-3 py-2.5 outline-none transition-all duration-200 text-white placeholder:text-white/50 w-full"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${errors.linkedin || errors.socials ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="twitter"
                  className="text-xs text-white/70 lowercase"
                  style={sfPro}
                >
                  twitter
                </label>
                <input
                  id="twitter"
                  type="text"
                  value={form.twitter}
                  onChange={update('twitter')}
                  placeholder="username or URL"
                  className="font-mono text-xs sm:text-sm px-3 py-2.5 outline-none transition-all duration-200 text-white placeholder:text-white/50 w-full"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${errors.twitter || errors.socials ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="github"
                  className="text-xs text-white/70 lowercase"
                  style={sfPro}
                >
                  github
                </label>
                <input
                  id="github"
                  type="text"
                  value={form.github}
                  onChange={update('github')}
                  placeholder="username or URL"
                  className="font-mono text-xs sm:text-sm px-3 py-2.5 outline-none transition-all duration-200 text-white placeholder:text-white/50 w-full"
                  style={{
                    background: 'var(--surface)',
                    border: `1px solid ${errors.github || errors.socials ? '#ef4444' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                  }}
                />
              </div>
            </div>
            {(errors.socials || errors.linkedin || errors.twitter || errors.github) && (
              <span className="font-mono text-xs text-red-400">
                {errors.socials || errors.linkedin || errors.twitter || errors.github}
              </span>
            )}
          </div>

          <ProfilePictureField
            label="polaroid still (photo)"
            requiredNote="heic, jpg, jpeg, png"
            helperText="this will be your static polaroid image"
            value={form.polaroidStill}
            onChange={updatePolaroidStill}
            error={errors.polaroidStill}
            accept=".heic,.heif,.jpg,.jpeg,.png,image/*"
          />

          <ProfilePictureField
            label="polaroid live clip"
            requiredNote="mov or mp4"
            helperText="short video shown when others hover your polaroid"
            value={form.polaroidLive}
            onChange={updatePolaroidLive}
            error={errors.polaroidLive}
            accept=".mov,.mp4,video/*"
          />

          {errors._ && (
            <p className="font-mono text-xs text-red-400">{errors._}</p>
          )}
          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 font-sans text-xs sm:text-sm font-medium lowercase transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--accent-red)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
            }}
          >
            <span>{submitting ? 'signing up…' : 'sign up'}</span>
            <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
