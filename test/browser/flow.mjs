import { readFile } from 'node:fs/promises'
const base = process.env.MEMORY_QA_BASE ?? 'http://127.0.0.1:3219'
const fixtureHome = process.env.MEMORY_QA_HOME ?? 'final-home'
const fixtureLog = process.env.MEMORY_QA_LOG ?? 'final-server.log'
export async function authenticate(page) {
  const log = await readFile(new URL('../../artifacts/' + fixtureLog, import.meta.url), 'utf8')
  const url = log.split(/\s+/).find((entry) => entry.startsWith(base + '/?'))
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
    await page.getByRole('button', { name: 'Memory', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: 'Memory and learning', exact: true })
    ).toBeVisible()
  })
}
export async function flow(page, info, expect) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await authenticate(page)
  await page.getByRole('button', { name: 'Memory', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Memory and learning', exact: true })
  ).toBeVisible()
  await expect(page.getByRole('status')).toHaveCount(0)
  const section = page.getByRole('region', { name: 'Memory and learning', exact: true })
  const preference = 'Browser QA preference: concise answers ' + Date.now()
  await section.getByRole('button', { name: 'Add explicit fact', exact: true }).click()
  await section.getByRole('textbox', { name: 'Content', exact: true }).fill(preference)
  await section.getByRole('button', { name: 'Save fact', exact: true }).click()
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
      new URL('../../artifacts/' + fixtureHome + '/fixture-ready.json', import.meta.url),
      'utf8'
    )
  )
  await page.getByRole('button', { name: 'Memory', exact: true }).click()
  const section = page.getByRole('region', { name: 'Memory and learning', exact: true })
  await section
    .getByRole('combobox', { name: 'Project scope', exact: true })
    .selectOption(ready.scope)
  await section.getByRole('button', { name: 'Procedures', exact: true }).click()
  const row = section
    .locator('article')
    .filter({ has: page.getByText(ready.name, { exact: true }) })
    .filter({ hasText: 'proposed' })
    .last()
  await row.getByRole('button', { name: 'Review', exact: true }).click()
  const review = section.getByRole('region', { name: 'Review', exact: true })
  await expect(
    review.getByText('Four assertions verify the widget output.', { exact: true }).first()
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
  expect(verify.loaded.content).not.toContain('Four assertions verify the widget output.')
  expect(verify.loaded.content).toContain('references/widget.md')
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
  expect((await page.request.post(base + '/memory-verification?use')).ok()).toBe(true)
  await active.getByRole('button', { name: 'Record reviewed outcome', exact: true }).click()
  const options = await rpc(page, 'outcome-options', {
    scope: ready.scope,
    name: ready.name,
    hash: verify.loaded.metadata.revision
  })
  expect(options.ok).toBe(true)
  await section
    .getByRole('combobox', { name: 'Skill use in a session', exact: true })
    .selectOption(options.value.exposures.at(-1).id)
  await section.getByRole('checkbox').last().check()
  await section.getByRole('button', { name: 'Success', exact: true }).click()
  await expect(
    section.getByRole('combobox', { name: 'Skill use in a session', exact: true })
  ).toHaveCount(0)
  await section.getByRole('button', { name: 'Activity', exact: true }).click()
  await section.getByRole('button', { name: 'Pause extraction', exact: true }).click()
  await expect(
    section.getByRole('button', { name: 'Resume extraction', exact: true })
  ).toBeVisible()
  await section.getByRole('button', { name: 'Resume extraction', exact: true }).click()
  await page.screenshot({ path: info.outputPath('procedure-active.png') })
}

export async function factReviewFlow(page, info, expect) {
  await authenticate(page)
  const proposedFact = await page.request.post(base + '/memory-verification?fact')
  expect(proposedFact.ok()).toBe(true)
  const factProposal = await proposedFact.json()
  const ready = JSON.parse(
    await readFile(
      new URL('../../artifacts/' + fixtureHome + '/fixture-ready.json', import.meta.url),
      'utf8'
    )
  )
  await page.getByRole('button', { name: 'Memory', exact: true }).click()
  const section = page.getByRole('region', { name: 'Memory and learning', exact: true })
  await expect(section.getByRole('status')).toHaveCount(0)
  await section
    .getByRole('combobox', { name: 'Project scope', exact: true })
    .selectOption(ready.scope)
  await section.getByRole('button', { name: 'Fact review', exact: true }).click()
  const row = section
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: factProposal.content, exact: true }) })
  await row.getByRole('button', { name: 'Review', exact: true }).click()
  await expect(
    row.getByText('For this fixture, run check-widget after changing a widget.', { exact: true })
  ).toBeVisible()
  await row
    .getByRole('textbox', { name: 'Decision reason', exact: true })
    .fill('Reviewed the user request')
  await row.getByRole('button', { name: 'Approve exact version', exact: true }).click()
  await expect(row.getByText('active', { exact: true })).toBeVisible()
  await section.getByRole('button', { name: 'Activity', exact: true }).click()
  await expect(section.getByText('remote-egress-disabled', { exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('learning-status.png') })
  await section.getByRole('combobox', { name: 'Project scope', exact: true }).selectOption('global')
  await section.getByRole('button', { name: 'Fact review', exact: true }).click()
  await expect(
    section.getByText('Use check-widget with verbose output.', { exact: true })
  ).toHaveCount(0)
}
