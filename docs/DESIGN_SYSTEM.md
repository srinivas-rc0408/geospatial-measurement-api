# Design System — "Apple-grade" frontend

We follow Apple's Human Interface principles — **clarity, deference, depth** — not Apple's assets.
The UI should feel calm, confident and precise. The content (map + numbers) is the hero; the
chrome gets out of the way. When in doubt: remove, align, add whitespace.

**Dark-first.** The default theme is dark on a true black `#000000` page, like a Pro product page.
Light is an option in the theme toggle (Dark → Light → System); the choice is stored in
`localStorage`, and with nothing stored the page is dark — also before any script runs.
**Restraint is the brand:** one accent (blue), lots of black space, large confident type, hairline
separators, subtle depth. No neon, no rainbow gradients, no glass except the nav, toasts, banners
and sheets.

## 1. Principles
1. **One idea per screen section.** Big headline, one sentence, one action.
2. **Typography does the work.** Hierarchy comes from size and weight, not colour or boxes.
3. **Generous whitespace.** Sections breathe (96–128 px vertical on desktop, 64 px mobile).
4. **Restraint in colour.** Neutral greys + one blue accent. Status colours only for status.
5. **Motion explains, never decorates.** Every animation serves orientation, feedback or continuity.
   Short, eased, interruptible; nothing loops forever except loading indicators (and the hero's
   near-static contour drift); opacity-only for reduced-motion users.
6. **Precision.** Numbers are tabular, units always shown, rounding consistent, nothing jitters.
7. **Every state is designed:** loading, empty, waking-server, processing, error, partial results.

## 2. Tokens (define once as CSS variables in `src/styles/tokens.css`, map into Tailwind theme)

### Colour — light (toggle option)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#ffffff` | page |
| `--bg-secondary` | `#f5f5f7` | alternate sections, table header |
| `--surface` | `#ffffff` | cards |
| `--fill` | `rgba(120,120,128,0.12)` | inputs, segmented control track |
| `--text` | `#1d1d1f` | primary text |
| `--text-secondary` | `#6e6e73` | supporting text |
| `--text-tertiary` | `#6e6e73` | captions, placeholders (`#86868b` is 2.9:1 on fill — fails AA) |
| `--separator` | `rgba(0,0,0,0.08)` | hairlines |
| `--accent` | `#0071e3` | primary buttons, focus, map features |
| `--accent-fill` | `#0071e3` | primary button background (white text 4.70:1) |
| `--accent-fill-hover` | `#0068d1` | primary button hover (darker, so white text stays AA) |
| `--link` | `#0066cc` | inline links |
| `--success` | `#1f7734` | MEASURED (text); dot `#34c759` (`#248a3d` is 3.5:1 on fill) |
| `--warning` | `#b25000` | warnings (text); dot `#ff9f0a` |
| `--danger` | `#d70015` | FAILED (text); dot `#ff3b30` |
| `--neutral` | `#636366` | NOT_APPLICABLE / UNSUPPORTED (text); dot `#8e8e93` |

### Colour — dark (default)
| Token | Value |
|---|---|
| `--bg` | `#000000` |
| `--bg-secondary` | `#1c1c1e` |
| `--surface` | `#1c1c1e` (elevated: `#2c2c2e`) |
| `--fill` | `rgba(118,118,128,0.24)` |
| `--text` | `#f5f5f7` |
| `--text-secondary` | `#a1a1a6` |
| `--text-tertiary` | `#9c9ca1` (`#6e6e73` is 2.5:1 on fill) |
| `--separator` | `rgba(255,255,255,0.12)` |
| `--accent` | `#2997ff` (`--accent-fill` stays `#0071e3`: white on `#2997ff` is 2.9:1) |
| `--link` | `#2997ff` |
| `--success` | `#30d158` · `--warning` `#ffd60a` · `--danger` `#ff6961` (dot `#ff453a`, 3.8:1 as text) · `--neutral` `#9c9ca1` |

All text/background pairs must meet **WCAG AA** (4.5:1 body, 3:1 large). Check them.
Values marked with a rejected original were darkened (light) or lightened (dark) from Apple's
palette because the original failed AA on `--fill`; status dots keep the original hue.

