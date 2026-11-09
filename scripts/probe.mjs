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

const readTitle = () => page.evaluate(() => document.querySelector('.info-title h2')?.textContent ?? null)

const out = {}
out.initial = await readTitle()

await page.locator('.body-label', { hasText: '木星' }).first().click()
await page.waitForTimeout(2400)
out.afterJupiter = await readTitle()
await page.screenshot({ path: '/tmp/orrery-jupiter.png' })

// true scale
await page.getByRole('button', { name: '真实比例' }).click()
await page.waitForTimeout(2600)
out.trueScale = await page.evaluate(() => ({
  active: [...document.querySelectorAll('.seg-btn.is-active, .segmented button.is-active')].map((e) => e.textContent),
  title: document.querySelector('.info-title h2')?.textContent,
  fps: document.querySelector('.fps b, .fps span')?.textContent,
}))
await page.screenshot({ path: '/tmp/orrery-true.png' })

// back to edu, select Saturn
await page.getByRole('button', { name: '教学比例' }).click()
await page.waitForTimeout(1200)
await page.locator('.body-label', { hasText: '土星' }).first().click()
await page.waitForTimeout(2400)
await page.screenshot({ path: '/tmp/orrery-saturn-focus.png' })
out.afterSaturn = await readTitle()

// settings panel
await page.getByRole('button', { name: '设置' }).click()
await page.waitForTimeout(600)
out.settings = await page.evaluate(() => {
  const p = document.querySelector('.settings-panel, .panel.settings')
  return { text: p?.textContent?.slice(0, 400), open: !!p && getComputedStyle(p).display !== 'none' }
})
await page.screenshot({ path: '/tmp/orrery-settings.png' })
await page.keyboard.press('Escape')

// free flight
await page.getByRole('button', { name: '自由飞行' }).click()
await page.waitForTimeout(1200)
out.free = await page.evaluate(() => ({
  hud: document.querySelector('.flight-hud')?.textContent,
  mode: document.querySelector('.seg-btn.is-active')?.textContent,
}))
await page.screenshot({ path: '/tmp/orrery-free.png' })

out.errors = logs.slice(0, 20)
console.log(JSON.stringify(out, null, 2))
await browser.close()
