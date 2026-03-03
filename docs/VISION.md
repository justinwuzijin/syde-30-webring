# Design Vision: SYDE-30 Webring

## Concept

The webring is a living, breathing Spider-Verse. Each SYDE 2030 member is a **node** in a vast web — a screenshot of their personal slice of the internet frozen inside their polygon. The webs that connect them aren't metaphorical; they're the literal visual connective tissue of the page.

The experience should feel like you've stumbled into an alternate dimension where the internet is spatial — you can see how people are connected, zoom into their worlds, and follow threads to discover new people.

**This is a 2D-only experience.** No Three.js. The film itself is predominantly 2D, and the Spider-Verse aesthetic translates beautifully to a flat SVG + HTML layout.

---

## Visual Identity: Spider-Verse Aesthetic

The film's defining visual language:
- **Halftone dot patterns** — background texture applied globally via `body::before` CSS pseudo-element
- **Bold, thick outlines** on UI elements (comic book inking via `box-shadow` offsets)
- **Off-register color printing** — RGB color split/glitch on hover (CSS `text-shadow` animation)
- **Hand-drawn feel** — slightly imperfect polygon shapes, organic bezier web threads
- **High contrast** — deep blacks, vivid accent colors
- **Action lines** radiating from active nodes (optional enhancement)
- **Multiple Spider-people = multiple accent colors** → each member gets one based on join order

### Color Palette

```
Background:  #0a0a0f  (near-black, deep space)
Web threads: #e8e0d0  (aged silk / off-white)
Text:        #f0f0f0

Accent 1:    #ff2020  (red — Spider-Man)
Accent 2:    #0a4fff  (blue — Miles Morales)
Accent 3:    #ffdd00  (yellow — Spider-Gwen)
Accent 4:    #ff6600  (orange — Peni Parker)
Accent 5:    #cc44ff  (purple)
Accent 6:    #00cc88  (teal)
```

Accent colors cycle by join order: member index 0 gets accent 1, index 1 gets accent 2, etc. (mod 6). The accent drives the node's border color, `box-shadow` glow, and thread color on hover.

---

## Typography

Consistent with the film's typographic energy:

- **Display / Headers**: `Bebas Neue` (Google Fonts) — condensed, bold, caps-only. Used for page title, join page headings, success screens.
- **Body / Names**: `Inter` (Google Fonts) — clean, modern. Used for member names, form labels, UI chrome.
- **Accent / Data**: `JetBrains Mono` (Google Fonts) — monospace. Used for member IDs, social handles, status text.

All imported via a single `@import` in `globals.css`. See CLAUDE.md for the full import URL.

All headings should feel like they could be a comic book caption box.

---

## Layout: The Web

### 2D Force-Directed Graph

D3's force simulation arranges nodes organically:
- **Link force**: Connected nodes attract each other (distance 160px)
- **Charge force**: All nodes repel each other (strength -350)
- **Collision force**: Prevents overlap (radius 100px)
- **Center force**: Keeps the whole graph roughly centered on screen

The simulation runs to completion before first render — nodes don't animate from center on every load. The graph is pannable and zoomable via D3 zoom (mouse drag + scroll wheel).

---

## Member Nodes

### Shape

Each node is an **irregular polygon HTML div** shaped by CSS `clip-path: polygon(...)`. The corner offsets are deterministically derived from the member's ID (a simple hash seeded by the string), so each member has a unique but consistent shape every time. Think comic panel borders: slightly askew, roughed up.

### Size

Node size is based on connection count:
```
width = height = clamp(120 + connections.length × 10, 120, 200)  // px
```
More connected members appear slightly larger — a natural visual hierarchy that emerges from the data.

### Node Content

```
┌──────────────────────────────┐  ← polygon clip-path
│                              │  ← colored outline (accent) + shadow
│  [Microlink screenshot of    │
│   their personal website]    │
│                              │
│  [Name]              [↗]     │  ← label bar: name + visit button
└──────────────────────────────┘
```

**No live iframes inside nodes.** Screenshots (pre-generated via Microlink API at build time, cached in `public/screenshots/`) are used exclusively. Live iframes inside transformed/scaled containers are broken in Safari and unreliable in Chrome. The `↗` button opens the member's site in a new tab on click.

### Node States

- **Default**: Static screenshot, subtle float animation (CSS keyframe, ±6px vertical, 4s period), comic border
- **Hovered**: Border thickens, glow expands (`box-shadow` transition 150ms), connected web threads highlight (opacity 0.3 → 0.8), name label gets glitch animation
- **Connected to hovered**: Soft glow in the node's own accent color when a connected node is hovered

