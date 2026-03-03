# Technical Architecture

## System Overview

```
                    ┌─────────────────────────────────────────┐
                    │              Vercel (hosting)            │
                    │                                          │
                    │   Next.js App                           │
                    │   ┌─────────────┐  ┌─────────────────┐  │
  User visits  ──▶  │   │ / (canvas)  │  │  data/          │  │
                    │   │ /join       │  │  members.json   │  │
  Admin email  ──▶  │   │ /admin      │  │  (flat file DB) │  │
  approve link      │   └─────────────┘  └─────────────────┘  │
                    │         │                                │
                    │   ┌─────▼──────────────────────────┐    │
                    │   │   API Routes                   │    │
                    │   │   POST /api/join               │    │
                    │   │   GET  /api/approve?token=...  │    │
                    │   └──────────────┬─────────────────┘    │
                    └─────────────────┼───────────────────────┘
                                      │
                          ┌───────────▼───────────┐
                          │   Gmail (SMTP)         │
                          │   Admin notification   │
                          │   + approval link      │
                          └───────────────────────┘
```

---

## Phase 1: Scaffold & Data

**Goal**: Running Next.js app that reads `members.json` and renders a static list.

### Steps
1. `npx create-next-app@latest` with TypeScript, Tailwind, App Router
2. Create `data/members.json` with 2–3 seed members (yourself + friends)
3. Define the `Member` TypeScript interface in `src/types/member.ts`
4. Create `src/lib/members.ts` — sync file read of JSON (server-side only)
5. Render a plain `<ul>` of member names on `/` — just to confirm data flows

### Key Decision: Flat File vs. Database
For ~100 members (a SYDE cohort), a JSON flat file is sufficient. Benefits:
- No database to provision or pay for
- Member data is version-controlled (auditable)
- Vercel redeploys on file change

If the webring grows beyond one cohort or needs real-time updates, migrate to Supabase.

---

## Phase 2: Web Graph (Core Visual)

**Goal**: D3 force-directed graph rendering member nodes and web threads as SVG.

### Architecture: D3 + React Coexistence

The critical pattern — D3 computes layout, React renders:

```typescript
// WebCanvas.tsx (simplified)
'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export function WebCanvas({ members }: { members: Member[] }) {
  const [positions, setPositions] = useState<Map<string, {x: number, y: number}>>(new Map());

  useEffect(() => {
    const simulation = d3.forceSimulation(members)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide(80))
      .force('center', d3.forceCenter(width / 2, height / 2));

    simulation.on('tick', () => {
      // Update React state with new positions
      setPositions(new Map(members.map(m => [m.id, { x: m.x!, y: m.y! }])));
    });

    return () => simulation.stop();
  }, [members]);

  return (
    <svg width="100%" height="100%">
      {links.map(link => <WebThread key={...} source={positions.get(link.source)} target={positions.get(link.target)} />)}
      {members.map(m => <MemberNode key={m.id} member={m} position={positions.get(m.id)} />)}
    </svg>
  );
}
```

**Why not use D3 to render DOM?** React handles the DOM — D3 mutating the DOM directly conflicts with React's reconciler. D3 for math, React for rendering.

### Force Simulation Parameters (starting values, tweak to taste)
```
linkDistance:    150    // px between connected nodes
chargeStrength:  -300   // repulsion between all nodes
collideRadius:   80     // minimum node spacing
alphaDecay:      0.028  // how fast simulation settles (lower = more movement)
```

### SVG vs. Canvas

Use **SVG** (not `<canvas>`):
- React can render SVG elements natively — each node/thread is a component
- CSS animations work on SVG elements
- Easier to attach React event handlers
- `<foreignObject>` lets you embed HTML (including iframes) inside SVG

Switch to `<canvas>` only if performance becomes an issue with 100+ nodes.

### Pan & Zoom

Use D3's `zoom` behavior, but apply transforms to an SVG `<g>` container:
```typescript
d3.zoom().on('zoom', (event) => {
  d3.select(svgGroupRef.current).attr('transform', event.transform);
});
```

---

## Phase 3: Member Nodes & iframe Embedding

**Goal**: Each node shows an embedded preview of the member's site.

### Node Component Hierarchy

```
MemberNode (SVG <foreignObject>)
  └── NodeContainer (HTML div, clip-path polygon)
       ├── EmbedFrame
       │    ├── <iframe> (attempt 1)
       │    └── <img screenshotUrl> (fallback)
       └── NodeLabel (name + socials bar)
```

### iframe Fallback Strategy

```typescript
// EmbedFrame.tsx
function EmbedFrame({ url, memberId }: { url: string; memberId: string }) {
  const [failed, setFailed] = useState(false);
  const screenshotUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;

  if (failed) {
    return <img src={screenshotUrl} alt="Site preview" onError={() => {/* show button */}} />;
  }

  return (
    <iframe
      src={url}
      sandbox="allow-scripts allow-same-origin"
      onError={() => setFailed(true)}
      // Note: onError doesn't fire for X-Frame-Options blocks
      // Use postMessage or load event + timeout detection instead
    />
  );
}
```

