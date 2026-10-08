# Geo Measure — frontend

Single-page app for the Geospatial File Measurement API: upload a Shapefile or KML, then explore
areas and lengths on a map and in a table.

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · React Router · TanStack Query ·
openapi-typescript + openapi-fetch · MapLibre GL JS (OpenFreeMap tiles) · motion · Radix (Dialog,
Tooltip) · lucide-react · Vitest + Testing Library · Playwright (e2e) · ESLint (flat config) + Prettier. Node 24 (`.nvmrc`); every dependency
is pinned to an exact version (`.npmrc` has `save-exact=true`).

## Setup

```sh
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:8000
npm ci
npm run dev             # http://localhost:5173
```

The app refuses to start if `VITE_API_BASE_URL` is missing or is not an `http(s)://` URL.
`VITE_SITE_URL` (the deployed origin, e.g. `https://geo-measure.vercel.app`) makes the Open Graph
image URL absolute for link previews; it defaults to `http://localhost:5173`.

Deployment (Vercel, root directory `frontend/`): `vercel.json` rewrites every path to `index.html`
(client-side routing) and caches the content-hashed `/assets/*` for a year.

## Scripts

| Script                      | What it does                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `dev` / `build` / `preview` | Vite dev server, production build (`tsc -b` first), serve the build                         |
| `lint`                      | ESLint (`strict-type-checked`, react-hooks, react-refresh, jsx-a11y) and `prettier --check` |
| `typecheck`                 | `tsc -b --noEmit`                                                                           |
| `test` / `test:coverage`    | Vitest in jsdom, optionally with v8 coverage                                                |
| `format`                    | Prettier (with the Tailwind class-sorting plugin)                                           |
| `gen:api`                   | Regenerates `src/lib/api/schema.d.ts` from `../backend/openapi.json`                        |
| `gen:brand`                 | Renders the favicon, PNG icons, OG image and README logo from `src/assets/logo-mark.svg`    |
| `test:e2e`                  | Playwright: uploads every sample through the UI and checks the measurements (local only)    |

## Structure

```
src/
├── app/             router, layout (glass nav, footer, cold-start banner), theme toggle, error boundary
├── components/      Logo; ui/ design-system primitives (Button, Card, Sheet, CountUp, Reveal…)
├── features/
│   ├── home/        hero (contour background), explanation sections
│   ├── upload/      dropzone, XHR upload with progress, processing card, samples, the flow hook
│   ├── results/     header, totals, MapLibre map (lazy), measurements table/cards, detail sheet
│   └── history/     file list and delete confirmation
├── lib/api/         generated schema, typed client, XHR upload, errors, QueryClient, query hooks
├── lib/format.ts    every number, unit and date shown in the UI
├── lib/theme.ts     dark (default) / light / system preference
├── pages/           route pages (default exports); all but Home load on demand
└── styles/          tokens.css (design tokens) and global.css (type scale, base rules)
e2e/                 Playwright accuracy tests (real UI + real backend)
public/samples/      the sample files offered on the home page (copies of backend/sample_data)
```

### End-to-end accuracy tests

Run against a local backend on SQLite (never a shared database):

```sh
cd ../backend
export GEO_DATABASE_URL=sqlite:///./data/e2e.db GEO_MIGRATIONS_DATABASE_URL=sqlite:///./data/e2e.db
alembic upgrade head && uvicorn app.main:create_app --factory --port 8000
# in frontend/, another terminal:
npx playwright install chromium   # once
npm run test:e2e
```

They upload each sample and assert what the UI shows: the pit boundary is 232,000 m² (23.20 ha),
the Web Mercator square is 944,917 m², the KML has 7 features (5 measured, 1 not applicable,
1 unsupported) and the parcels Shapefile has 5.

`/dev/ui` is a gallery of every primitive in light and dark. It exists only under `npm run dev`;
CI checks that it is absent from the production bundle.

## Rules

- **Design tokens only.** Colours, radii, fonts and motion live in `src/styles/tokens.css` as CSS
  variables (light and dark) and are mapped into Tailwind with `@theme`. Tailwind's default palette
  is removed, so components can only use semantic classes such as `bg-bg`, `text-text-secondary` or
  `bg-accent-fill` — never a hex value. A missing token is added to `tokens.css` and
  `docs/DESIGN_SYSTEM.md` together.
- **API types are generated.** After a backend API change, re-export `backend/openapi.json`
  (`python -m scripts.export_openapi` in `backend/`), run
  `npm run gen:api` and commit both files; CI fails if they disagree.
- Server state goes through hooks in `src/lib/api/hooks.ts`; formatting goes through `src/lib/format.ts`.