Supporting tokens (both themes, see `tokens.css`): `--surface-elevated`, `--fill-hover`,
`--segment-thumb`, `--on-accent`, `--*-dot`, `--nav-glass`, `--overlay`, `--card-shadow`.
Status text is never placed on `--fill`; status pills use a hairline border instead.

### Typography
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter Variable", "Inter", "Helvetica Neue", Arial, sans-serif`.
  Self-host **Inter Variable** via `@fontsource-variable/inter` for non-Apple devices. Never bundle SF Pro.
- Monospace (IDs, CRS codes, curl): `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`.
- `font-feature-settings: "tnum"` (tabular numbers) on every number display.
- `-webkit-font-smoothing: antialiased`.

| Style | Desktop | Mobile | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Display (hero) | 64px | 40px | 600 | -0.025em | 1.05 |
| Title 1 | 48px | 32px | 600 | -0.02em | 1.08 |
| Title 2 | 32px | 26px | 600 | -0.015em | 1.12 |
| Title 3 | 21px | 19px | 600 | -0.01em | 1.2 |
| Body | 17px | 17px | 400 | -0.01em | 1.47 |
| Callout | 15px | 15px | 400 | -0.005em | 1.4 |
| Caption | 13px | 13px | 400 | 0 | 1.38 |
| Big number (stat) | 48px | 36px | 600 | -0.02em | 1 |

### Layout & spacing
- 4 px base grid. Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- Content width: **980 px** for marketing sections; **1200 px** for the results workspace.
- Side padding: 22 px mobile, 40 px tablet, auto-centred desktop.
- Breakpoints: 390 (design target mobile), 734, 1068, 1440.

### Shape, depth, material
- Radius: 8 (inputs, chips), 12 (small cards, table container), 18 (large cards, dropzone),
  9999 (pill buttons, status pills).
- Shadow (light only; dark uses elevation colour instead):
  `0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.06)`.
- **Glass navigation bar**: height 52 px, sticky, `background: rgb(255 255 255 / 0.72)`
  (dark: `rgb(22 22 23 / 0.72)`), `backdrop-filter: saturate(180%) blur(20px)`, hairline bottom border.
- Hairlines: 1 px `--separator`. No heavy borders anywhere.

### Motion
- Easing: `cubic-bezier(0.25, 0.1, 0.25, 1)` (standard), `cubic-bezier(0.32, 0.72, 0, 1)` (sheets/drawers).
- Durations: 150 ms (hover/press), 250 ms (fades, pills), 400 ms (section reveal, drawer).
- Section reveal: opacity 0→1, translateY 12px→0, once, on scroll into view.
- Press feedback: `scale(0.98)` on buttons.
- Numbers: count-up ≤ 600 ms when results first appear.
- `prefers-reduced-motion: reduce` → no transforms, opacity only, durations ≤ 100 ms.
- CSS transitions/keyframes first; the `motion` library only for what CSS cannot do: the
  dropzone → progress card shared-layout morph, scroll reveals, and number count-ups.
- Route change: 200 ms fade-in of the page.

## 3. Brand
- **Mark** (`frontend/src/assets/logo-mark.svg`, the single source): an irregular four-sided survey
  parcel drawn with a 2-unit stroke over a faint 8-unit grid, with an accent dimension line (end ticks)
  under its measured base edge. Geometric, readable at 16 px; never Apple-like.
- **Wordmark:** "Geo Measure", weight 600, 19 px, beside the mark (`Logo` component).
- `npm run gen:brand` renders the favicon (SVG + 32 px PNG), the 180 px apple-touch-icon, the
  1200×630 Open Graph image and `docs/images/logo.svg` from the mark. `theme-color` is `#000000`.

