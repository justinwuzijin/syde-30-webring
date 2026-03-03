# Design Vision: SYDE-30 Webring

## Concept

The webring is a living, breathing Spider-Verse. Each SYDE 2030 member is a **node** in a vast web — their personal slice of the internet embedded directly in their node, visible to anyone exploring the ring. The webs that connect them aren't metaphorical; they're the literal visual connective tissue of the page.

The experience should feel like you've stumbled into an alternate dimension where the internet is spatial — you can see how people are connected, zoom into their worlds, and follow threads to discover new people.

---

## Visual Identity: Spider-Verse Aesthetic

The film's defining visual language:
- **Halftone dot patterns** as background texture and overlay effects
- **Bold, thick outlines** on UI elements (comic book inking)
- **Off-register color printing** — RGB color split/glitch on hover/focus
- **Hand-drawn feel** — slightly imperfect curves, organic line weight variation
- **High contrast** — deep blacks, vivid accent colors
- **Action lines** radiating from active nodes (like comic panels)
- **Multiple Spider-people = multiple color palettes** → each member can have a personal accent color

### Color Palette (Base)

```
Background:    #0a0a0f  (near black, deep space)
Web threads:   #e8e0d0  (aged silk / off-white)
Node border:   #ff0000  (Spider-Man red) or member's accent
Accent 1:      #ff2020  (red)
Accent 2:      #0a4fff  (Miles Morales blue)
Accent 3:      #ffdd00  (Spider-Gwen yellow)
Accent 4:      #ff6600  (Peni Parker orange)
Text:          #f0f0f0
```

Each member gets assigned one accent color from a predefined set (or can choose). Their node border, web thread color, and hover state all reflect their accent.

---

## Layout: The Web

### 2D Force-Directed Graph (Start Here)

Use D3's force simulation to arrange nodes:
- Nodes repel each other (collision force) so they don't overlap
- Connections attract linked nodes (link force) — people who are connected drift closer
- A centering force keeps everything on-screen
- The whole graph is pannable and zoomable (like a map)

The web feels **alive**: nodes gently drift, web threads sway slightly, new members cause a ripple when added.

### Potential 3D Upgrade (Later)

Three.js scene with nodes floating in z-space:
- Web threads are 3D tube geometries with a silk-like shader
- Camera can be rotated/zoomed
- Nodes face the camera (billboarding)
- More dramatic, but harder to click/interact with iframes

**Recommendation**: Ship 2D first. It's more functional and the Spider-Verse aesthetic works beautifully in 2D (the film itself is 2D-first).

---

## Member Nodes

### Shape

Each node is a **irregular polygon** — not a perfect square. Think comic panel borders: slightly tilted, rough edges. Options:
- CSS `clip-path: polygon(...)` for irregular shape
- SVG `<polygon>` or `<clipPath>` for more control
- Each member's polygon is slightly unique (randomized corner offsets seeded by their ID)

### Node Content

The node displays an embedded preview of their primary URL:

```
┌─────────────────────────────┐  ← thick colored border (accent color)
│  [iframe: their website]    │
│                             │
│  ┌──────────────────────┐   │
│  │  embedded content    │   │
│  └──────────────────────┘   │
│                             │
│  Name          @handle      │  ← name bar at bottom
└─────────────────────────────┘
```

**Iframe fallback chain:**
1. Try `<iframe src={embedUrl} />` — works for sites that allow embedding
2. `onError` / load check → swap in `<img src={screenshotUrl} />` (Microlink API)
3. If screenshot also fails → show stylized "VISIT SITE" button with halftone fill

**Node sizes:** Nodes can vary in size based on... something interesting. Ideas:
- Random within a range (for visual variety)
- Number of connections they have (more connected = bigger node)
- Time in the webring (older members = slightly larger)

### Node States

- **Default**: Idle, slight float animation, iframe or screenshot visible
- **Hovered**: Glow effect (box-shadow in accent color), web threads to their connections highlight, name/socials pop up in a tooltip overlay
- **Focused/Selected**: Expands to a larger size, shows full member card (all socials, bio blurb if any)
- **Connected**: When another node is hovered, this node glows softly if it's connected to the hovered one

---

## Web Threads (Connections)

### Visual Design

SVG `<path>` using quadratic bezier curves:
- Curve control point is offset above/below the midpoint for a natural droop
- Line weight: 1–2px normally, 3–4px on hover
- Opacity: 0.3 normally, 0.8 on hover of either endpoint
- Animation: Threads "draw in" on page load using `stroke-dashoffset` animation

### What Defines a Connection?

Members can specify connections when joining. Connections are mutual (if A lists B, B's node also shows the thread to A). Ideas for connection types:
- Friends / people they know IRL
- Shared work term / co-op location
- Shared interests/tags

Keep it simple: just a list of mutual connections specified at join time.

---

## Page Layout

### Main Canvas (`/`)
- Full-screen, no traditional navbar
- The web IS the page
- Minimal UI chrome: small logo top-left, "JOIN" button top-right, maybe a search/filter
- Pan and zoom with mouse drag + scroll wheel (D3 zoom behavior)
- On mobile: simplified layout (scrollable grid or simplified force graph)

### Join Page (`/join`)
- Spider-Verse styled form — dark background, bold typography, red accents
- Fields: Name, Website URL, Social handles, "Who do you know in this ring?" (connection nominations), optional bio
- On submit: shows a "WEB INCOMING" success screen

### Admin Panel (`/admin`)
- Simple, functional (not polished) — only Justin sees this
- List of pending join requests
- Approve/reject buttons
- Approved entries auto-write to `data/members.json` + trigger Vercel redeploy

---

## Typography

Spider-Verse uses strong typographic contrast:
- **Display / Headers**: A condensed, bold sans-serif. Options: `Bebas Neue`, `Anton`, or a custom variable font
- **Body / Names**: Clean sans-serif — `Inter` or `DM Sans`
- **Accent / Numbers**: Monospace for any data-like text — `JetBrains Mono` or `IBM Plex Mono`

All headings should feel like they could be a comic book caption box.

---

## Animation Principles

- **On load**: Nodes spawn from center, threads draw outward (sequential, not all at once)
- **Idle**: Subtle float/drift (CSS keyframe, small amplitude)
- **Thread draw**: `stroke-dasharray` + `stroke-dashoffset` animated with CSS or Framer Motion
- **Hover**: Instant glow, 200ms thread highlight transition
- **New member added**: Ripple animation from their node position outward

Keep animations meaningful and purposeful. The goal is "this feels alive," not "this is distracting."

---

## Mobile Considerations

Force-directed graph + iframe embeds is very hard to use on mobile. Options:
- Below a breakpoint, switch to a **scrollable grid** of member cards (no iframes, just screenshots + links)
- Or: a **simplified radial layout** with no iframes, just touch-navigable node cards
- The full interactive web is a desktop-first experience

---

## Future Ideas (Post-MVP)

- **Spider-sense mode**: Click a node and the camera "web-swings" to it, pulling it to center
- **Dimension filter**: Filter by SYDE cohort year, program, or tag
- **Live visitor dots**: Show who else is on the site right now (WebSocket)
- **Node customization**: Members can customize their node's accent color via a settings link
- **Easter egg**: Find the hidden Spiderman node — clicking it triggers a full-screen comic panel animation
