import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildCatalog, slugify } from './models.mjs'

test('slugify creates stable browser-safe model ids', () => {
  assert.equal(slugify('2 Raspberry Pi holders + Oled.step'), '2-raspberry-pi-holders-oled')
})

test('catalog scanning preserves safe defaults and explicit metadata', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'minilab-models-'))
  const sourceDir = path.join(root, 'models')
  await mkdir(sourceDir)
  await Promise.all([
    writeFile(path.join(sourceDir, '1U Blank LaserCut.step'), 'ISO-10303-21;'),
    writeFile(path.join(sourceDir, 'Tray.step'), 'ISO-10303-21;'),
    writeFile(path.join(sourceDir, '8U Frame.step'), 'ISO-10303-21;'),
  ])

  const catalog = await buildCatalog({
    sourceDir,
    overrides: {
      rack: { id: 'rack', name: 'MiniLab 8U', heightU: 8, unitMm: 44.45 },
      models: {
        '1U Blank LaserCut.step': { name: '1U Blank', role: 'module', heightU: 1 },
        '8U Frame.step': { name: '8U Frame', role: 'frame', heightU: 8 },
        'Tray.step': { name: 'Tray', role: 'module', heightU: null },
      },
    },
    hasConvertedModel: () => false,
  })

  assert.equal(catalog.modules.length, 3)
  assert.deepEqual(catalog.modules.find((entry) => entry.id === '1u-blank-lasercut'), {
    id: '1u-blank-lasercut',
    name: '1U Blank',
    source: '1U Blank LaserCut.step',
    role: 'module',
    heightU: 1,
    manufacturingMethod: 'laser-cut',
    model: null,
    status: 'not-converted',
    mount: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      reference: 'front-center-bottom',
    },
  })
  assert.equal(catalog.modules.find((entry) => entry.id === 'tray')?.status, 'needs-review')
  assert.equal(catalog.modules.find((entry) => entry.id === '8u-frame')?.role, 'frame')
})