## 4. Components (in `src/components/ui/`)
| Component | Spec |
|---|---|
| `Button` | Variants: `primary` (accent pill, white 17px text, h-11, px-5), `secondary` (fill bg, text colour), `ghost` (link colour, optional trailing chevron `›`). States: hover, active (scale .98), focus-visible (2 px accent ring, 2 px offset), disabled (40% opacity), loading (spinner, label kept for width). |
| `Card` | surface, radius 18, shadow, padding 24/32. |
| `StatusPill` | dot + label, pill, 13px semibold; colours per status. `role="status"` where live. |
| `SegmentedControl` | Apple-style: fill track, white sliding thumb with subtle shadow; keyboard arrows. Used for filters and unit toggles. |
| `Stat` | label (caption, secondary) above big number + unit (unit in secondary colour, smaller). |
| `Table` | hairline rows, no vertical lines, sticky header on `--bg-secondary`, row hover fill, selected row accent tint, numbers right-aligned tabular. |
| `Sheet/Drawer` | right side on desktop (420 px), bottom sheet on mobile; overlay `rgba(0,0,0,.3)`; focus trap; Esc closes. |
| `Toast` | top-centre, glass, auto-dismiss 4 s, `aria-live="polite"`. |
| `Skeleton` | `--fill` blocks with a gentle shimmer (static under reduced motion). |
| `CodeBlock` | mono 13px, `--bg-secondary`, radius 12, copy button with "Copied" feedback. |
| `Icon` | `lucide-react`, stroke 1.75, 20 px default. No emoji in UI. |

## 5. Pages

### Global
- Glass nav: left wordmark **"Geo Measure"** (text, weight 600, 19px); right: "Files", "API Docs ↗"
  (backend `/docs`), "GitHub ↗", theme toggle.
- Footer: caption-size, secondary text: "Built by Srinivas R C for the Aereo SDE Intern assignment",
  links GitHub / Portfolio, "Map data © OpenStreetMap contributors · Tiles: OpenFreeMap".

### `/` Home
1. **Hero** (centred, 980 px; fills the viewport under the nav from 1068 px): eyebrow caption
   "Geospatial File Measurement API"; display headline **"Measure every site. Precisely."**; body
   (secondary, max 640 px): "Upload a Shapefile or KML. Get areas and lengths in metres — computed in
   the right projection for every feature, and cross-checked against the Earth's true shape."
   Actions: primary "Upload a file" (opens the file picker), ghost "Try a sample ›".
   Background: topographic contour lines (one SVG hill outline at several scales, ~30% of tertiary
   text, faded at the edges) drifting a few pixels over a minute with CSS only, plus a soft radial
   accent glow behind the headline. Entrance: eyebrow → headline → body → actions fade up, 80 ms apart.
2. **"Measure a file"** — dropzone card (radius 18, dashed 1.5 px `--separator`; drag-over: accent
   border, elevated surface, scale 1.01): icon, "Drop a .zip, .kml or .kmz here", caption
   "Max 10 MB · Shapefile ZIP must include .shp, .shx and .dbf", "Choose file" button (the keyboard
   path). Client checks (type, empty, size) and server errors 413/415/422 show inline below the card:
   the reason, then what to do next.
3. **Samples** ("Or try a sample"): three cards — Mine site survey (KML), Land parcels (Shapefile,
   UTM 43N), Web Mercator trap (Shapefile) — type badge, one-line description, "Measure ›". A sample is
   fetched from `/samples/` and goes through exactly the same upload flow.
