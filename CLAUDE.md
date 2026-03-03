# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Spider-Man: Into the Spider-Verse themed webring for SYDE 2030 (Systems Design Engineering, University of Waterloo). Unlike traditional webrings (like uwaterloo.network which is a plain table), this is a highly visual, interactive experience where:

- Members are displayed as irregular polygon nodes arranged in a 2D force-directed graph
- Spider-web threads (SVG paths) visually connect members to each other
- Each node shows a Microlink screenshot of the member's site (screenshots pre-generated at build time)
- Joining is done via external form → email approval → automated GitHub commit (no PR required from the member)

**This is 2D only. No Three.js. No 3D.**

See [docs/VISION.md](docs/VISION.md) for the full design vision and Spider-Verse aesthetic guide.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical architecture and decision rationale.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15** (App Router) | API routes for form/email; server components for data; Vercel deploy |
| Styling | Tailwind CSS + custom CSS | Tailwind for layout; raw CSS for Spider-Verse effects (halftone, glitch, comic) |
| Web graph | D3.js (force simulation, math only) | Computes node x/y positions — React renders everything, D3 never touches DOM |
| Animations | Framer Motion | Node hover/focus states, entrance animations |
| Data | `data/members.json` (flat file in git) | Versionable, no DB needed at cohort scale; GitHub API used for writes |
| Email | Nodemailer + Gmail SMTP | Join form submissions → admin inbox with approve link |
| Screenshots | Microlink API (pre-generated at build) | Cached to `public/screenshots/` — nodes show static screenshots, not live iframes |
| Member writes | GitHub Contents API | Approve route commits updated JSON to repo; Vercel auto-redeploys on push |
| Deployment | Vercel | GitHub integration — auto-redeploys on every commit |

**Vercel's filesystem is read-only at runtime. Never write files in API routes.** All member additions go through the GitHub API.

---

## Bootstrapping (Run Once)

The repo already contains `CLAUDE.md`, `docs/`, and `README.md`, so `create-next-app` cannot run in-place. Scaffold into a temp directory and merge:

```bash
npx create-next-app@15 /tmp/webring-scaffold --typescript --tailwind --app --src-dir --yes
cp -r /tmp/webring-scaffold/. .
rm -rf /tmp/webring-scaffold

# Install additional deps
npm install d3 framer-motion nodemailer zod
npm install -D @types/d3 @types/nodemailer
```

---

## Development Commands

```bash
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build + type check
npm run lint         # ESLint
npx tsc --noEmit     # Type check only
```

---

## Project Structure (Target)

```
syde-30-webring/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout: fonts, global CSS, metadata
│   │   ├── page.tsx              # Main webring canvas (full-screen)
│   │   ├── join/page.tsx         # Public join form
│   │   └── api/
│   │       ├── join/route.ts     # POST: validate → send admin email
│   │       └── approve/route.ts  # GET: verify token → commit to GitHub
│   ├── components/
│   │   ├── WebCanvas.tsx         # D3 layout engine + layered SVG/HTML render
│   │   ├── MemberNode.tsx        # Polygon HTML div with screenshot + label
│   │   ├── WebThread.tsx         # SVG quadratic bezier path between two nodes
│   │   └── JoinForm.tsx          # Controlled form with Zod validation
│   ├── types/
│   │   └── member.ts             # Member interface + JoinFormData type
│   └── lib/
│       ├── members.ts            # Server-side: read members.json
│       ├── email.ts              # Nodemailer transport setup
│       ├── github.ts             # GitHub Contents API: read + commit members.json
│       └── token.ts              # HMAC sign/verify for approval tokens
├── data/
│   └── members.json              # Source of truth — only modified via GitHub API
├── public/
│   └── screenshots/              # Pre-generated Microlink screenshots ({id}.jpg)
└── docs/
    ├── VISION.md
    └── ARCHITECTURE.md
```

---

## Data Model

```typescript
// src/types/member.ts

export interface Member {
  id: string;             // kebab-case slug, unique
  name: string;
  program: string;        // e.g. "SYDE 2030"
  embedUrl: string;       // URL shown in node and used for screenshot
  socials: {
    website?: string;     // full URL
    twitter?: string;     // handle only, no @
    instagram?: string;   // handle only, no @
    linkedin?: string;    // handle or full URL
    github?: string;      // username only
  };
  connections: string[];  // IDs of members this person listed — rendered bidirectionally
  approved: boolean;
  joinedAt: string;       // ISO 8601
}
```

**Connections are self-reported and rendered bidirectionally.** If A lists B, a thread renders between them — even if B's `connections` array doesn't include A. Only one side needs to store the link. This avoids inconsistency in the data.

