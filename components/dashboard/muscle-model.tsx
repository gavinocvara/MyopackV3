'use client'

import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  getActivationPhase,
  type MuscleGroup,
  type SideMode,
} from '@/lib/muscle-selection'

interface MuscleModelProps {
  selectedGroup: MuscleGroup | null
  activation: number
  sideActivations?: {
    left: number
    right: number
  }
  sideMode?: SideMode
  compact?: boolean
  interactive?: boolean
  showElectrodes?: boolean
  onSelect?: (group: MuscleGroup) => void
}

const REGION_COLORS: Record<MuscleGroup, string> = {
  quads: '#2DD4BF',
  hamstrings: '#60A5FA',
  biceps: '#FC6558',
  shoulders: '#FBBF24',
}

function targetCamera(group: MuscleGroup | null, compact: boolean): [number, number, number] {
  if (compact) return [0, 0.15, 4.6]
  if (group === 'shoulders') return [0, 1.35, 3.8]
  if (group === 'biceps') return [0, 0.7, 4.1]
  if (group === 'quads') return [0, -0.85, 4.0]
  if (group === 'hamstrings') return [0, -0.95, 4.2]
  return [0, 0.15, 5.4]
}

function CameraRig({ selectedGroup, compact }: { selectedGroup: MuscleGroup | null; compact: boolean }) {
  const { camera } = useThree()

  useFrame(() => {
    const [x, y, z] = targetCamera(selectedGroup, compact)
    camera.position.lerp(new THREE.Vector3(x, y, z), 0.06)
    camera.lookAt(0, selectedGroup === 'shoulders' ? 0.95 : compact ? 0.05 : 0, 0)
  })

  return null
}

function sideActivation(
  side: 'left' | 'right',
  activation: number,
  sideActivations?: { left: number; right: number }
) {
  if (!sideActivations) return activation
  return side === 'left' ? sideActivations.left : sideActivations.right
}

function regionColor(
  group: MuscleGroup,
  selectedGroup: MuscleGroup | null,
  activation: number,
  hovered: MuscleGroup | null,
  side: 'left' | 'right',
  sideActivations?: { left: number; right: number }
) {
  if (selectedGroup === group) return getActivationPhase(sideActivation(side, activation, sideActivations)).color
  if (hovered === group) return REGION_COLORS[group]
  return '#2B3440'
}

function regionEmissive(
  group: MuscleGroup,
  selectedGroup: MuscleGroup | null,
  activation: number,
  hovered: MuscleGroup | null,
  side: 'left' | 'right',
  sideActivations?: { left: number; right: number }
) {
  if (selectedGroup === group) return getActivationPhase(sideActivation(side, activation, sideActivations)).color
  if (hovered === group) return REGION_COLORS[group]
  return '#050608'
}

function isSideVisible(side: 'left' | 'right', sideMode: SideMode) {
  return sideMode === 'bilateral' || sideMode === side
}

const ELECTRODE_COLORS = ['#EF4444', '#24D6A2', '#F2B84B'] as const

const ELECTRODE_POINTS: Record<MuscleGroup, Record<'left' | 'right', [number, number, number][]>> = {
  shoulders: {
    left: [[-0.5, 0.98, 0.28], [-0.58, 0.82, 0.28], [-0.46, 0.68, 0.27]],
    right: [[0.5, 0.98, 0.28], [0.58, 0.82, 0.28], [0.46, 0.68, 0.27]],
  },
  biceps: {
    left: [[-0.78, 0.46, 0.34], [-0.8, 0.3, 0.36], [-0.78, -0.2, 0.33]],
    right: [[0.78, 0.46, 0.34], [0.8, 0.3, 0.36], [0.78, -0.2, 0.33]],
  },
  quads: {
    left: [[-0.28, -0.36, 0.4], [-0.28, -0.72, 0.42], [-0.27, -1.08, 0.4]],
    right: [[0.28, -0.36, 0.4], [0.28, -0.72, 0.42], [0.27, -1.08, 0.4]],
  },
  hamstrings: {
    left: [[-0.28, -0.42, -0.44], [-0.28, -0.78, -0.48], [-0.27, -1.13, -0.44]],
    right: [[0.28, -0.42, -0.44], [0.28, -0.78, -0.48], [0.27, -1.13, -0.44]],
  },
}

function ElectrodeMarker({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.055, 20, 20]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.75}
        roughness={0.35}
        metalness={0.08}
      />
    </mesh>
  )
}

function ElectrodePlacement({
  selectedGroup,
  sideMode,
}: {
  selectedGroup: MuscleGroup | null
  sideMode: SideMode
}) {
  if (!selectedGroup) return null
  const points = ELECTRODE_POINTS[selectedGroup]
  return (
    <>
      {(['left', 'right'] as const).map((side) =>
        isSideVisible(side, sideMode)
          ? points[side].map((position, index) => (
              <ElectrodeMarker
                key={`${side}-${index}`}
                position={position}
                color={ELECTRODE_COLORS[index]}
              />
            ))
          : null
      )}
    </>
  )
}

