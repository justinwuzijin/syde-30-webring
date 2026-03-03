# Technical Architecture

## System Overview

```
  User visits   ──▶  Vercel CDN  ──▶  Next.js (static + SSR)
                                            │
                                     data/members.json
                                     (read at build time)

  User submits       POST /api/join
  join form     ──▶  ─────────────  ──▶  Nodemailer  ──▶  Gmail (admin inbox)
                                                                │
  Admin clicks  ──▶  GET /api/approve?token=...                ▼
  email link         ──────────────────────────────▶  GitHub Contents API
                                                       (commits members.json)
                                                                │
                                                                ▼
                                                       GitHub push detected
                                                                │
                                                                ▼
                                                       Vercel auto-redeploys
                                                       (picks up new member)
```

**Key constraint**: Vercel serverless functions have a read-only filesystem at runtime. The approve flow commits member data directly to the GitHub repo via the Contents API. Vercel's GitHub integration picks up the commit and redeploys automatically — no deploy hook needed.

---

## Phase 1: Scaffold & Data

**Goal**: Running Next.js 15 app that reads `members.json` and renders a plain member list.

### Bootstrapping (non-empty directory)

The repo already has `CLAUDE.md`, `docs/`, `README.md`. Running `create-next-app` in-place will fail. Use the temp-dir merge approach:

```bash
npx create-next-app@15 /tmp/webring-scaffold --typescript --tailwind --app --src-dir --yes
cp -r /tmp/webring-scaffold/. .
rm -rf /tmp/webring-scaffold
npm install d3 framer-motion nodemailer zod
npm install -D @types/d3 @types/nodemailer
```

### Steps

1. Merge scaffold as above
2. Create `data/members.json` with 3 seed members (see CLAUDE.md)
3. Create `src/types/member.ts` — `Member` interface and `joinSchema`
4. Create `src/lib/members.ts`:
   ```typescript
   import { readFileSync } from 'fs';
   import path from 'path';
   import type { Member } from '@/types/member';

   export function getMembers(): Member[] {
     const file = path.join(process.cwd(), 'data', 'members.json');
     return JSON.parse(readFileSync(file, 'utf-8')) as Member[];
   }

   // Derive bidirectional edges from one-sided connection data
   export function getEdges(members: Member[]): Array<{ source: string; target: string; id: string }> {
     const seen = new Set<string>();
     const edges: Array<{ source: string; target: string; id: string }> = [];
     for (const m of members) {
       for (const targetId of m.connections) {
         const key = [m.id, targetId].sort().join('--');
         if (!seen.has(key)) {
           seen.add(key);
           edges.push({ source: m.id, target: targetId, id: key });
         }
       }
     }
     return edges;
   }
   ```
5. Render a `<ul>` of member names on `/` to confirm data flows end to end
6. Create `src/app/globals.css` with Spider-Verse base (see CLAUDE.md for full CSS)
7. Create `src/app/layout.tsx`

---

## Phase 2: Web Graph (Core Visual)

**Goal**: D3 force-directed layout feeding a two-layer SVG + HTML render.

### Rendering Architecture: Two Layers, No foreignObject

`<foreignObject>` + iframes inside SVG is broken on Safari and has clipping bugs in Chrome. The correct pattern is two absolutely-positioned layers sharing the same D3 zoom transform:

```
┌──────────────── position: relative container ─────────────────┐
│                                                                │
│  Layer 1 (bottom): <svg position:absolute inset:0>            │
│    <g transform="translate(x,y) scale(k)">                    │
│      <WebThread /> × N   ← SVG paths only, no HTML            │
│    </g>                                                        │
│  </svg>                                                        │
│                                                                │
│  Layer 2 (top): <div position:absolute inset:0                │
│                      transform="translate(x,y) scale(k)"      │
│                      transformOrigin="0 0">                    │
│    <MemberNode position:absolute left={x} top={y} /> × N     │
│  </div>                                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Both layers read the same `transform` from React state, which is updated by the D3 zoom handler.

### D3 + React: Pre-computation Pattern

D3 must never touch the DOM. Use D3 only for physics math, then hand positions to React state. Run the simulation synchronously to avoid hundreds of re-renders from streaming tick callbacks:

```typescript
// WebCanvas.tsx
'use client';
import { useEffect, useState, useRef } from 'react';
import * as d3 from 'd3';
import type { Member } from '@/types/member';

