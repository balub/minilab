import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { ContactShadows, Grid, Html, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { CatalogModule, CatalogRack } from '../domain/catalog'
import type { Placement } from '../domain/rack'

const WORLD_SCALE = 0.01

interface SceneProps {
  rack: CatalogRack
  modules: CatalogModule[]
  placements: Placement[]
  selectedInstanceId: string | null
  onSelect: (instanceId: string | null) => void
  viewResetToken: number
}

interface ModelBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

class ModelBoundary extends Component<ModelBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // The procedural fallback keeps the configurator usable when an asset is unavailable.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function Extrusion({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#c9cdd0" metalness={0.34} roughness={0.42} />
    </mesh>
  )
}

function RackFrame({ rack }: { rack: CatalogRack }) {
  const width = rack.widthMm * WORLD_SCALE
  const depth = rack.depthMm * WORLD_SCALE
  const beam = rack.extrusionMm * WORLD_SCALE
  const openingHeight = rack.heightU * rack.unitMm * WORLD_SCALE
  const frameHeight = openingHeight + beam * 2
  const y = frameHeight / 2

  return (
    <group>
      {[-1, 1].flatMap((xSign) =>
        [-1, 1].map((zSign) => (
          <Extrusion
            key={`${xSign}-${zSign}`}
            position={[xSign * (width / 2), y, zSign * (depth / 2)]}
            size={[beam, frameHeight, beam]}
          />
        )),
      )}
      {[beam / 2, frameHeight - beam / 2].flatMap((level) => [
        <Extrusion key={`front-${level}`} position={[0, level, depth / 2]} size={[width + beam, beam, beam]} />,
        <Extrusion key={`back-${level}`} position={[0, level, -depth / 2]} size={[width + beam, beam, beam]} />,
        <Extrusion key={`left-${level}`} position={[-width / 2, level, 0]} size={[beam, beam, depth]} />,
        <Extrusion key={`right-${level}`} position={[width / 2, level, 0]} size={[beam, beam, depth]} />,
      ])}
    </group>
  )
}

function RackGuides({ rack }: { rack: CatalogRack }) {
  const width = rack.widthMm * WORLD_SCALE
  const depth = rack.depthMm * WORLD_SCALE
  const beam = rack.extrusionMm * WORLD_SCALE
  const slotHeight = rack.unitMm * WORLD_SCALE

  return Array.from({ length: rack.heightU }, (_, slot) => {
    const slotY = beam + (slot + 0.5) * slotHeight
    return (
      <group key={slot} position={[0, slotY, depth / 2 + beam * 0.55]}>
        <mesh>
          <boxGeometry args={[width - beam * 1.45, 0.012, 0.018]} />
          <meshBasicMaterial color="#c7ccd0" transparent opacity={0.72} />
        </mesh>
        <Html position={[-width / 2 - 0.26, 0, 0]} center transform distanceFactor={7}>
          <span className="scene-u-label">U{slot + 1}</span>
        </Html>
      </group>
    )
  })
}

function ProceduralModule({ module, heightU, selected }: { module: CatalogModule; heightU: number; selected: boolean }) {
  const width = (module.preview?.widthMm ?? 440) * WORLD_SCALE
  const depth = (module.preview?.depthMm ?? 80) * WORLD_SCALE
  const height = heightU * 44.45 * WORLD_SCALE * 0.88
  const color = selected ? '#d97706' : (module.preview?.color ?? '#343a40')

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, Math.max(depth, 0.18)]} />
        <meshStandardMaterial color={color} metalness={0.62} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, Math.max(depth, 0.18) / 2 + 0.012]}>
        <boxGeometry args={[width * 0.86, height * 0.12, 0.012]} />
        <meshBasicMaterial color={selected ? '#fff4dd' : '#717880'} />
      </mesh>
    </group>
  )
}

function CadModel({ module, alignFront = false }: { module: CatalogModule; alignFront?: boolean }) {
  const url = module.model!
  const { scene } = useGLTF(url)
  const mount = module.mount
  const normalized = useMemo(() => {
    const clone = scene.clone(true)
    const material = new MeshStandardMaterial({
      color: module.role === 'frame' ? '#bfc4c8' : (module.preview?.color ?? '#343a40'),
      metalness: module.role === 'frame' ? 0.45 : 0.28,
      roughness: module.role === 'frame' ? 0.34 : 0.48,
    })
    clone.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = material
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    clone.rotation.set(...(mount?.rotation ?? [0, 0, 0]))
    const mountScale = mount?.scale ?? [1, 1, 1]
    clone.scale.set(...mountScale.map((value) => value * WORLD_SCALE) as [number, number, number])
    clone.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(clone)
    const center = bounds.getCenter(new Vector3())
    const position = mount?.position ?? [0, 0, 0]
    clone.position.set(
      position[0] - center.x,
      position[1] - bounds.min.y,
      position[2] - (alignFront ? bounds.max.z : center.z),
    )
    clone.updateMatrixWorld(true)
    return clone
  }, [alignFront, module.preview?.color, module.role, mount?.position, mount?.rotation, mount?.scale, scene])
  return <primitive object={normalized} />
}

