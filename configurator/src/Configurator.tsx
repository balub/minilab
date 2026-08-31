import { lazy, Suspense, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import { Box, ChevronDown, ChevronUp, GripVertical, RotateCcw, Scan, Trash2 } from 'lucide-react'
import type { CatalogModule, ModelCatalog } from './domain/catalog'
import { getOccupancy, movePlacement, placeModule, removePlacement, type Placement } from './domain/rack'

const ConfiguratorScene = lazy(() =>
  import('./scene/ConfiguratorScene').then((module) => ({ default: module.ConfiguratorScene })),
)

const failureMessages = {
  'unknown-height': 'Set this module’s heightU in models/modules.json before placing it.',
  'outside-rack': 'That position extends beyond the rack.',
  overlap: 'That position is already occupied.',
  'rack-full': 'No contiguous space is available for that module.',
  'module-not-found': 'That module is no longer in the catalog.',
}

export function Configurator({ catalog }: { catalog: ModelCatalog }) {
  const renderParam = new URLSearchParams(window.location.search).get('render')
  const renderView = renderParam === 'top-left' || renderParam === 'top-right' ? renderParam : undefined
  const modules = useMemo(() => catalog.modules.filter((module) => module.role === 'module'), [catalog.modules])
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState('Choose a module to begin.')
  const [viewResetToken, setViewResetToken] = useState(0)
  const occupancy = getOccupancy(catalog.rack, placements, modules)
  const selectedPlacement = placements.find((placement) => placement.instanceId === selectedId) ?? null
  const selectedModule = modules.find((module) => module.id === selectedPlacement?.moduleId) ?? null
  const occupiedCount = occupancy.filter(Boolean).length

  const addModule = (module: CatalogModule, startU?: number) => {
    const result = placeModule(catalog.rack, placements, modules, module, startU)
    if (!result.ok) {
      setStatus(failureMessages[result.reason])
      return
    }
    const added = result.placements.at(-1) ?? null
    setPlacements(result.placements)
    setSelectedId(added?.instanceId ?? null)
    setStatus(`${module.name} added to U${(added?.startU ?? 0) + 1}.`)
  }

  const moveSelected = (startU: number) => {
    if (!selectedPlacement || !selectedModule) return
    const result = movePlacement(catalog.rack, placements, modules, selectedPlacement.instanceId, startU)
    if (!result.ok) {
      setStatus(failureMessages[result.reason])
      return
    }
    setPlacements(result.placements)
    setStatus(`${selectedModule.name} moved to U${startU + 1}.`)
  }

  const removeSelected = () => {
    if (!selectedPlacement || !selectedModule) return
    setPlacements((current) => removePlacement(current, selectedPlacement.instanceId))
    setSelectedId(null)
    setStatus(`${selectedModule.name} removed.`)
  }

  const reset = () => {
    setPlacements([])
    setSelectedId(null)
    setStatus('Configuration reset.')
  }

  const dropOnSlot = (event: DragEvent<HTMLButtonElement>, startU: number) => {
    event.preventDefault()
    const moduleId = event.dataTransfer.getData('application/x-minilab-module')
    const instanceId = event.dataTransfer.getData('application/x-minilab-instance')
    if (moduleId) {
      const module = modules.find((candidate) => candidate.id === moduleId)
      if (module) addModule(module, startU)
    } else if (instanceId) {
      setSelectedId(instanceId)
      const result = movePlacement(catalog.rack, placements, modules, instanceId, startU)
      if (result.ok) {
        setPlacements(result.placements)
        setStatus(`Module moved to U${startU + 1}.`)
      } else {
        setStatus(failureMessages[result.reason])
      }
    }
  }

  return (
    <main className={`app-shell ${renderView ? 'render-mode' : ''}`}>
      <header className="topbar">
        <div className="brand" aria-label="MiniLab">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>MINILAB</span>
        </div>
        <h1>Build your rack</h1>
        <div className="topbar-actions">
          <button className="button secondary" onClick={reset} aria-label="Reset configuration">
            <RotateCcw size={17} /> Reset
          </button>
          <button className="button secondary" onClick={() => setViewResetToken((value) => value + 1)}>
            <Scan size={17} /> Fit view
          </button>
        </div>
      </header>

      <section className="workspace">
        <aside className="module-library" aria-labelledby="module-heading">
          <div className="panel-heading">
            <h2 id="module-heading">Modules</h2>
            <span>{modules.length}</span>
          </div>
          <div className="module-list">
            {modules.map((module) => {
              const needsReview = module.heightU === null
              return (
                <button
                  key={module.id}
                  className="module-row"
                  disabled={needsReview}
                  onClick={() => addModule(module)}
                  draggable={!needsReview}
                  onDragStart={(event) => event.dataTransfer.setData('application/x-minilab-module', module.id)}
                  aria-label={`Add ${module.name}${needsReview ? ', height needs review' : ''}`}
                >
                  <GripVertical className="drag-handle" size={16} aria-hidden="true" />
                  <span className="module-swatch" style={{ '--module-color': module.preview?.color ?? '#343a40' } as CSSProperties}>
                    <span />
                  </span>
                  <span className="module-copy">
                    <strong>{module.name}</strong>
                    {module.manufacturingMethod === 'laser-cut' ? <small>Laser cut</small> : <small>{module.source}</small>}
                  </span>
                  <span className={needsReview ? 'height needs-review' : 'height'}>
                    {needsReview ? 'Needs height' : `${module.heightU}U`}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="viewport-panel" aria-label="3D configurator viewport">
          <div className="viewport-overlay">
            <span>{catalog.rack.name}</span>
            <span>Orbit · Pan · Zoom</span>
          </div>
          <Suspense fallback={<div className="scene-loading"><span className="loader" /> Preparing 3D workspace</div>}>
            <ConfiguratorScene
              rack={catalog.rack}
              modules={catalog.modules}
              placements={placements}
              selectedInstanceId={selectedId}
              onSelect={setSelectedId}
              viewResetToken={viewResetToken}
              renderView={renderView}
            />
          </Suspense>
        </section>

        <aside className="rack-sidebar">
          <div className="panel-heading"><h2>Rack map</h2><span>{catalog.rack.heightU}U</span></div>
          <div className="rack-map">
            {Array.from({ length: catalog.rack.heightU }, (_, index) => catalog.rack.heightU - 1 - index).map((slot) => {
              const instanceId = occupancy[slot]
              const placement = placements.find((item) => item.instanceId === instanceId)
              const module = modules.find((item) => item.id === placement?.moduleId)
              const selected = instanceId !== null && instanceId === selectedId
              return (
                <button
                  key={slot}
                  className={`rack-slot ${instanceId ? 'occupied' : 'available'} ${selected ? 'selected' : ''}`}
                  onClick={() => (instanceId ? setSelectedId(instanceId) : moveSelected(slot))}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropOnSlot(event, slot)}
                  draggable={Boolean(instanceId)}
                  onDragStart={(event) => instanceId && event.dataTransfer.setData('application/x-minilab-instance', instanceId)}
                  aria-label={`U${slot + 1} ${module?.name ?? 'Available'}`}
                >
                  <span className="u-label">U{slot + 1}</span>
                  <span className="slot-state">{module?.name ?? 'Available'}</span>
                  {placement?.startU === slot && module?.heightU ? <span className="slot-height">{module.heightU}U</span> : null}
                </button>
              )
            })}
          </div>

          <section className="inspector" aria-live="polite">
            {selectedPlacement && selectedModule ? (
              <>
                <div className="selected-module">
                  <span className="module-icon"><Box size={21} /></span>
                  <span><strong>{selectedModule.name}</strong><small>{selectedModule.heightU}U · U{selectedPlacement.startU + 1}</small></span>
                </div>
                <div className="inspector-actions">
                  <button className="button wide" onClick={() => moveSelected(selectedPlacement.startU + 1)}>
                    <ChevronUp size={18} /> Move up
                  </button>
                  <button className="button wide" onClick={() => moveSelected(selectedPlacement.startU - 1)}>
                    <ChevronDown size={18} /> Move down
                  </button>
                  <button className="button wide danger" onClick={removeSelected} aria-label={`Remove ${selectedModule.name}`}>
                    <Trash2 size={17} /> Remove
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector"><Box size={22} /><strong>No module selected</strong><span>Select an occupied U position to inspect it.</span></div>
            )}
          </section>
        </aside>
      </section>

      <footer className="statusbar">
        <strong>{occupiedCount} of {catalog.rack.heightU}U occupied</strong>
        <span role="status">{status}</span>
        <span>1U = {catalog.rack.unitMm} mm</span>
      </footer>
    </main>
  )
}
