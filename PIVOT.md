# Architecture Pivot: From Form-Only to Database + Serverless

This document describes the pivot from the original design (form → GitHub commit → redeploy) to a new architecture that supports connection updates after join, uses a database, and keeps backend minimal.

---

## What Is the Pivot?

We are moving from a **static, file-based** model to a **database-backed** model with **minimal serverless** API routes. The goal is to support:

1. **Connection updates after join** — Members can add or remove connections to other members after they've joined, without admin involvement.
2. **Instant updates** — New members and connection changes appear immediately, without waiting for a Vercel redeploy (1–2 minutes).
3. **No traditional accounts** — We use email + magic link for identity, not passwords or a full login system.
4. **Minimal backend** — Only two serverless API routes; everything else is frontend talking directly to the database where possible.

---

## What Is Changing?

### Data Storage

| Before | After |
|--------|------|
| `data/members.json` in git | **Supabase** (Postgres) |
| Read at build time; writes via GitHub Contents API | Read/write at runtime via Supabase client |
| Every change = commit → redeploy | Every change = DB write → instant |

### Join Flow

| Before | After |
|--------|------|
| Form → POST /api/join → email admin | Same |
| Admin clicks → GET /api/approve → GitHub API commit | Admin clicks → GET /api/approve → **insert into Supabase** |
| New member appears after redeploy (1–2 min) | New member appears **immediately** |

### Connection Updates

| Before | After |
|--------|------|
| **Not supported** — connections set only at join time | **Supported** — members can add/remove connections anytime |
| N/A | Member enters email → magic link → edit form → update Supabase (client + RLS) |

### Identity

| Before | After |
|--------|------|
| None — no way to identify members after join | **Email** — collected at join, used for magic link |
| Admin approval only | Admin approval + member can later edit own connections via magic link |

### Backend

| Before | After |
|--------|------|
| 2 API routes (join, approve) + GitHub API | 2 API routes (join, approve) + **Supabase** |
| No server to run (Vercel serverless) | Same — no 24/7 server |
| Nodemailer for admin email | Same (or Resend/SendGrid) |

---

## How We Are Tackling the Changes

### 1. Supabase as the Data Layer

- **Database**: Postgres via Supabase. One `members` table with columns: `id`, `name`, `email`, `embed_url`, `socials` (JSONB), `connections` (JSONB array), `screenshot_url`, `joined_at`, `approved`, `program`.
- **Auth**: Supabase Auth with magic link (`signInWithOtp`). No passwords. Member enters email → Supabase sends link → they click → JWT issued.
- **Row Level Security (RLS)**: Policies ensure members can only update their own row (e.g. connections). Public read for listing all members.

### 2. Frontend → Database Direct (Where Possible)

- **Read members**: Client fetches from Supabase directly. No API route.
- **Update my connections**: Client uses JWT from magic link + Supabase client. RLS enforces "only your row." No custom API route.
- **Screenshots**: Store URL in `screenshot_url`; actual image in Vercel Blob or similar. Generated via Microlink (on-demand or at build).

### 3. Minimal Backend (2 API Routes)

We still need server-side logic for two flows:

| Route | Purpose | Why it can't be frontend-only |
|-------|---------|-------------------------------|
| `POST /api/join` | Validate form, send admin email with approve link | Email credentials must stay server-side |
| `GET /api/approve` | Verify HMAC token, insert new member into Supabase | Token verification needs `APPROVAL_SECRET` (cannot be in client) |

Both run as Vercel serverless functions. No separate backend server. Cold starts are typically 1–5 seconds and acceptable for these infrequent actions.

### 4. Join Form Updates

- Add **email** field (required) — used for magic link when member wants to edit connections later.
- Keep existing fields: name, embedUrl, socials, connections, bio.
- Validation: Zod schema (client + server).

### 5. New "Edit My Connections" Flow

1. Member visits a page (e.g. `/edit` or link from their node).
2. Enters their email.
3. Supabase Auth sends magic link.
4. Member clicks link → lands on edit page with JWT.
5. Client loads their profile from Supabase, shows form to add/remove connection IDs.
6. On submit, client updates `connections` in Supabase. RLS allows it because JWT matches the row.
7. Change is live immediately — no redeploy.

### 6. No 24/7 Server

- Vercel serverless: runs on demand, no always-on cost.
- Supabase: managed service, free tier available.
- No cold-start concerns for the bulk of the app (reads, connection updates) — those hit Supabase directly. Only join and approve hit our API routes.

---

## Summary Diagram

```
                    BEFORE (original)
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Join Form    │────▶│ POST /api/join│────▶│ Admin Email │
└─────────────┘     └──────────────┘     └──────┬──────┘
                                                │
                                                ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ members.json│◀────│ GET /api/approve  │◀────│ Approve URL │
│ (in git)    │     │ → GitHub API      │     └─────────────┘
└──────┬──────┘     └──────────────────┘
       │
       ▼
  Vercel redeploy (1–2 min)
  No connection updates after join


                    AFTER (pivot)
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Join Form   │────▶│ POST /api/join│────▶│ Admin Email │
│ + email     │     └──────────────┘     └──────┬──────┘
└─────────────┘                                │
                                               ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Supabase   │◀────│ GET /api/approve  │◀────│ Approve URL │
│  (Postgres) │     │ → insert member    │     └─────────────┘
└──────┬──────┘     └──────────────────┘
       │
       │  Client reads/updates directly (with JWT + RLS)
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ Edit connections: email → magic link → JWT → update DB   │
│ (no API route, no redeploy)                              │
└─────────────────────────────────────────────────────────┘
```

---

## What Stays the Same

- Spider-Verse visual design and aesthetic
- 2D force-directed graph (D3 or custom layout)
- Member nodes with screenshots, polygon shapes, accent colors
- Join form styling and validation (plus email)
- Admin approval gate (no self-service join without approval)
- Vercel deployment
- No Three.js, no admin dashboard UI, no live iframes in nodes

---

## Migration Path

1. Set up Supabase project, create `members` table, configure RLS.
2. Add email to join form and `Member` type.
3. Implement `POST /api/join` and `GET /api/approve` to write to Supabase instead of GitHub.
4. Update data fetching: replace `getMembers()` from file with Supabase client query.
5. Build "Edit my connections" flow: email entry → magic link → edit form → Supabase update.
6. Deprecate or remove GitHub API and `members.json` as source of truth.
7. Update screenshot flow to work with Supabase (store URLs, generate/cache images as needed).
