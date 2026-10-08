/**
 * Generates every brand asset from src/assets/logo-mark.svg, so the mark has one source of truth:
 * public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png, public/og-image.png and
 * ../docs/images/logo.svg. PNGs are rendered by Playwright's Chromium (same engine as the e2e tests).
 * Run with `npm run gen:brand` after changing the mark; the output is committed.
 */
import { readFileSync, writeFileSync } from 'node:fs'

import { chromium } from '@playwright/test'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root))
const write = (path, data) => {
  writeFileSync(new URL(path, root), data)
  console.log(`wrote ${path}`)
}

const mark = read('src/assets/logo-mark.svg').toString()
const markBody = mark.slice(mark.indexOf('>') + 1, mark.lastIndexOf('</svg>')).trim()
const markAttributes = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'

// Browser tab icon: the mark (dark-theme colours, from its CSS fallbacks) on a black rounded tile.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#000"/>
  <g transform="translate(3.2 3.2) scale(0.8)" ${markAttributes}>${markBody}</g>
</svg>
`
write('public/favicon.svg', favicon)

// README logo: mark + wordmark; follows the reader's colour scheme on GitHub.
write(
  '../docs/images/logo.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 236 40" role="img" aria-label="Geo Measure">
  <style>
    svg { --text: #f5f5f7; --text-tertiary: #9c9ca1; --accent: #2997ff; }
    @media (prefers-color-scheme: light) { svg { --text: #1d1d1f; --text-tertiary: #6e6e73; --accent: #0071e3; } }
    text { font: 600 26px -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif; letter-spacing: -0.01em; fill: var(--text); }
  </style>
  <g transform="translate(0 2) scale(1.125)" ${markAttributes}>${markBody}</g>
  <text x="48" y="29">Geo Measure</text>
</svg>
`,
)

const inter = read('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2').toString(
  'base64',
)
const page = (body, size) => `<!doctype html><html><head><style>
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${inter}) format('woff2'); font-weight: 100 900; }
  html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; background: #000; overflow: hidden; }
  body { font-family: Inter, sans-serif; color: #f5f5f7; -webkit-font-smoothing: antialiased; }
</style></head><body>${body}</body></html>`

const browser = await chromium.launch()
async function png(path, body, size) {
  const tab = await browser.newPage({ viewport: size })
  await tab.setContent(page(body, size))
  await tab.evaluate(() => document.fonts.ready)
  write(path, await tab.screenshot({ type: 'png' }))
  await tab.close()
}

const markImage = (px) =>
  `<img src="data:image/svg+xml;base64,${Buffer.from(mark).toString('base64')}" width="${px}" height="${px}" style="display:block">`

await png(
  'public/favicon-32.png',
  favicon.replace('<svg ', '<svg width="32" height="32" style="display:block" '),
  {
    width: 32,
    height: 32,
  },
)
// iOS rounds the corners itself, so the touch icon is a full-bleed square.
await png(
  'public/apple-touch-icon.png',
  `<div style="display:grid;place-items:center;height:100%">${markImage(132)}</div>`,
  { width: 180, height: 180 },
)
await png(
  'public/og-image.png',
  `<div style="position:absolute;inset:0;background:radial-gradient(600px 360px at 50% 46%, rgb(41 151 255 / 0.16), transparent 70%)"></div>
  <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:28px">
    <div style="display:flex;align-items:center;gap:22px">${markImage(96)}
      <span style="font-size:64px;font-weight:600;letter-spacing:-0.02em">Geo Measure</span></div>
    <div style="font-size:40px;font-weight:600;letter-spacing:-0.02em;color:#a1a1a6">Measure every site. Precisely.</div>
  </div>`,
  { width: 1200, height: 630 },
)
await browser.close()
