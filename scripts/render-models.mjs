import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = path.join(root, 'docs', 'images')
const baseUrl = 'http://127.0.0.1:5173'
const require = createRequire(path.join(root, 'configurator', 'package.json'))
const { chromium } = require('@playwright/test')

async function serverIsReady() {
  try {
    const response = await fetch(baseUrl)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await serverIsReady()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

let server
if (!(await serverIsReady())) {
  server = spawn(
    'pnpm',
    ['--filter', '@minilab/configurator', 'dev', '--host', '127.0.0.1', '--port', '5173'],
    { cwd: root, stdio: 'ignore' },
  )
  await waitForServer()
}

await mkdir(outputDirectory, { recursive: true })
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1 })
  const browserErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  for (const view of ['top-left', 'top-right']) {
    const frameLoaded = page.waitForResponse(
      (response) => response.url().endsWith('/models/8u-20x20-extrusion-frame.glb') && response.ok(),
    )
    await page.goto(`${baseUrl}/?render=${view}`, { waitUntil: 'networkidle' })
    await frameLoaded
    await page.locator('canvas').waitFor({ state: 'visible' })
    await page.waitForTimeout(1800)
    await page.locator('canvas').screenshot({ path: path.join(outputDirectory, `minilab-${view}.png`) })
  }

  if (browserErrors.length) throw new Error(`Browser errors:\n${browserErrors.join('\n')}`)
  console.log(`Rendered top-left and top-right hardware views in ${path.relative(root, outputDirectory)}`)
} finally {
  await browser.close()
  server?.kill('SIGTERM')
}
