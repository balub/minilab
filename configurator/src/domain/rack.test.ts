import { describe, expect, it } from 'vitest'
import {
  findFirstAvailableSlot,
  getOccupancy,
  movePlacement,
  placeModule,
  removePlacement,
  type ModuleDefinition,
  type RackDefinition,
} from './rack'

const rack: RackDefinition = { id: 'minilab-8u', name: 'MiniLab 8U', heightU: 8, unitMm: 44.45 }
const blank: ModuleDefinition = { id: 'blank', name: '1U Blank', heightU: 1 }
const shelf: ModuleDefinition = { id: 'shelf', name: '2U Shelf', heightU: 2 }
const unreviewed: ModuleDefinition = { id: 'mystery', name: 'Mystery', heightU: null }
const modules = [blank, shelf, unreviewed]

describe('rack placement', () => {
  it('places a module in the first contiguous opening', () => {
    const first = placeModule(rack, [], modules, blank)
    const second = placeModule(rack, first.placements, modules, shelf)

    expect(first).toEqual({ ok: true, placements: [{ instanceId: 'blank-1', moduleId: 'blank', startU: 0 }] })
    expect(second).toEqual({
      ok: true,
      placements: [
        { instanceId: 'blank-1', moduleId: 'blank', startU: 0 },
        { instanceId: 'shelf-1', moduleId: 'shelf', startU: 1 },
      ],
    })
  })

  it('rejects overlap and placements outside the rack', () => {
    const placements = [{ instanceId: 'shelf-1', moduleId: 'shelf', startU: 2 }]

    expect(movePlacement(rack, placements, [blank, shelf], 'shelf-1', 7)).toMatchObject({ ok: false, reason: 'outside-rack' })
    expect(placeModule(rack, placements, modules, blank, 2)).toMatchObject({ ok: false, reason: 'overlap' })
    expect(placeModule(rack, placements, modules, blank, -1)).toMatchObject({ ok: false, reason: 'outside-rack' })
  })

  it('derives bottom-up occupancy for multi-U modules', () => {
    const placements = [{ instanceId: 'shelf-1', moduleId: 'shelf', startU: 3 }]
    expect(getOccupancy(rack, placements, [blank, shelf])).toEqual([
      null,
      null,
      null,
      'shelf-1',
      'shelf-1',
      null,
      null,
      null,
    ])
  })

  it('does not place modules whose height still needs review', () => {
    expect(placeModule(rack, [], modules, unreviewed)).toMatchObject({ ok: false, reason: 'unknown-height' })
  })

  it('finds openings and removes only the requested instance', () => {
    const placements = [
      { instanceId: 'blank-1', moduleId: 'blank', startU: 0 },
      { instanceId: 'shelf-1', moduleId: 'shelf', startU: 2 },
    ]
    expect(findFirstAvailableSlot(rack, placements, [blank, shelf], 2)).toBe(4)
    expect(removePlacement(placements, 'blank-1')).toEqual([placements[1]])
  })
})
