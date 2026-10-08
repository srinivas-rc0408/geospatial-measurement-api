/**
 * Uploads each bundled sample through the UI and checks the numbers a reviewer would check by hand.
 * Expected values come from the backend's own tests and README (synthetic data near Bengaluru).
 */
import { expect, test, type Page } from '@playwright/test'

const API = process.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

test.beforeAll(async ({ request }) => {
  const health = await request.get(`${API}/health`).catch(() => null)
  expect(health?.ok(), `Start the backend at ${API} first (see frontend/README.md)`).toBe(true)
})

async function measureSample(page: Page, title: string) {
  await page.goto('/')
  await page.getByRole('button', { name: `Measure the ${title} sample` }).click()
  await page.waitForURL(/\/files\/[0-9a-f]{32}$/, { timeout: 30_000 })
  await expect(page.getByRole('table')).toBeVisible()
}

/** The table row for a feature (the whole row text, e.g. "1Pit boundaryPolygon · …23.20 haMeasured"). */
const row = (page: Page, name: string) => page.getByRole('table').getByRole('row').filter({ hasText: name })

test('mine site KML: 7 features, pit boundary 232,000 m² (23.20 ha), correct status counts', async ({
  page,
}) => {
  await measureSample(page, 'Mine site survey')
  await expect(page.locator('header').filter({ hasText: 'mine_site_survey.kml' })).toContainText('7 features')
  await expect(row(page, 'Pit boundary')).toContainText('23.20 ha')
  await page.getByRole('radio', { name: 'm²' }).click()
  await expect(row(page, 'Pit boundary')).toContainText('232,000 m²')

  const table = page.getByRole('table')
  await expect(table.getByText('Measured', { exact: true })).toHaveCount(5)
  await expect(table.getByText('Not applicable', { exact: true })).toHaveCount(1)
  await expect(table.getByText('Unsupported', { exact: true })).toHaveCount(1)
  await page.getByRole('radio', { name: 'Needs attention' }).click()
  await expect(table.getByRole('row')).toHaveCount(2) // header + the unsupported 3D model
})

test('Web Mercator square: 944,917 m², not the naive 1,000,000 m²', async ({ page }) => {
  await measureSample(page, 'Web Mercator trap')
  await page.getByRole('radio', { name: 'm²' }).click()
  await expect(row(page, 'Feature 1')).toContainText('944,917 m²')
})

test('UTM parcels Shapefile: 5 features across two layers', async ({ page }) => {
  await measureSample(page, 'Land parcels')
  await expect(page.locator('header').filter({ hasText: 'parcels_utm43n.zip' })).toContainText('5 features')
  await expect(page.getByRole('table').getByRole('row')).toHaveCount(6)
  await expect(page.getByRole('table')).toContainText('access_roads')
  await expect(page.getByRole('table')).toContainText('parcels')
})