**Accent colors are auto-assigned by join order**, cycling through this predefined palette:
```
#ff2020  (red — Spider-Man)
#0a4fff  (blue — Miles Morales)
#ffdd00  (yellow — Spider-Gwen)
#ff6600  (orange — Peni Parker)
#cc44ff  (purple)
#00cc88  (teal)
```
Index into palette: `ACCENT_COLORS[members.indexOf(member) % ACCENT_COLORS.length]`

---

## Seed Data (`data/members.json`)

```json
[
  {
    "id": "justin-wu",
    "name": "Justin Wu",
    "program": "SYDE 2030",
    "embedUrl": "https://justinwu.me",
    "socials": { "github": "justinwu", "linkedin": "justinwu" },
    "connections": ["alex-chen", "sara-kim"],
    "approved": true,
    "joinedAt": "2026-03-01T00:00:00Z"
  },
  {
    "id": "alex-chen",
    "name": "Alex Chen",
    "program": "SYDE 2030",
    "embedUrl": "https://alexchen.dev",
    "socials": { "github": "alexchen", "twitter": "alexchen_dev" },
    "connections": ["justin-wu"],
    "approved": true,
    "joinedAt": "2026-03-01T00:00:00Z"
  },
  {
    "id": "sara-kim",
    "name": "Sara Kim",
    "program": "SYDE 2030",
    "embedUrl": "https://sarakim.io",
    "socials": { "instagram": "sarakim", "linkedin": "sara-kim-uw" },
    "connections": ["justin-wu", "alex-chen"],
    "approved": true,
    "joinedAt": "2026-03-02T00:00:00Z"
  }
]
```

---

## Zod Validation Schema

```typescript
// Used in both JoinForm.tsx (client) and api/join/route.ts (server)
import { z } from 'zod';

export const joinSchema = z.object({
  name: z.string().min(2).max(60),
  embedUrl: z.string().url('Must be a valid URL (include https://)'),
  socials: z.object({
    website:   z.string().url().or(z.literal('')).optional(),
    twitter:   z.string().regex(/^[A-Za-z0-9_]{1,50}$/, 'Handle only, no @').or(z.literal('')).optional(),
    instagram: z.string().regex(/^[A-Za-z0-9_.]{1,50}$/, 'Handle only, no @').or(z.literal('')).optional(),
    linkedin:  z.string().max(100).or(z.literal('')).optional(),
    github:    z.string().regex(/^[A-Za-z0-9-]{1,39}$/, 'Username only').or(z.literal('')).optional(),
  }),
  connections: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).default([]),
  bio:         z.string().max(280).optional(),
});

export type JoinFormData = z.infer<typeof joinSchema>;
```

---

## Key Implementation Notes

### Rendering: SVG threads + HTML div nodes (two-layer approach)

Do NOT use `<foreignObject>` to embed HTML inside SVG — it is broken in Safari and has clipping/scroll bugs across browsers.

Instead, use two absolutely-positioned layers that share the same D3 zoom transform:

```tsx
// WebCanvas.tsx — two-layer pattern
const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
const transformStr = `translate(${transform.x},${transform.y}) scale(${transform.k})`;

return (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {/* Layer 1: SVG threads (bottom) */}
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <g transform={transformStr}>
        {edges.map(edge => <WebThread key={edge.id} {...edge} />)}
      </g>
    </svg>

    {/* Layer 2: HTML nodes (top) */}
    <div style={{ position: 'absolute', inset: 0,
                  transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.k})`,
                  transformOrigin: '0 0' }}>
      {members.map(m => (
        <MemberNode key={m.id} member={m} position={positions.get(m.id)!} accent={accentFor(m)} />
      ))}
    </div>
  </div>
);
```

### D3 Layout: Pre-compute, don't stream ticks into React

Calling `setPositions` on every D3 tick causes hundreds of re-renders. Run the simulation to completion synchronously, then set state once:

```typescript
useEffect(() => {
  const nodes = members.map(m => ({ ...m })); // D3 mutates — clone first
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(160))
    .force('charge', d3.forceManyBody().strength(-350))
    .force('collision', d3.forceCollide(100))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .stop(); // Don't auto-start

  simulation.tick(300); // Run to completion synchronously
  setPositions(new Map(nodes.map(n => [n.id, { x: n.x!, y: n.y! }])));
}, [members, width, height]);
```

### D3 Zoom: Store in React state, don't mutate DOM

```typescript
useEffect(() => {
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      const t = event.transform;
      setTransform({ x: t.x, y: t.y, k: t.k });
    });
  d3.select(svgRef.current!).call(zoom);
}, []);
```

### Member Nodes: Screenshot-first (no live iframes in nodes)

All nodes display a pre-generated Microlink screenshot. No live iframes inside nodes — they are unreliable across browsers, especially in scaled/transformed containers.

- Screenshot URL: `/screenshots/{member.id}.jpg` (served from `/public/screenshots/`)
- Screenshots are generated at build time via a script that hits the Microlink API
- Node has a "↗ Visit" button overlay that opens `embedUrl` in a new tab
- Node size is based on connection count: `120px + (connections.length * 10px)`, capped at `200px`

### Join Flow (GitHub API, not filesystem writes)

```
User submits /join form
  → POST /api/join
      → Validate with Zod
      → HMAC-sign member data + expiry (7 days) → approval token
      → Nodemailer: email admin with token-signed approve URL
      → Return 202