function MusclePart({
  group,
  selectedGroup,
  activation,
  sideActivations,
  hovered,
  side,
  sideMode,
  interactive,
  onSelect,
  position,
  rotation,
  scale,
  capsule = false,
}: {
  group: MuscleGroup
  selectedGroup: MuscleGroup | null
  activation: number
  sideActivations?: { left: number; right: number }
  hovered: MuscleGroup | null
  side: 'left' | 'right'
  sideMode: SideMode
  interactive: boolean
  onSelect?: (group: MuscleGroup) => void
  position: [number, number, number]
  rotation?: [number, number, number]
  scale: [number, number, number]
  capsule?: boolean
}) {
  const active = selectedGroup === group && isSideVisible(side, sideMode)
  const opacity = selectedGroup === group && !isSideVisible(side, sideMode) ? 0.22 : 1
  const localActivation = sideActivation(side, activation, sideActivations)
  const color = regionColor(group, selectedGroup, activation, hovered, side, sideActivations)
  const emissive = regionEmissive(group, selectedGroup, activation, hovered, side, sideActivations)

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (interactive) onSelect?.(group)
  }

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={handleSelect}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (interactive) document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        if (interactive) document.body.style.cursor = 'auto'
      }}
    >
      {capsule ? <capsuleGeometry args={[0.16, 0.62, 10, 22]} /> : <sphereGeometry args={[0.28, 28, 28]} />}
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={active ? 0.24 + (localActivation / 100) * 0.56 : hovered === group ? 0.22 : 0.06}
        roughness={0.52}
        metalness={0.08}
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}

