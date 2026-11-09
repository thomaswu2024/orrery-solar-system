import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5173/'
const out = process.argv[3] ?? '/tmp/orrery-shot.png'
const wait = Number(process.argv[4] ?? 7000)

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
await page.goto(url, { waitUntil: 'load' })
await page.waitForTimeout(wait)
await page.screenshot({ path: out })

const info = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.body-label')].map((el) => ({
    name: el.querySelector('.body-label-name')?.textContent,
    en: el.querySelector('.body-label-en')?.textContent,
    display: getComputedStyle(el).display,
    dotOnly: el.classList.contains('dot-only'),
    transform: el.style.transform,
  }))
  const c = document.querySelector('canvas')
  return {
    canvas: c ? [c.width, c.height, c.clientWidth, c.clientHeight] : null,
    labels: labels.filter((l) => l.display !== 'none'),
    boot: !!document.querySelector('.boot:not(.is-done)'),
    text: document.body.innerText.slice(-260),
  }
})
console.log(JSON.stringify({ errors: logs.filter((l) => l.includes('error')), info }, null, 2))
await browser.close()
