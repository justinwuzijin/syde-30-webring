'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'

interface FormData {
  name: string
  embedUrl: string
  github: string
  twitter: string
  instagram: string
  linkedin: string
  website: string
  connections: string
  bio: string
}

const initialForm: FormData = {
  name: '',
  embedUrl: '',
  github: '',
  twitter: '',
  instagram: '',
  linkedin: '',
  website: '',
  connections: '',
  bio: '',
}

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
        className="font-sans text-[11px] font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
        {required && <span style={{ color: 'var(--accent-1)' }} className="ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${mono ? 'font-mono' : 'font-sans'} text-sm px-4 py-3 outline-none transition-all duration-200`}
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          border: `1px solid ${error ? 'var(--accent-1)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
        }}
      />
      {error && (
        <span className="font-mono text-[11px]" style={{ color: 'var(--accent-1)' }}>
          {error}
        </span>
      )}
    </div>
  )
}

export function JoinForm() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}
    if (form.name.length < 2) newErrors.name = 'Name must be at least 2 characters'
    if (!form.embedUrl.startsWith('http')) newErrors.embedUrl = 'Must include https://'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) setSubmitted(true)
  }

  const update = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  if (submitted) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: 'var(--bg)' }}
      >
        <h1
          className="text-center leading-none"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: 'var(--accent-1)',
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            letterSpacing: '0.02em',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          WEB INCOMING
        </h1>
        <p
          className="font-sans text-sm mt-6 text-center max-w-sm leading-relaxed"
          style={{
            color: 'var(--text-secondary)',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both',
          }}
        >
          {"Your request is in the spider's web. You'll hear back once an admin approves your membership."}
        </p>
        <div
          className="mt-8 mb-8"
          style={{
            width: '32px',
            height: '1px',
            backgroundColor: 'var(--border)',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s both',
          }}
        />
        <Link
          href="/"
          className="font-mono text-xs flex items-center gap-2 transition-opacity hover:opacity-80"
          style={{
            color: 'var(--text-muted)',
            animation: 'fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both',
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to the web
        </Link>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col px-6 py-16 md:py-24"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md mx-auto">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wider uppercase transition-opacity hover:opacity-80 mb-12"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="w-3 h-3" />
          Back
        </Link>

        {/* Heading */}
        <h1
          className="leading-none"
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            color: 'var(--text)',
            fontSize: 'clamp(3rem, 8vw, 5.5rem)',
            letterSpacing: '0.02em',
          }}
        >
          INTO THE <span style={{ color: 'var(--accent-1)' }}>WEB</span>
        </h1>
        <p
          className="font-sans text-sm mt-4 leading-relaxed max-w-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          Join the SYDE 2030 webring. Share your personal site and connect with your cohort.
        </p>

        {/* Divider */}
        <div
          className="mt-8 mb-10"
          style={{ width: '32px', height: '1px', backgroundColor: 'var(--border)' }}
        />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-7">
          <InputField
            id="name"
            label="Name"
            required
            value={form.name}
            onChange={update('name')}
            placeholder="Your full name"
            error={errors.name}
          />

          <InputField
            id="embedUrl"
            label="Site URL"
            required
            value={form.embedUrl}
            onChange={update('embedUrl')}
            placeholder="https://yoursite.com"
            type="url"
            mono
            error={errors.embedUrl}
          />

          {/* Socials grid */}
          <div className="flex flex-col gap-2">
            <span
              className="font-sans text-[11px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-secondary)' }}
            >
              Socials
            </span>
            <div className="grid grid-cols-2 gap-3">
              {(['github', 'twitter', 'instagram', 'linkedin'] as const).map((platform) => (
                <input
                  key={platform}
                  type="text"
                  value={form[platform]}
                  onChange={update(platform)}
                  placeholder={platform}
                  className="font-mono text-xs px-3 py-2.5 outline-none transition-all duration-200"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                  }}
                />
              ))}
            </div>
          </div>

          <InputField
            id="connections"
            label="Connections"
            value={form.connections}
            onChange={update('connections')}
            placeholder="friend-id, another-friend-id"
            mono
          />
          <p className="font-mono text-[10px] -mt-5" style={{ color: 'var(--text-muted)' }}>
            Comma-separated IDs of people you know in the webring
          </p>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="bio"
              className="font-sans text-[11px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-secondary)' }}
            >
              Bio
            </label>
            <textarea
              id="bio"
              value={form.bio}
              onChange={update('bio')}
              placeholder="A quick line about you (280 chars max)"
              rows={3}
              maxLength={280}
              className="font-sans text-sm px-4 py-3 outline-none resize-none transition-all duration-200"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="group flex items-center justify-center gap-2.5 px-6 py-3.5 font-sans text-sm font-medium uppercase tracking-widest transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98]"
            style={{
              background: 'var(--accent-1)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              border: 'none',
            }}
          >
            <span>Join the Web</span>
            <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