**Important**: `iframe` `onError` doesn't fire for `X-Frame-Options` blocks — the iframe loads but shows an error page. Detection requires:
- A short timeout after `onLoad` — check if iframe `contentDocument` is accessible
- If cross-origin (always will be) — use a proxy or just accept screenshot fallback for all

**Simplest reliable approach**: Default to screenshot for all nodes, with an "expand to live" button that opens the iframe on click (user interaction bypasses some restrictions).

### Microlink API

Free tier: 100 requests/month per IP. For production:
- Cache screenshots to `public/screenshots/{memberId}.jpg` at build time
- Regenerate on `npm run build` or via a cron job

---

## Phase 4: Join Flow & Admin Approval

### Join Form (`/join`)

Fields:
- `name` (required)
- `embedUrl` — primary URL to display in node (required)
- `socials` — object of optional social handles
- `connections` — array of existing member IDs they know
- `bio` — optional, max 280 chars

Submit → `POST /api/join`

### API: POST /api/join

```typescript
// src/app/api/join/route.ts
export async function POST(request: Request) {
  const body = await request.json();
  // 1. Validate fields (zod schema)
  // 2. Generate a signed approval token (HMAC or JWT)
  // 3. Send email to admin with member data + approval link
  // 4. Return 200 (pending review message)
}
```

### Email Template

The email to the admin contains:
- Submitted member data (formatted)
- Approve link: `https://syde30webring.com/api/approve?token=<signedToken>`
- Reject link (just ignore, or a separate endpoint)

### API: GET /api/approve?token=...

```typescript
// src/app/api/approve/route.ts
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token');
  // 1. Verify + decode token (extract member data)
  // 2. Read data/members.json
  // 3. Append new member (approved: true, joinedAt: now())
  // 4. Write data/members.json
  // 5. Trigger Vercel deploy hook (fetch to webhook URL)
  // 6. Return success page
}
```

### Vercel Deploy Hook

In Vercel project settings → Git → Deploy Hooks → create a hook URL.
Store as `VERCEL_DEPLOY_HOOK_URL` env var.
After writing to `members.json`, call:
```typescript
await fetch(process.env.VERCEL_DEPLOY_HOOK_URL!, { method: 'POST' });
```

This triggers a redeploy which picks up the new member.

### Security

- Token: HMAC-SHA256 of the member data + a secret + expiry timestamp
- Token expires in 7 days (admin must approve within a week)
- Single-use: once approved, store token hash in a small blocklist (or just check `approved` status)
- Admin route `/admin` protected by HTTP Basic Auth or NextAuth with a single admin user

---

## Phase 5: Spider-Verse Polish

### Halftone Dot Effect

CSS + SVG filter approach:
```css
/* Halftone texture overlay */
.halftone-overlay {
  background-image: radial-gradient(circle, #ffffff22 1px, transparent 1px);
  background-size: 12px 12px;
  pointer-events: none;
}
```

For a proper halftone (dots that vary in size by brightness), use an SVG `<feTurbulence>` + `<feColorMatrix>` filter or a canvas post-process pass.

### Glitch / Color-Split Effect on Hover

```css
@keyframes glitch {
  0%   { text-shadow: 2px 0 #ff0000, -2px 0 #0a4fff; }
  25%  { text-shadow: -2px 0 #ff0000, 2px 0 #0a4fff; }
  50%  { text-shadow: 2px 2px #ff0000, -2px -2px #0a4fff; }
  100% { text-shadow: 2px 0 #ff0000, -2px 0 #0a4fff; }
}

.member-name:hover {
  animation: glitch 0.3s steps(2) infinite;
}
```

For image/iframe glitch: CSS `clip-path` animation with duplicate shifted layers.

### Comic Book Ink Border

```css
.node-border {
  outline: 3px solid var(--accent-color);
  box-shadow: 4px 4px 0 #000, 6px 6px 0 var(--accent-color);
}
```

### Web Thread Draw Animation

```css
.web-thread {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawThread 1.5s ease forwards;
}

@keyframes drawThread {
  to { stroke-dashoffset: 0; }
}
```

Stagger thread animations by index: `animation-delay: calc(var(--thread-index) * 100ms)`.

---

## Environment Variables

```env
# .env.local (never commit)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Gmail App Password, not account password
ADMIN_EMAIL=your@gmail.com
APPROVAL_SECRET=random-long-hex-string
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/...
```

---

## Performance Considerations

- **100 members**: SVG force graph is fine; no optimization needed
- **iframe rendering**: Lazy-load iframes (only render when node is in viewport or focused)
- **Screenshots**: Pre-generate at build time, serve from `/public/screenshots/`
- **D3 simulation**: Run simulation to completion off-screen before first paint (use `simulation.tick(300)`) so nodes don't animate from center on every load

---

## Open Questions / Decisions to Make

1. **2D or 3D first?** — Recommendation: 2D SVG first, evaluate 3D later
2. **Polygon shapes**: Fixed set of shapes per member? Or randomized per ID?
3. **Connection definition**: Self-reported by joining member, or bilateral confirmation?
4. **Screenshot service**: Microlink (free tier) or ScreenshotOne ($)?
5. **Admin panel**: Email-link-only approval, or build a `/admin` UI dashboard?
6. **Member count**: Is this only SYDE 2030? Open to all UW students later?
7. **Accent colors**: Assigned automatically, or let members pick from a set?
