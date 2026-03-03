# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Spider-Man: Into the Spider-Verse themed webring for SYDE 2030 (Systems Design Engineering, University of Waterloo). Unlike traditional webrings (like uwaterloo.network which is a plain table), this is a highly visual, interactive experience where:

- Members are displayed as polygon nodes arranged in a 2D (or 3D) space
- Spider-web threads visually connect members to each other
- Each member node embeds their personal website or social profile in an iframe
- Joining is done via external form → email approval → automated addition (no PR required)

See [docs/VISION.md](docs/VISION.md) for the full design vision and Spider-Verse aesthetic guide.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical architecture and decision rationale.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14 (App Router) | API routes for form/email; server components for data; easy Vercel deploy |
| Styling | Tailwind CSS + custom CSS | Tailwind for layout, raw CSS for Spider-Verse effects (halftone, glitch, comic) |
| Web graph | D3.js (force-directed) | Organic, physics-based node layout; built-in SVG; easy to animate web threads |
| Animations | Framer Motion | Node hover/focus states, page transitions |
| 3D (optional) | Three.js | Only if moving beyond SVG — assess after 2D prototype |
| Data | JSON flat file (`data/members.json`) | Simple, versionable, no DB needed at this scale |
| Email | Nodemailer + Gmail SMTP | Join form submissions → admin inbox |
| Screenshots | Microlink or ScreenshotOne API | Fallback for sites that block iframe embedding |
| Deployment | Vercel | Native Next.js support, preview deployments |

---

## Development Commands

> These will be populated once the project is bootstrapped. Expected commands:

```bash
# Bootstrap (run once)
npx create-next-app@latest . --typescript --tailwind --app --src-dir

# Install core deps after scaffold
npm install d3 framer-motion nodemailer
npm install -D @types/d3 @types/nodemailer

# Dev server
npm run dev

# Build + type check
npm run build

# Lint
npm run lint

# Type check only
npx tsc --noEmit
```

---

## Project Structure (Target)

```
syde-30-webring/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main webring canvas
│   │   ├── join/page.tsx         # Join form
│   │   ├── admin/page.tsx        # Admin approval panel (auth-protected)
│   │   └── api/
│   │       ├── join/route.ts     # Receives form → sends email
│   │       └── approve/route.ts  # Admin approval → writes to members.json
│   ├── components/
│   │   ├── WebCanvas.tsx         # D3 force graph + SVG web threads
│   │   ├── MemberNode.tsx        # Polygon node with iframe embed
│   │   ├── WebThread.tsx         # SVG path between two nodes
│   │   └── JoinForm.tsx          # Public join form
│   └── lib/
│       ├── members.ts            # Read/write members.json helpers
│       └── email.ts              # Nodemailer setup
├── data/
│   └── members.json              # Source of truth for all members
├── public/
│   └── screenshots/              # Cached fallback screenshots
└── docs/
    ├── VISION.md
    └── ARCHITECTURE.md
```

---

## Data Model

```typescript
// data/members.json — array of Member
interface Member {
  id: string;                  // kebab-case unique slug
  name: string;
  program?: string;            // e.g. "SYDE 2030"
  embedUrl: string;            // Primary URL to embed (personal site, etc.)
  socials: {
    website?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
    github?: string;
  };
  connections: string[];       // IDs of other members this person is connected to
  position?: { x: number; y: number }; // Optional fixed position override
  approved: boolean;
  joinedAt: string;            // ISO date string
}
```

---

## Key Implementation Notes

**iframe Embedding:** Many sites set `X-Frame-Options: DENY`. The strategy is:
1. Try rendering the iframe directly
2. If it fails to load (onerror), swap in a Microlink/ScreenshotOne screenshot image
3. Show the screenshot as a static preview with a "visit site" link overlay

**D3 + React:** D3 wants to own the DOM; React also wants to own the DOM. The pattern here is:
- Use D3 only for layout computation (force simulation → x, y positions)
- Render nodes and threads as React components using computed positions
- Re-run simulation on member data change; store positions in React state

**Web threads:** SVG `<path>` elements with quadratic bezier curves (`Q` command), animated with `stroke-dasharray` / `stroke-dashoffset` for a "drawing the web" effect on mount.

**Spider-Verse CSS effects:** See [docs/VISION.md](docs/VISION.md) for the halftone dot, glitch, and comic-book filter implementations.

**Join flow:**
1. User fills `/join` form
2. `POST /api/join` → Nodemailer sends email to admin with an approve link
3. Admin clicks approve link → `GET /api/approve?token=...` → writes new member to `data/members.json` → triggers Vercel redeploy via deploy hook

**Admin security:** The approve API route must validate a signed token (use `jsonwebtoken` or a simple HMAC) to prevent unauthorized additions.

---

## Development Phases

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full phase breakdown. Short version:

1. **Phase 1 — Scaffold**: Next.js setup, data model, static member list render
2. **Phase 2 — Web Graph**: D3 force layout, SVG web threads, basic nodes
3. **Phase 3 — Embedding**: iframe + screenshot fallback system
4. **Phase 4 — Join Flow**: Form, email, admin approval, auto-update
5. **Phase 5 — Spider-Verse Polish**: Visual effects, animations, mobile
