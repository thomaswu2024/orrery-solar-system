import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForTimeout(6000)

const title = () => page.evaluate(() => document.querySelector('.info-title h2')?.textContent ?? null)
const date = () => page.evaluate(() => document.querySelector('.time-date, .time-readout b')?.textContent ?? document.body.innerText.match(/\d{4}-\d{2}-\d{2} [\d:]+ UTC/)?.[0])

const out = {}
await page.locator('.body-label', { hasText: '木星' }).first().click({ force: true })
await page.waitForTimeout(2200)
out.jupiter = await title()

await page.getByRole('button', { name: '真实比例' }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: '/tmp/orrery-true2.png' })

await page.getByRole('button', { name: '教学比例' }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: '/tmp/orrery-edu2.png' })

// Saturn focus by clicking its label dot directly via DOM
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.body-label')].find((e) => e.textContent?.includes('土星'))
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(2200)
out.saturn = await title()
await page.screenshot({ path: '/tmp/orrery-saturn2.png' })

// time controls
const before = await date()
await page.getByRole('button', { name: '100k×' }).click()
await page.waitForTimeout(1600)
const fast = await date()
await page.getByRole('button', { name: '暂停' }).click().catch(() => {})
await page.waitForTimeout(900)
const paused = await date()
out.time = { before, fast, paused }

await page.getByRole('button', { name: '设置' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: '/tmp/orrery-settings2.png' })
out.settingsOpen = await page.evaluate(() => !!document.querySelector('.settings-panel, .panel.settings'))

await page.keyboard.press('Escape')
await page.getByRole('button', { name: '自由飞行' }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/orrery-free2.png' })

out.errors = logs.slice(0, 30)
console.log(JSON.stringify(out, null, 2))
await browser.close()