function PlacedModule({
  rack,
  module,
  placement,
  selected,
  onSelect,
}: {
  rack: CatalogRack
  module: CatalogModule
  placement: Placement
  selected: boolean
  onSelect: () => void
}) {
  const beam = rack.extrusionMm * WORLD_SCALE
  const unit = rack.unitMm * WORLD_SCALE
  const heightU = module.heightU ?? 1
  const y = beam + placement.startU * unit
  const z = rack.depthMm * WORLD_SCALE * 0.5 - beam * 0.25
  const previewDepth = Math.max((module.preview?.depthMm ?? 80) * WORLD_SCALE, 0.18)
  const previewHeight = heightU * rack.unitMm * WORLD_SCALE * 0.88
  const fallback = (
    <group position={[0, previewHeight / 2, -previewDepth / 2]}>
      <ProceduralModule module={module} heightU={heightU} selected={selected} />
    </group>
  )

  const stopAndSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    onSelect()
  }

  return (
    <group position={[0, y, z]} onClick={stopAndSelect}>
      {module.model ? (
        <ModelBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <CadModel module={module} alignFront />
          </Suspense>
        </ModelBoundary>
      ) : (
        fallback
      )}
      {selected ? (
        <mesh position={[0, heightU * unit / 2, -previewDepth / 2]}>
          <boxGeometry args={[(module.preview?.widthMm ?? 255) * WORLD_SCALE + 0.08, heightU * unit, previewDepth + 0.08]} />
          <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  )
}

function Controls({ resetToken }: { resetToken: number }) {
  const controls = useRef<OrbitControlsImpl>(null)
  useEffect(() => controls.current?.reset(), [resetToken])
  return <OrbitControls ref={controls} makeDefault target={[0, 2, 0]} enableDamping minDistance={4.5} maxDistance={15} maxPolarAngle={Math.PI * 0.52} />
}

function SceneContent(props: Omit<SceneProps, 'viewResetToken'>) {
  const byId = useMemo(() => new Map(props.modules.map((module) => [module.id, module])), [props.modules])
  const frame = props.modules.find((module) => module.role === 'frame')
  const proceduralFrame = <RackFrame rack={props.rack} />
  return (
    <>
      <color attach="background" args={['#eef0f2']} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 8, 6]} intensity={2.6} castShadow shadow-mapSize={[2048, 2048]} />
      {frame?.model ? (
        <ModelBoundary fallback={proceduralFrame}>
          <Suspense fallback={proceduralFrame}><CadModel module={frame} /></Suspense>
        </ModelBoundary>
      ) : proceduralFrame}
      <RackGuides rack={props.rack} />
      {props.placements.map((placement) => {
        const module = byId.get(placement.moduleId)
        return module ? (
          <PlacedModule
            key={placement.instanceId}
            rack={props.rack}
            module={module}
            placement={placement}
            selected={props.selectedInstanceId === placement.instanceId}
            onSelect={() => props.onSelect(placement.instanceId)}
          />
        ) : null
      })}
      <Grid
        position={[0, -0.01, 0]}
        args={[14, 14]}
        cellSize={0.5}
        cellThickness={0.45}
        cellColor="#cbd0d4"
        sectionSize={2}
        sectionThickness={0.7}
        sectionColor="#b6bcc1"
        fadeDistance={13}
        infiniteGrid
      />
      <ContactShadows position={[0, 0, 0]} opacity={0.28} scale={12} blur={2.6} far={6} />
    </>
  )
}

export function ConfiguratorScene(props: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [7.5, 5.8, 8.5], fov: 42, near: 0.1, far: 100 }}
      onPointerMissed={() => props.onSelect(null)}
      aria-label="Interactive 3D MiniLab rack"
    >
      <SceneContent {...props} />
      <Controls resetToken={props.viewResetToken} />
    </Canvas>
  )
}
