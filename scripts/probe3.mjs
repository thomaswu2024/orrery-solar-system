import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('crash', () => logs.push('[crash] page crashed'))
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.waitForTimeout(5000)

try {
  await page.locator('.body-label', { hasText: '木星' }).first().click({ force: true })
  await page.waitForTimeout(2000)
  console.log('jupiter', await page.evaluate(() => document.querySelector('.info-title h2')?.textContent))
  await page.getByRole('button', { name: '真实比例' }).click()
  await page.waitForTimeout(2500)
  console.log('alive', await page.evaluate(() => ({ title: document.title, t: performance.now(), labels: document.querySelectorAll('.body-label').length })))
  await page.screenshot({ path: '/tmp/orrery-true3.png', timeout: 15000 })
  console.log('shot ok')
} catch (e) {
  console.log('FAIL', e.message)
  console.log(logs.slice(-30).join('\n'))
}
await browser.close()