const ACCENT_COLORS = ['#ff2020','#0a4fff','#ffdd00','#ff6600','#cc44ff','#00cc88'];

export function WebCanvas({ members, edges }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Map<string, {x:number; y:number}>>(new Map());
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  // D3 layout: run to completion, then set state once
  useEffect(() => {
    const w = window.innerWidth, h = window.innerHeight;
    const nodes = members.map(m => ({ id: m.id }));
    const links = edges.map(e => ({ source: e.source, target: e.target }));

    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(160))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('collision', d3.forceCollide(100))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .stop();

    sim.tick(300); // Pre-compute — no streaming ticks

    const pos = new Map((nodes as any[]).map(n => [n.id, { x: n.x, y: n.y }]));
    setPositions(pos);
  }, [members, edges]);

  // D3 zoom: update React state only — never mutate DOM
  useEffect(() => {
    if (!svgRef.current) return;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', e => setTransform({ x: e.transform.x, y: e.transform.y, k: e.transform.k }));
    d3.select(svgRef.current).call(zoom);
  }, []);

  const t = transform;
  const svgTransform = `translate(${t.x},${t.y}) scale(${t.k})`;
  const htmlTransform = `translate(${t.x}px,${t.y}px) scale(${t.k})`;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* SVG threads layer */}
      <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <g transform={svgTransform}>
          {edges.map((edge, i) => (
            <WebThread key={edge.id} source={positions.get(edge.source)} target={positions.get(edge.target)} index={i} />
          ))}
        </g>
      </svg>

      {/* HTML nodes layer */}
      <div style={{ position: 'absolute', inset: 0, transform: htmlTransform, transformOrigin: '0 0' }}>
        {members.map((m, i) => {
          const pos = positions.get(m.id);
          if (!pos) return null;
          const nodeSize = Math.min(120 + m.connections.length * 10, 200);
          return (
            <MemberNode key={m.id} member={m} position={pos} size={nodeSize}
                        accent={ACCENT_COLORS[i % ACCENT_COLORS.length]} />
          );
        })}
      </div>
    </div>
  );
}
```

### Force Simulation Parameters

```
linkDistance:  160   px between connected nodes
chargeStrength: -350  repulsion between all nodes
collideRadius:  100   minimum center-to-center clearance
tick count:     300   iterations run synchronously before first render
```

### Web Threads (`WebThread.tsx`)

SVG quadratic bezier with draw-in animation:

```tsx
export function WebThread({ source, target, index }: Props) {
  if (!source || !target) return null;
  const mx = (source.x + target.x) / 2;
  const my = (source.y + target.y) / 2 - 40; // droop upward
  const d = `M ${source.x} ${source.y} Q ${mx} ${my} ${target.x} ${target.y}`;
  return (
    <path d={d} fill="none" stroke="#e8e0d0" strokeWidth={1.5} opacity={0.35}
          className="web-thread"
          style={{ animationDelay: `${index * 80}ms` }} />
  );
}
```

```css
/* globals.css */
.web-thread {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawThread 1.4s ease forwards;
}
@keyframes drawThread { to { stroke-dashoffset: 0; } }
```

---

## Phase 3: Member Nodes

**Goal**: Each node is a polygon HTML div showing a Microlink screenshot.

### Node Sizing

Node size (width = height) is based on connection count:
```
size = clamp(120 + connections.length × 10, 120, 200)  // px
```

### Node Shape

Irregular polygon via `clip-path`, seeded by member ID for deterministic uniqueness:

```typescript
// Returns a clip-path polygon string based on a hash of the member ID
function polygonForId(id: string): string {
  // Simple djb2 hash → offset values for each corner
  let h = 5381;
  for (const c of id) h = ((h << 5) + h) ^ c.charCodeAt(0);
  const jitter = (seed: number) => ((seed & 0xf) - 8) * 1.5; // ±12px range
  return `polygon(
    ${jitter(h)} 0%, calc(100% - ${jitter(h >> 4)}px) ${jitter(h >> 8)}%,
    100% ${jitter(h >> 12)}%, calc(100% + ${jitter(h >> 16)}px) 100%,
    ${jitter(h >> 20)}% 100%, 0% calc(100% - ${jitter(h >> 24)}px)
  )`;
}
```

### Node Component (`MemberNode.tsx`)

```tsx
export function MemberNode({ member, position, size, accent }: Props) {
  return (
    <div style={{
      position: 'absolute',
      left: position.x - size / 2,
      top:  position.y - size / 2,
      width: size,
      height: size,
      clipPath: polygonForId(member.id),
      outline: `3px solid ${accent}`,
      boxShadow: `4px 4px 0 #000, 6px 6px 0 ${accent}`,
    }}>
      {/* Screenshot preview */}
      <img src={`/screenshots/${member.id}.jpg`} alt={`${member.name}'s site`}
           style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

      {/* Name label bar */}
      <div className="node-label">
        <span className="member-name">{member.name}</span>
        <a href={member.embedUrl} target="_blank" rel="noopener" className="visit-btn">↗</a>
      </div>
    </div>
  );
}
```

### Screenshot Generation Script

`scripts/generate-screenshots.ts` — run with `npx ts-node scripts/generate-screenshots.ts` at build prep time:

```typescript
import fs from 'fs';
import path from 'path';