function HumanModel({
  selectedGroup,
  activation,
  sideActivations,
  sideMode,
  compact,
  interactive,
  showElectrodes,
  onSelect,
}: Required<Pick<MuscleModelProps, 'activation' | 'compact' | 'interactive'>> &
  Pick<MuscleModelProps, 'selectedGroup' | 'sideMode' | 'sideActivations' | 'showElectrodes' | 'onSelect'>) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<MuscleGroup | null>(null)
  const activeSideMode = sideMode ?? 'bilateral'

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (!selectedGroup && !compact) {
      groupRef.current.rotation.y += delta * 0.22
    } else if (compact) {
      groupRef.current.rotation.y += delta * 0.16
    }
  })

  const bodyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#C9D2DA',
        roughness: 0.62,
        metalness: 0.05,
      }),
    []
  )
  const jointMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#70808D',
        roughness: 0.7,
        metalness: 0.03,
      }),
    []
  )

  const partProps = {
    selectedGroup,
    activation,
    sideActivations,
    hovered,
    sideMode: activeSideMode,
    interactive,
    onSelect,
  }

  return (
    <group
      ref={groupRef}
      onPointerMissed={() => setHovered(null)}
      onPointerMove={() => undefined}
      scale={compact ? 0.9 : 1}
      position={[0, compact ? -0.05 : -0.15, 0]}
    >
      <mesh position={[0, 1.25, 0]} material={bodyMaterial}>
        <sphereGeometry args={[0.24, 32, 32]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} scale={[0.64, 1.0, 0.38]} material={bodyMaterial}>
        <capsuleGeometry args={[0.5, 0.55, 14, 32]} />
      </mesh>
      <mesh position={[0, -0.06, 0]} scale={[0.58, 0.42, 0.36]} material={jointMaterial}>
        <sphereGeometry args={[0.45, 28, 28]} />
      </mesh>

      <mesh position={[-0.64, 0.78, 0]} rotation={[0, 0, -0.55]} scale={[0.7, 0.45, 0.35]} material={jointMaterial}>
        <capsuleGeometry args={[0.22, 0.55, 10, 24]} />
      </mesh>
      <mesh position={[0.64, 0.78, 0]} rotation={[0, 0, 0.55]} scale={[0.7, 0.45, 0.35]} material={jointMaterial}>
        <capsuleGeometry args={[0.22, 0.55, 10, 24]} />
      </mesh>

      <mesh position={[-0.76, 0.2, 0]} rotation={[0, 0, 0.18]} scale={[0.55, 0.9, 0.45]} material={jointMaterial}>
        <capsuleGeometry args={[0.18, 0.9, 10, 24]} />
      </mesh>
      <mesh position={[0.76, 0.2, 0]} rotation={[0, 0, -0.18]} scale={[0.55, 0.9, 0.45]} material={jointMaterial}>
        <capsuleGeometry args={[0.18, 0.9, 10, 24]} />
      </mesh>

      <mesh position={[-0.28, -0.85, 0]} rotation={[0, 0, 0.08]} scale={[0.72, 1.22, 0.58]} material={jointMaterial}>
        <capsuleGeometry args={[0.22, 1.1, 12, 28]} />
      </mesh>
      <mesh position={[0.28, -0.85, 0]} rotation={[0, 0, -0.08]} scale={[0.72, 1.22, 0.58]} material={jointMaterial}>
        <capsuleGeometry args={[0.22, 1.1, 12, 28]} />
      </mesh>
      <mesh position={[-0.24, -1.88, 0]} rotation={[0, 0, 0.04]} scale={[0.55, 1.1, 0.45]} material={jointMaterial}>
        <capsuleGeometry args={[0.17, 0.9, 10, 24]} />
      </mesh>
      <mesh position={[0.24, -1.88, 0]} rotation={[0, 0, -0.04]} scale={[0.55, 1.1, 0.45]} material={jointMaterial}>
        <capsuleGeometry args={[0.17, 0.9, 10, 24]} />
      </mesh>

      {(['shoulders', 'biceps', 'quads', 'hamstrings'] as MuscleGroup[]).map((region) => (
        <group
          key={region}
          onPointerOver={(event) => {
            event.stopPropagation()
            if (interactive) setHovered(region)
          }}
          onPointerOut={() => {
            if (interactive) setHovered(null)
          }}
        >
          {region === 'shoulders' && (
            <>
              <MusclePart {...partProps} group="shoulders" side="left" position={[-0.46, 0.82, 0.03]} scale={[1, 0.58, 0.72]} />
              <MusclePart {...partProps} group="shoulders" side="right" position={[0.46, 0.82, 0.03]} scale={[1, 0.58, 0.72]} />
            </>
          )}
          {region === 'biceps' && (
            <>
              <MusclePart {...partProps} group="biceps" side="left" position={[-0.78, 0.28, 0.13]} rotation={[0.25, 0.05, 0.16]} scale={[0.92, 1.18, 0.92]} capsule />
              <MusclePart {...partProps} group="biceps" side="right" position={[0.78, 0.28, 0.13]} rotation={[0.25, -0.05, -0.16]} scale={[0.92, 1.18, 0.92]} capsule />
            </>
          )}
          {region === 'quads' && (
            <>
              <MusclePart {...partProps} group="quads" side="left" position={[-0.27, -0.72, 0.18]} rotation={[0.12, 0, 0.08]} scale={[0.96, 1.35, 0.82]} capsule />
              <MusclePart {...partProps} group="quads" side="right" position={[0.27, -0.72, 0.18]} rotation={[0.12, 0, -0.08]} scale={[0.96, 1.35, 0.82]} capsule />
            </>
          )}
          {region === 'hamstrings' && (
            <>
              <MusclePart {...partProps} group="hamstrings" side="left" position={[-0.27, -0.8, -0.18]} rotation={[-0.12, 0, 0.08]} scale={[0.88, 1.28, 0.72]} capsule />
              <MusclePart {...partProps} group="hamstrings" side="right" position={[0.27, -0.8, -0.18]} rotation={[-0.12, 0, -0.08]} scale={[0.88, 1.28, 0.72]} capsule />
            </>
          )}
        </group>
      ))}
      {showElectrodes && (
        <ElectrodePlacement selectedGroup={selectedGroup} sideMode={activeSideMode} />
      )}
    </group>
  )
}

export function MuscleModel({
  selectedGroup,
  activation,
  sideActivations,
  sideMode = 'bilateral',
  compact = false,
  interactive = false,
  showElectrodes = false,
  onSelect,
}: MuscleModelProps) {
  return (
    <div
      style={{
        width: '100%',
        height: compact ? 220 : 420,
        minHeight: compact ? 220 : 360,
        borderRadius: compact ? 18 : 26,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 26%, rgba(45,212,191,0.10), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.015))',
        border: '1px solid var(--mp-line2)',
        touchAction: 'pan-y',
      }}
    >
      <Canvas
        camera={{ position: targetCamera(selectedGroup, compact), fov: compact ? 34 : 38 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
        style={{ touchAction: 'pan-y' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.86} />
          <directionalLight position={[2.6, 3.4, 4]} intensity={1.8} />
          <pointLight position={[-2.5, 1.2, 2.5]} intensity={1.1} color="#2DD4BF" />
          <HumanModel
            selectedGroup={selectedGroup}
            activation={activation}
            sideActivations={sideActivations}
            sideMode={sideMode}
            compact={compact}
            interactive={interactive}
            showElectrodes={showElectrodes}
            onSelect={onSelect}
          />
          <CameraRig selectedGroup={selectedGroup} compact={compact} />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.7}
            minPolarAngle={Math.PI * 0.18}
            maxPolarAngle={Math.PI * 0.82}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
