import type { ModuleDefinition, RackDefinition } from './rack'

export interface CatalogRack extends RackDefinition {
  widthMm: number
  depthMm: number
  extrusionMm: number
}

export interface CatalogModule extends ModuleDefinition {
  source: string
  model: string | null
  role: 'module' | 'frame' | 'fixed-part'
  status: 'ready' | 'needs-review' | 'not-converted'
}

export interface ModelCatalog {
  generatedAt: string
  rack: CatalogRack
  modules: CatalogModule[]
}