const members = JSON.parse(fs.readFileSync('data/members.json', 'utf-8'));
const outDir = path.join('public', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

for (const m of members) {
  const url = `https://api.microlink.io/?url=${encodeURIComponent(m.embedUrl)}&screenshot=true&meta=false&embed=screenshot.url`;
  const res = await fetch(url);
  const json = await res.json();
  const screenshotUrl = json.data?.screenshot?.url;
  if (!screenshotUrl) continue;
  const img = await fetch(screenshotUrl);
  const buf = await img.arrayBuffer();
  fs.writeFileSync(path.join(outDir, `${m.id}.jpg`), Buffer.from(buf));
  console.log(`✓ ${m.id}`);
}
```

---

## Phase 4: Join Flow & Admin Approval

### Join Form

`/join` — Spider-Verse styled dark form. Validate on the client with Zod + React state. On success show a "WEB INCOMING — your request is in the spider's web" screen.

Fields: `name`, `embedUrl`, `socials` (all optional), `connections` (member IDs, comma-separated input), `bio` (optional, 280 chars).

### POST /api/join

```typescript
// src/app/api/join/route.ts
import { NextResponse } from 'next/server';
import { joinSchema } from '@/types/member';
import { signToken } from '@/lib/token';
import { sendApprovalEmail } from '@/lib/email';

export async function POST(req: Request) {
  const body = await req.json();
  const result = joinSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

  const data = result.data;
  const token = signToken(data); // HMAC-signed, 7-day expiry
  const approveUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/approve?token=${token}`;

  await sendApprovalEmail({ data, approveUrl });
  return NextResponse.json({ message: 'Submitted — pending review' }, { status: 202 });
}
```

### Token Signing (`src/lib/token.ts`)

```typescript
import crypto from 'crypto';

const SECRET = process.env.APPROVAL_SECRET!;

export function signToken(payload: object): string {
  const data = JSON.stringify({ payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url');
}

export function verifyToken(token: string): { payload: any } | null {
  try {
    const { data, sig } = JSON.parse(Buffer.from(token, 'base64url').toString());
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    if (sig !== expected) return null;
    const parsed = JSON.parse(data);
    if (parsed.exp < Date.now()) return null;
    return { payload: parsed.payload };
  } catch { return null; }
}
```

### GitHub Contents API (`src/lib/github.ts`)

```typescript
// Read + commit data/members.json via GitHub API — works on Vercel (no filesystem writes)
const API = 'https://api.github.com';
const REPO = process.env.GITHUB_REPO!; // e.g. "justinwu/syde-30-webring"
const TOKEN = process.env.GITHUB_TOKEN!;
const FILE_PATH = 'data/members.json';

async function ghFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API}/repos/${REPO}/contents/${FILE_PATH}`, {
    ...options,
    headers: {
      Authorization: `token ${TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...((options as any).headers ?? {}),
    },
  });
}

export async function appendMember(newMember: object) {
  // 1. Get current file (need SHA for update)
  const res = await ghFetch('');
  const file = await res.json();
  const current = JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8'));

  // 2. Append new member
  const updated = [...current, newMember];
  const content = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');

  // 3. Commit updated file
  await ghFetch('', {
    method: 'PUT',
    body: JSON.stringify({
      message: `Add member: ${(newMember as any).name}`,
      content,
      sha: file.sha,
    }),
  });
  // GitHub push → Vercel detects new commit → auto-redeploys
}
```

### GET /api/approve

```typescript
// src/app/api/approve/route.ts
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/token';
import { appendMember } from '@/lib/github';

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  const result = verifyToken(token);
  if (!result) return new Response('Invalid or expired token', { status: 403 });

  const { payload } = result;
  const newMember = {
    id: payload.name.toLowerCase().replace(/\s+/g, '-'),
    ...payload,
    approved: true,
    joinedAt: new Date().toISOString(),
  };

  await appendMember(newMember);

  return new Response(`
    <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0a0a0f;color:#f0f0f0">
      <h1 style="font-size:3rem;color:#ff2020">✓ APPROVED</h1>
      <p>${newMember.name} has been added to the webring.</p>
      <p style="color:#888">The site will redeploy in ~1 minute.</p>
    </body></html>
  `, { headers: { 'Content-Type': 'text/html' } });
}
```

---

## Phase 5: Spider-Verse Polish

### Halftone Background

Applied globally via `body::before` in `globals.css` (see CLAUDE.md). The dot grid is a CSS `radial-gradient` pattern — simple, zero runtime cost.

### Glitch / Color-Split on Hover

```css
@keyframes glitch {
  0%   { text-shadow:  2px 0 #ff0000, -2px 0 #0a4fff; }
  33%  { text-shadow: -2px 0 #ff0000,  2px 0 #0a4fff; }
  66%  { text-shadow:  2px 2px #ff0000, -2px -2px #0a4fff; }
  100% { text-shadow:  2px 0 #ff0000, -2px 0 #0a4fff; }
}
.member-name:hover { animation: glitch 0.3s steps(2) infinite; }
```

### Comic-Book Node Border

```css
.member-node {
  outline: 3px solid var(--accent);
  box-shadow: 4px 4px 0 #000, 6px 6px 0 var(--accent);
  transition: box-shadow 0.15s, outline-width 0.15s;
}
.member-node:hover {
  outline-width: 4px;
  box-shadow: 6px 6px 0 #000, 9px 9px 0 var(--accent);
}
```

### Node Float (Idle Animation)

```css
@keyframes nodeFloat {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
.member-node {
  animation: nodeFloat 4s ease-in-out infinite;
  /* Stagger by member index: style={{ animationDelay: `${index * 0.3}s` }} */
}
```

### Thread Draw Stagger

Threads stagger their draw animation by index (see Phase 2). Each thread gets `animationDelay: index * 80ms`.

### Mobile Fallback

Below `768px`, `page.tsx` renders a `<MobileGrid />` instead of `<WebCanvas />`:
- CSS grid of member cards (2 columns)
- Each card shows screenshot, name, socials icons, visit link
- No force graph, no SVG — just static layout

---

## Environment Variables

```env
# .env.local
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx   # Gmail App Password (Settings → Security → App Passwords)
ADMIN_EMAIL=your@gmail.com
APPROVAL_SECRET=<64-char hex>            # openssl rand -hex 32
GITHUB_TOKEN=ghp_...                     # GitHub PAT: repo scope (read + write contents)
GITHUB_REPO=justinwu/syde-30-webring    # owner/repo
NEXT_PUBLIC_BASE_URL=https://syde30.vercel.app
```

---

## Performance Notes

- **D3 layout**: Pre-computed synchronously via `simulation.tick(300)` — zero ongoing CPU cost
- **Screenshots**: Static images served from `/public/screenshots/` — Vercel CDN caches them globally
- **Nodes**: Plain HTML divs + CSS — no canvas, no WebGL, no overhead
- **100+ members**: SVG with ~100 paths + ~100 divs is well within browser limits
- **Mobile**: Full canvas not rendered on mobile — saves compute on lower-powered devices