Admin clicks approve URL in email
  → GET /api/approve?token=<signed>
      → Verify HMAC + expiry
      → Fetch current data/members.json SHA + content via GitHub Contents API
      → Append new member (approved: true, joinedAt: now)
      → PUT updated JSON back via GitHub Contents API (creates a commit)
      → GitHub push → Vercel detects repo change → auto-redeploys
      → Return HTML success page
```

No deploy hook needed. Vercel's GitHub integration handles redeployment automatically when the commit lands.

### globals.css Foundation

`src/app/globals.css` must establish the Spider-Verse base:

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:       #0a0a0f;
  --web:      #e8e0d0;
  --text:     #f0f0f0;
  --accent-1: #ff2020;
  --accent-2: #0a4fff;
  --accent-3: #ffdd00;
  --accent-4: #ff6600;
  --accent-5: #cc44ff;
  --accent-6: #00cc88;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  background-color: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
  overflow: hidden;
  margin: 0;
}

/* Halftone dot texture — full page, non-interactive */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px);
  background-size: 16px 16px;
  pointer-events: none;
  z-index: 1;
}
```

`src/app/layout.tsx` sets `<html lang="en">`, imports `globals.css`, and sets the page title/metadata.

---

## Environment Variables (`.env.local`)

```env
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Gmail App Password (not account password)
ADMIN_EMAIL=your@gmail.com
APPROVAL_SECRET=64-char-random-hex       # openssl rand -hex 32
GITHUB_TOKEN=ghp_...                     # PAT with repo write scope
GITHUB_REPO=justinwu/syde-30-webring    # owner/repo
NEXT_PUBLIC_BASE_URL=https://syde30.vercel.app
```

---

## Do NOT Build (explicitly out of scope for MVP)

- No Three.js or any 3D rendering
- No `/admin` dashboard UI (approval is email-link-only)
- No live iframes inside member nodes
- No WebSocket / live visitor dots
- No node accent color customization by member
- No Easter eggs
- No Vercel deploy hook (GitHub API commit triggers redeploy automatically)

---

## Build Checklist (implement in this order)

1. Scaffold Next.js 15 (temp dir merge), install deps
2. Create `src/app/globals.css` with Spider-Verse base styles and Google Fonts
3. Create `src/app/layout.tsx` with fonts metadata and globals import
4. Create `src/types/member.ts` with `Member` interface and `joinSchema` Zod schema
5. Create `data/members.json` with 3 seed members (as above)
6. Create `src/lib/members.ts` — server-side read of members.json using `fs/promises`
7. Create `src/lib/github.ts` — read + commit members.json via GitHub Contents API
8. Create `src/lib/token.ts` — HMAC sign/verify using Node.js `crypto`
9. Create `src/lib/email.ts` — Nodemailer Gmail transport
10. Build `WebCanvas.tsx` — D3 pre-computed layout, two-layer SVG/HTML render, D3 zoom → React state
11. Build `WebThread.tsx` — SVG quadratic bezier, draw animation via `stroke-dashoffset`
12. Build `MemberNode.tsx` — HTML div, polygon `clip-path`, screenshot `<img>`, label bar, visit button
13. Wire `src/app/page.tsx` — fetch members server-side, pass to `<WebCanvas />`
14. Build `src/app/join/page.tsx` + `JoinForm.tsx` — Spider-Verse styled form, Zod client validation
15. Build `src/app/api/join/route.ts` — server validation, HMAC token, Nodemailer
16. Build `src/app/api/approve/route.ts` — verify token, GitHub API commit, success page
17. Add mobile responsive fallback in `page.tsx` — below `md` breakpoint, show scrollable grid of member cards
18. Spider-Verse polish: glitch hover on node names, comic-book border/shadow, thread draw stagger, node float animation
19. Write `scripts/generate-screenshots.ts` — hits Microlink for each member, saves to `public/screenshots/`
