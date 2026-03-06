# UPDATE.md — Recent Changes & Setup Guide

This document describes the major updates to the SYDE 30 webring project, including the Supabase-backed auth system, join flow, and password recovery. It is intended for collaborators joining the project.

---

## Overview of Changes

The project has been updated from a static/form-only setup to a full authentication and membership system:

| Area | What Changed |
|------|--------------|
| **Data** | Members stored in Supabase (Postgres) instead of JSON files |
| **Auth** | Login, logout, and session management with JWT-style tokens |
| **Join** | Sign-up form → admin approval email → insert into Supabase |
| **Recovery** | Forgot-password flow with email reset links |
| **UI** | Landing page shows Sign up / Log in; webring overlay shows auth status |

---

## Architecture

### Database (Supabase)

- **Table:** `public.members`
- **Columns:** `id`, `name`, `email`, `password_hash`, `website_link`, `profile_picture_url`, `linkedin_handle`, `twitter_handle`, `github_handle`, `program`, `approved`, `joined_at`
- **Storage bucket:** `profile-website-pictures` for profile images (must be public for reads)

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/join` | POST | Validate sign-up form, upload profile picture, send admin approval email |
| `/api/approve` | GET | Verify HMAC token, insert approved member into Supabase |
| `/api/login` | POST | Validate email/password, return auth token |
| `/api/me` | GET | Validate auth token, return current user (used by AuthContext) |
| `/api/forgot-password` | POST | Check email exists, send password reset link |
| `/api/reset-password` | POST | Verify reset token, update password in DB |

### Pages

| Path | Purpose |
|------|---------|
| `/` | Landing page with Sign up / Log in buttons; webring overlay |
| `/join` | Sign-up form (name, email, password, program, socials, profile picture) |
| `/login` | Login form with Forgot password? link |
| `/forgot-password` | Enter email to receive reset link |
| `/reset-password?token=...` | Set new password (token from email) |

---

## Join Flow

1. User fills out `/join` form (name, email, password, program, at least one social, optional website and profile picture).
2. Form submits to `POST /api/join`.
3. API validates, hashes password, uploads profile picture to Supabase Storage.
4. API signs a payload (including `password_hash`) with HMAC and sends admin an email with an approve link.
5. Admin clicks link → `GET /api/approve?token=...` → member inserted into `members` with `approved: true`.
6. User is redirected to home page after successful sign-up.

---

## Auth Flow

- **Login:** User enters email/password at `/login` → `POST /api/login` → bcrypt compare → returns signed auth token.
- **Session:** Token stored in `localStorage`; `AuthContext` fetches `/api/me` on load to validate and get user.
- **Logout:** Clears token from `localStorage` and resets auth state.

---

## Password Recovery Flow

1. User clicks "Forgot password?" on `/login` → goes to `/forgot-password`.
2. User enters email → `POST /api/forgot-password`.
3. If email exists: send reset link (1-hour expiry) to user's email.
4. If email does not exist: return error "No account found with this email. Please sign up."
5. User clicks link → `/reset-password?token=...` → enters new password → `POST /api/reset-password` → password updated in DB.

---

## Approval Email

The admin approval email includes all submitted member info (except password):

- Name, Email, Program
- Website link (if provided)
- Profile picture URL (if uploaded)
- LinkedIn, Twitter, GitHub (full URLs)

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`). **Never commit `.env`.**

### Required Variables

| Variable | Description | Example |
|---------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) | `eyJhbGc...` |
| `GMAIL_USER` | Gmail address for sending emails | `your@gmail.com` |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not account password) | `abcd efgh ijkl mnop` |
| `ADMIN_EMAIL` | Email that receives approval requests | `admin@gmail.com` |
| `APPROVAL_SECRET` | 64-char hex for signing tokens | Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_BASE_URL` | Base URL for links in emails | `http://localhost:3000` (dev) or `https://your-app.vercel.app` (prod) |

### Gmail Setup

1. Enable 2-Step Verification on the Gmail account.
2. Create an App Password: Google Account → Security → App passwords.
3. Use the 16-character password (spaces optional) in `GMAIL_APP_PASSWORD`.

### APPROVAL_SECRET

Used to sign approval tokens, auth tokens, and reset tokens. Generate with:

```bash
openssl rand -hex 32
```

### NEXT_PUBLIC_BASE_URL

- **Local:** `http://localhost:3000`
- **Production:** Your deployed URL (e.g. `https://syde30.vercel.app`)

---

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run the migration: `supabase/migrations/001_create_members_table.sql` (via `supabase db push` or SQL Editor).
3. Create Storage bucket `profile-website-pictures` with:
   - Public read access (so profile images load)
   - Policies allowing service role to insert/update/delete

---

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Ensure `.env` is configured.

---

## Deployment (Vercel)

**You do not need to "connect" Supabase to Vercel.** Supabase is a separate cloud service. Your app talks to it via the URL and API keys in environment variables.

When deploying:

1. Deploy your Next.js app to Vercel (or any host).
2. In your host's dashboard, add the same environment variables from `.env`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `ADMIN_EMAIL`
   - `APPROVAL_SECRET`
   - `NEXT_PUBLIC_BASE_URL` — **set to your production URL** (e.g. `https://syde30.vercel.app`)

3. Supabase stays hosted on Supabase's servers. Your deployed app connects to it using those keys. No extra integration or linking is required.

---

## package-lock.json

`package-lock.json` is **committed** to the repo so all collaborators install the same dependency versions. Run `npm install` after pulling.
