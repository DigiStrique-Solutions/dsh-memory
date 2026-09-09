import { readFile } from 'node:fs/promises'
const base = 'http://127.0.0.1:3207'
export async function authenticate(page) {
  const log = await readFile(new URL('../../artifacts/server.log', import.meta.url), 'utf8')
  const url = log.match(/http:\/\/127\.0\.0\.1:3207\/\?[^\s]+/)?.[0]
  if (!url) throw new Error('Disposable Harness launch URL missing')
  // Redeem the launch token through the API context before tracing any page navigation.
  const response = await page.request.get(url)
  if (!response.ok()) throw new Error('Disposable Harness authentication failed')
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  const notice = page.getByRole('dialog', { name: 'Internal Testing Notice' })
  if (
    await notice.waitFor({ state: 'visible', timeout: 2000 }).then(
      () => true,
      () => false
    )
  )
    await notice.getByRole('button', { name: 'Continue', exact: true }).click()
  const later = page.getByRole('button', { name: 'Configure later', exact: true })
  if (
    await later.waitFor({ state: 'visible', timeout: 2000 }).then(
      () => true,
      () => false
    )
  )
    await later.click()
}
export async function rpc(page, method, payload = {}) {
  const response = await page.request.post(base + '/strique-memory/' + method, {
    data: { type: 'client-request', rpcId: 'browser-check', method, payload }
  })
  if (!response.ok()) throw new Error('HTTP ' + response.status())
  return (await response.json()).result
}
export function registerSmoke(test, expect) {
  test.use({ trace: 'off', video: 'off' })
  test.setTimeout(45000)
  test('isolated memory artifact authenticates and mounts in the real Client loader', async ({
    page
  }) => {
    await authenticate(page)
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible()
    expect((await rpc(page, 'scopes')).ok).toBe(true)
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await page.getByRole('button', { name: 'Plugins', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Memory and learning', exact: true })
    ).toBeVisible()
  })
}
export async function flow(page, info, expect) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await authenticate(page)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Memory and learning', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  const section = page.getByRole('region', { name: 'Memory and learning', exact: true })
  const preference = 'Browser QA preference: concise answers ' + Date.now()
  await section.getByRole('textbox', { name: 'Content', exact: true }).fill(preference)
  await section.getByRole('button', { name: 'Add explicit fact', exact: true }).click()
  await expect(section.getByText(preference, { exact: true })).toBeVisible()
  const fact = section
    .locator('article')
    .filter({ has: page.getByText(preference, { exact: true }) })
  await fact.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(fact.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()
  await expect(section.getByRole('status')).toHaveCount(0)
  await fact.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(fact.getByRole('button', { name: 'Archive', exact: true })).toBeVisible()
  await expect(section.getByRole('status')).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('memory-desktop.png') })
  await page.setViewportSize({ width: 1000, height: 1000 })
  await expect(
    section.getByRole('button', { name: 'Add explicit fact', exact: true })
  ).toBeVisible()
  await section.getByRole('button', { name: 'Refresh', exact: true }).click({ trial: true })
  await page.screenshot({ path: info.outputPath('memory-narrow.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
}

export async function publicationFlow(page, info, expect) {
  await authenticate(page)
  const proposed = await page.request.post(base + '/memory-verification')
  expect(proposed.ok()).toBe(true)
  const ready = JSON.parse(
    await readFile(
      new URL('../../artifacts/isolated-home/fixture-ready.json', import.meta.url),
      'utf8'
    )
  )
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Plugins', exact: true }).click()
  const section = page.getByRole('region', { name: 'Memory and learning', exact: true })
  await section
    .getByRole('combobox', { name: 'Project scope', exact: true })
    .selectOption(ready.scope)
  await section.getByRole('button', { name: 'Candidates', exact: true }).click()
  const row = section
    .locator('article')
    .filter({ has: page.getByText(ready.name, { exact: true }) })
    .filter({ hasText: 'proposed' })
    .last()
  await row.getByRole('button', { name: 'Review', exact: true }).click()
  const review = section.getByRole('region', { name: 'Review', exact: true })
  await expect(
    review.getByText('Four assertions verify the widget output.', { exact: false }).first()
  ).toBeVisible()
  await expect(
    review.getByRole('button', { name: 'Approve exact version', exact: true })
  ).toBeDisabled()
  await review.getByRole('button', { name: 'Validate package', exact: true }).click()
  await review
    .getByRole('textbox', { name: 'Decision reason', exact: true })
    .fill('Reviewed synthetic source evidence and the complete resource-bearing package')
  await page.screenshot({ path: info.outputPath('procedure-review.png') })
  await review.getByRole('button', { name: 'Approve exact version', exact: true }).click()
  await expect(review).toHaveCount(0)
  const verify = await (await page.request.get(base + '/memory-verification')).json()
  expect(verify.freshSession).toBe('memory-browser-fresh')
  expect(verify.catalog).toHaveLength(1)
  expect(verify.loaded.content).toContain('Four assertions verify the widget output.')
  expect(verify.loaded.metadata.revision).toMatch(/^[a-f0-9]{64}$/)
  const active = section
    .locator('article')
    .filter({ has: page.getByText(new RegExp(ready.name + ' · ')) })
  await active.getByRole('button', { name: 'Archive', exact: true }).click()
  await expect(active.getByRole('button', { name: 'Restore', exact: true })).toBeVisible()
  expect(
    (await (await page.request.get(base + '/memory-verification')).json()).catalog
  ).toHaveLength(0)
  await active.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(active.getByRole('button', { name: 'Archive', exact: true })).toBeVisible()
  expect(
    (await (await page.request.get(base + '/memory-verification')).json()).catalog
  ).toHaveLength(1)
  await section.getByRole('button', { name: 'Jobs and budget', exact: true }).click()
  await section.getByRole('button', { name: 'Pause extraction', exact: true }).click()
  await expect(
    section.getByRole('button', { name: 'Resume extraction', exact: true })
  ).toBeVisible()
  await section.getByRole('button', { name: 'Resume extraction', exact: true }).click()
  await page.screenshot({ path: info.outputPath('procedure-active.png') })
}
