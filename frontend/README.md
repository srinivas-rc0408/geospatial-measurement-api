# Geo Measure — frontend

Single-page app for the Geospatial File Measurement API: upload a Shapefile or KML, then explore
areas and lengths on a map and in a table.

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · React Router · TanStack Query ·
openapi-typescript + openapi-fetch · Radix (Dialog, Tooltip) · lucide-react ·
Vitest + Testing Library · ESLint (flat config) + Prettier. Node 24 (`.nvmrc`); every dependency
is pinned to an exact version (`.npmrc` has `save-exact=true`).

## Setup

```sh
cp .env.example .env    # VITE_API_BASE_URL=http://localhost:8000
npm ci
npm run dev             # http://localhost:5173
```

The app refuses to start if `VITE_API_BASE_URL` is missing or is not an `http(s)://` URL.

## Scripts

| Script                      | What it does                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `dev` / `build` / `preview` | Vite dev server, production build (`tsc -b` first), serve the build                         |
| `lint`                      | ESLint (`strict-type-checked`, react-hooks, react-refresh, jsx-a11y) and `prettier --check` |
| `typecheck`                 | `tsc -b --noEmit`                                                                           |
| `test` / `test:coverage`    | Vitest in jsdom, optionally with v8 coverage                                                |
| `format`                    | Prettier (with the Tailwind class-sorting plugin)                                           |
| `gen:api`                   | Regenerates `src/lib/api/schema.d.ts` from `../backend/openapi.json`                        |

## Structure

```
src/
├── app/             router, layout (glass nav, footer), theme toggle, error boundary
├── components/ui/   design-system primitives (Button, Card, StatusPill, SegmentedControl, Sheet…)
├── lib/api/         generated schema, typed client, errors, QueryClient, query hooks
├── lib/format.ts    every number, unit and date shown in the UI
├── lib/theme.ts     system / light / dark preference
├── pages/           route pages (default exports)
└── styles/          tokens.css (design tokens) and global.css (type scale, base rules)
```

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