---

## Web Threads (Connections)

### Visual Design

SVG `<path>` using quadratic bezier curves (`M x1 y1 Q mx my x2 y2`):
- Control point is offset 40px above the midpoint for a natural catenary droop
- Line weight: 1.5px normally, 3px on hover of either endpoint
- Opacity: 0.35 normally, 0.8 on hover
- Color: `#e8e0d0` normally; on hover, takes the accent of the hovered node
- Draw-in animation: `stroke-dashoffset` from 1000→0, staggered by thread index × 80ms

### What Defines a Connection

Members self-report connections when they join by listing the IDs of people they know. Connections are **rendered bidirectionally** — if A lists B, the thread shows regardless of whether B listed A. Only one side needs to store the link. The `getEdges()` helper in `src/lib/members.ts` deduplicates edges at render time.

Connection types are intentionally open: friends, co-op cohort, same project team, same hometown — whatever the member chooses to specify.

---

## Page Layout

### Main Canvas (`/`)

- Full-screen, no traditional navbar
- The web IS the page content
- Minimal UI chrome:
  - Top-left: small wordmark / logo
  - Top-right: `JOIN THE WEB` button (links to `/join`)
  - Optional: search/filter input (post-MVP)
- Pan: click-drag on the background SVG
- Zoom: scroll wheel
- On mobile (`< 768px`): switch to `<MobileGrid />` — a 2-column scrollable grid of member cards (no force graph)

### Join Page (`/join`)

- Spider-Verse styled: dark background, `Bebas Neue` heading "INTO THE WEB", bold red accent
- Form fields in `Inter`, monospace placeholders in `JetBrains Mono`
- On submit: success screen with "WEB INCOMING" heading, spider-silk animation, instructions that they'll hear back when approved

### Admin Approval

There is no `/admin` UI page. Approval is entirely email-link-based:
1. Admin receives email with formatted join request data
2. Admin clicks a single "APPROVE" link
3. The `GET /api/approve` route handles the rest — commits to GitHub, page confirms

---

## Animation Principles

- **On load**: Threads draw outward sequentially (staggered `stroke-dashoffset` animation)
- **Idle**: Nodes float gently (CSS keyframe, small amplitude, long period, stagger by index)
- **Hover**: Instant glow on node, 200ms opacity transition on threads
- **Page transitions**: Framer Motion `AnimatePresence` for `/join` page enter/exit

Keep animations purposeful. The goal is "this feels alive," not "this is distracting."

---

## Mobile Layout (`< 768px`)

The force-directed graph is not rendered on mobile. Instead, `page.tsx` conditionally renders a `<MobileGrid />` component:
- CSS grid, 2 columns, auto rows
- Each card: screenshot thumbnail, member name, social icons, "Visit" link
- Dark background, accent-colored card borders
- Scrollable — full list of members

---

## globals.css Foundation

The following must be established in `src/app/globals.css` before any component work:

1. Google Fonts `@import` for `Bebas Neue`, `Inter`, `JetBrains Mono`
2. CSS custom properties (`:root`) for all color tokens (`--bg`, `--web`, `--text`, `--accent-1` through `--accent-6`)
3. Base `body` styles: `background-color: var(--bg)`, `color: var(--text)`, `font-family: 'Inter'`, `overflow: hidden`, `margin: 0`
4. `body::before` halftone dot overlay: `position: fixed`, `inset: 0`, `radial-gradient` dot pattern, `pointer-events: none`, `z-index: 1`
5. Web thread draw animation keyframes: `drawThread` (stroke-dashoffset 1000 → 0)
6. Glitch animation keyframes: `glitch` (text-shadow RGB split)
7. Node float animation keyframes: `nodeFloat` (translateY 0 → -6px → 0)

---

## Future Ideas (Post-MVP)

- **Spider-sense mode**: Click a node → camera "web-swings" to it, pulling it to center with a spring animation
- **Dimension filter**: Filter the graph by tag, co-op city, or graduation year
- **Live visitor dots**: Tiny pulsing dot on nodes of members currently viewing the site (WebSocket)
- **Node accent customization**: Members can update their accent color via an edit link in their approval email
- **Easter egg**: A hidden node somewhere in the graph — clicking it triggers a full-screen comic panel animation
- **3D upgrade**: Evaluate Three.js once the 2D version ships and the team knows what the experience needs