4. **How it works** (3 columns → stacked): Upload → Reproject → Measure; revealed once on scroll.
5. **Why projection matters** on `--bg-secondary`: "1,000,000 m²" (struck, secondary, "Naive, in Web
   Mercator") vs **"944,917 m²"** ("Correct, in UTM 43N", counts up once in view), one explanation,
   "Learn how ↗" to the backend README's CRS section.
6. **Built for accuracy**: four facts with icons — per-feature UTM zones, geodesic cross-check,
   invalid polygon repair, one bad feature never fails the file.
7. **For developers**: `CodeBlock` with the curl upload command for the configured API base URL,
   links to API Docs and GitHub.

### Upload → processing state
- XHR upload with a real percentage. The dropzone card morphs (shared layout) into a progress card:
  filename, size, a 3-step indicator **Uploaded → Processing → Measured**, a progress bar
  (determinate while uploading). `aria-live` announces each step, not each percent.
- Polls `GET /api/files/{id}` every second while `PENDING`/`PROCESSING`. On `COMPLETED`: the
  Measured step shows for 600 ms, a toast confirms, then `/files/:id` opens. On `FAILED`: an error
  card with the server's reason and "Try another file".
- **Cold start** (app-wide): `/health/ready` is called on load; while any request has waited
  more than 2.5 s, a glass banner says "Waking up the server — free hosting sleeps when idle. This can
  take up to a minute." and fades out when the server answers.

### `/files/:id` Results workspace (1200 px)
- Header: filename (Title 2), StatusPill, meta line (caption): type · source CRS · N features ·
  processed time; actions: "Download GeoJSON" (saves the already-loaded GeoJSON), "Copy API link"
  (toast "API link copied"), "Upload another ›". Warnings: `--warning`-tinted banner.
- **Stats row** (4 cards, count-up once in view): Total area (ha ↔ m² toggle), Total length
  (km ↔ m toggle), Measured (n of N), Needs attention (FAILED + UNSUPPORTED). The unit toggles also
  switch the list.
- **Main split** (desktop 7/5, map sticky below the nav; stacked below 1068 px, map first):
  - **Map** card (360 px mobile, 520 px desktop, fixed so nothing shifts): MapLibre (own chunk,
    loaded only here), OpenFreeMap `dark` / `positron` following the theme. Starts 1.5 zoom levels
    out and eases onto `bbox`. Polygons: accent fill 18% + 2 px stroke; lines 3 px; points white
    7 px with a 2 px ring; FAILED/UNSUPPORTED in the neutral dot colour. Hover: pointer + glass
    tooltip (name, type · measurement). Click: select (thicker stroke, 40% fill) and open the sheet.
    Controls: zoom (44 px, glass), "Fit to data", visible attribution. Touch: two-finger pan.
  - **Measurements**: SegmentedControl filter All / Measured / Needs attention. From 734 px a table
    — # · Name (type · layer underneath) · Measurement (sortable, right-aligned, tabular) · Status;
    hairline rows, sticky header below the nav, row hover fill, selected row accent tint; the whole
    row is the click target. Below 734 px a card per feature instead (never a sideways-scrolling
    table). Pages of 100 beyond that. A row selects the feature, flies the map to it, opens the sheet.
- **Feature detail sheet** (right 420 px on desktop, bottom on mobile): name, type · layer,
  StatusPill; projected value, perimeter, geodesic value, difference % and measurement CRS, each
  term with an ⓘ tooltip in plain English; messages; original properties in source order;
  "Copy GeoJSON". Esc closes and returns focus to the row.
- States: skeletons with the final sizes; the 3-step processing card if opened early; full-width
  cards for FAILED (server reason), unknown id ("File not found") and load errors (with retry).

### `/files` History
- Table/list of uploads (newest first): filename, type, status pill, features, total area, time;
  click → results. Empty state: friendly sentence + "Upload a file".
- Delete action with confirmation sheet.

### 404 / error boundary
- Calm centred message, "Back to home". The error boundary logs to console only in dev.

## 6. Copy rules
- Short sentences. Plain words. Active voice. No exclamation marks. No jargon without a hint
  (e.g. "CRS (coordinate reference system)" on first use, tooltips elsewhere).
- Units always shown: m², ha, m, km. Area: 0 decimals for m², 2 for ha; length: 1 decimal for m,
  2 for km. Number grouping with `Intl.NumberFormat("en-US")` (1,000,000) everywhere — one
  formatter module, never ad-hoc `toFixed` in components.

## 7. Accessibility & quality bars
- Keyboard: everything reachable, visible focus ring, logical order, Esc closes sheets.
- Screen readers: landmarks, labelled buttons/inputs, `aria-live` for status, map has a text
  alternative (the table).
- Targets ≥ 44×44 px on touch.
- Lighthouse (production build): Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO ≥ 90.
- No layout shift on load (CLS < 0.05). Map library lazy-loaded only on the results page.
- `<title>` per page, meta description, favicon (simple geometric mark, not Apple-like logo),
  Open Graph image (1200×630) for link previews.
