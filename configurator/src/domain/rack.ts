export interface RackDefinition {
  id: string
  name: string
  heightU: number
  unitMm: number
}

export interface MountTransform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  reference: 'front-center-bottom'
}

export interface ModuleDefinition {
  id: string
  name: string
  heightU: number | null
  source?: string
  model?: string | null
  manufacturingMethod?: 'laser-cut'
  status?: 'ready' | 'needs-review' | 'not-converted'
  role?: 'module' | 'frame' | 'fixed-part'
  mount?: MountTransform
  preview?: {
    widthMm: number
    depthMm: number
    color: string
  }
}

export interface Placement {
  instanceId: string
  moduleId: string
  startU: number
}

export type PlacementFailure = 'unknown-height' | 'outside-rack' | 'overlap' | 'rack-full' | 'module-not-found'

export type PlacementResult =
  | { ok: true; placements: Placement[] }
  | { ok: false; reason: PlacementFailure; placements: Placement[] }

function moduleMap(modules: ModuleDefinition[]) {
  return new Map(modules.map((module) => [module.id, module]))
}

function occupiedSlots(
  rack: RackDefinition,
  placements: Placement[],
  modules: ModuleDefinition[],
  excludingInstanceId?: string,
) {
  const occupied = Array<string | null>(rack.heightU).fill(null)
  const byId = moduleMap(modules)

  for (const placement of placements) {
    if (placement.instanceId === excludingInstanceId) continue
    const heightU = byId.get(placement.moduleId)?.heightU
    if (!heightU) continue
    for (let slot = placement.startU; slot < placement.startU + heightU; slot += 1) {
      if (slot >= 0 && slot < rack.heightU) occupied[slot] = placement.instanceId
    }
  }
  return occupied
}

function canFit(
  rack: RackDefinition,
  placements: Placement[],
  modules: ModuleDefinition[],
  startU: number,
  heightU: number,
  excludingInstanceId?: string,
): PlacementFailure | null {
  if (startU < 0 || startU + heightU > rack.heightU) return 'outside-rack'
  const occupied = occupiedSlots(rack, placements, modules, excludingInstanceId)
  for (let slot = startU; slot < startU + heightU; slot += 1) {
    if (occupied[slot]) return 'overlap'
  }
  return null
}

export function getOccupancy(rack: RackDefinition, placements: Placement[], modules: ModuleDefinition[]) {
  return occupiedSlots(rack, placements, modules)
}

export function findFirstAvailableSlot(
  rack: RackDefinition,
  placements: Placement[],
  modules: ModuleDefinition[],
  heightU: number,
) {
  for (let startU = 0; startU <= rack.heightU - heightU; startU += 1) {
    if (!canFit(rack, placements, modules, startU, heightU)) return startU
  }
  return null
}

function nextInstanceId(placements: Placement[], moduleId: string) {
  const used = new Set(placements.map((placement) => placement.instanceId))
  let index = 1
  while (used.has(`${moduleId}-${index}`)) index += 1
  return `${moduleId}-${index}`
}

export function placeModule(
  rack: RackDefinition,
  placements: Placement[],
  modules: ModuleDefinition[],
  module: ModuleDefinition,
  preferredStartU?: number,
): PlacementResult {
  if (!module.heightU) return { ok: false, reason: 'unknown-height', placements }
  const startU = preferredStartU ?? findFirstAvailableSlot(rack, placements, modules, module.heightU)
  if (startU === null) return { ok: false, reason: 'rack-full', placements }
  const failure = canFit(rack, placements, modules, startU, module.heightU)
  if (failure) return { ok: false, reason: failure, placements }

  return {
    ok: true,
    placements: [...placements, { instanceId: nextInstanceId(placements, module.id), moduleId: module.id, startU }],
  }
}

export function movePlacement(
  rack: RackDefinition,
  placements: Placement[],
  modules: ModuleDefinition[],
  instanceId: string,
  startU: number,
): PlacementResult {
  const placement = placements.find((candidate) => candidate.instanceId === instanceId)
  const module = placement ? moduleMap(modules).get(placement.moduleId) : undefined
  if (!placement || !module) return { ok: false, reason: 'module-not-found', placements }
  if (!module.heightU) return { ok: false, reason: 'unknown-height', placements }
  const failure = canFit(rack, placements, modules, startU, module.heightU, instanceId)
  if (failure) return { ok: false, reason: failure, placements }

  return {
    ok: true,
    placements: placements.map((candidate) =>
      candidate.instanceId === instanceId ? { ...candidate, startU } : candidate,
    ),
  }
}

export function removePlacement(placements: Placement[], instanceId: string) {
  return placements.filter((placement) => placement.instanceId !== instanceId)
}
