'use client'

export type MuscleGroup = 'quads' | 'hamstrings' | 'biceps' | 'shoulders'
export type SideMode = 'left' | 'right' | 'bilateral'
export type SensorPair = 'pairA' | 'pairB'
export type ChannelIndex = 0 | 1 | 2 | 3

export interface ChannelRoute {
  leftIndex: ChannelIndex
  rightIndex: ChannelIndex
}

export interface MuscleRegion {
  id: MuscleGroup
  label: string
  shortLabel: string
  description: string
  defaultPair: SensorPair
}

// ─── Physical side truth ────────────────────────────────────────────────────
// CS=21 → U1 ADS chip → LEFT body side  (ch[0] = primary, ch[1] = secondary)
// CS=22 → U4 ADS chip → RIGHT body side (ch[2] = primary, ch[3] = secondary)
//
// If live board testing proves the chips are physically reversed, set this
// to true — all routing constants below will flip automatically.
// Live biceps validation on 2026-04-29 showed the UI left/right labels were
// inverted for the current demo harness. Keep this true unless the physical
// harness is rewired and revalidated.
export const SWAP_PHYSICAL_SIDES = true

export const PHYSICAL_LEFT_PRIMARY:   ChannelIndex = SWAP_PHYSICAL_SIDES ? 2 : 0
export const PHYSICAL_LEFT_SECONDARY: ChannelIndex = SWAP_PHYSICAL_SIDES ? 3 : 1
export const PHYSICAL_RIGHT_PRIMARY:  ChannelIndex = SWAP_PHYSICAL_SIDES ? 0 : 2
export const PHYSICAL_RIGHT_SECONDARY: ChannelIndex = SWAP_PHYSICAL_SIDES ? 1 : 3

// Valid left-side channel candidates (both from the LEFT chip)
export const LEFT_CHANNEL_CANDIDATES: ChannelIndex[] = [PHYSICAL_LEFT_PRIMARY, PHYSICAL_LEFT_SECONDARY]
// Valid right-side channel candidates (both from the RIGHT chip)
export const RIGHT_CHANNEL_CANDIDATES: ChannelIndex[] = [PHYSICAL_RIGHT_PRIMARY, PHYSICAL_RIGHT_SECONDARY]

export const MUSCLE_REGIONS: MuscleRegion[] = [
  {
    id: 'quads',
    label: 'Quadriceps',
    shortLabel: 'Quads',
    description: 'Front thigh activation',
    defaultPair: 'pairA',
  },
  {
    id: 'hamstrings',
    label: 'Hamstrings',
    shortLabel: 'Hams',
    description: 'Posterior chain control',
    defaultPair: 'pairA',
  },
  {
    id: 'biceps',
    label: 'Biceps',
    shortLabel: 'Biceps',
    description: 'Upper arm contraction',
    defaultPair: 'pairA',
  },
  {
    id: 'shoulders',
    label: 'Shoulders',
    shortLabel: 'Shoulders',
    description: 'Deltoid activation',
    defaultPair: 'pairA',
  },
]

// pairA = primary channels (U1 CH1 + U4 CH1) — cross-chip, one per body side
// pairB = secondary channels (U1 CH2 + U4 CH2) — fallback if primary has poor contact
export const SENSOR_PAIRS: Record<
  SensorPair,
  { label: string; leftIndex: ChannelIndex; rightIndex: ChannelIndex; fallbackLeft: string; fallbackRight: string }
> = {
  pairA: {
    label: 'Primary',
    leftIndex: PHYSICAL_LEFT_PRIMARY,
    rightIndex: PHYSICAL_RIGHT_PRIMARY,
    fallbackLeft: 'Left',
    fallbackRight: 'Right',
  },
  pairB: {
    label: 'Secondary',
    leftIndex: PHYSICAL_LEFT_SECONDARY,
    rightIndex: PHYSICAL_RIGHT_SECONDARY,
    fallbackLeft: 'Left Alt',
    fallbackRight: 'Right Alt',
  },
}

export const SIDE_MODES: Array<{ id: SideMode; label: string }> = [
  { id: 'bilateral', label: 'Bilateral' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
]

export const CHANNEL_KEYS = ['leftQuad', 'rightQuad', 'leftHam', 'rightHam'] as const

export const CHANNEL_COLORS: Record<ChannelIndex, string> = {
  0: '#2DD4BF',
  1: '#60A5FA',
  2: '#FC6558',
  3: '#FBBF24',
}

export function routeFromPair(pair: SensorPair): ChannelRoute {
  const meta = SENSOR_PAIRS[pair]
  return { leftIndex: meta.leftIndex, rightIndex: meta.rightIndex }
}

export function pairFromRoute(route: ChannelRoute): SensorPair | null {
  if (route.leftIndex === PHYSICAL_LEFT_PRIMARY && route.rightIndex === PHYSICAL_RIGHT_PRIMARY) return 'pairA'
  if (route.leftIndex === PHYSICAL_LEFT_SECONDARY && route.rightIndex === PHYSICAL_RIGHT_SECONDARY) return 'pairB'
  return null
}

export function getMuscleRegion(id: MuscleGroup): MuscleRegion {
  return MUSCLE_REGIONS.find((region) => region.id === id) ?? MUSCLE_REGIONS[0]
}

export function getActivationPhase(value: number): {
  label: string
  color: string
  glow: string
} {
  const pct = Math.max(0, Math.min(100, value))
  const color = heatColor(pct)
  const alpha = 0.18 + (pct / 100) * 0.34
  const glow = hexToRgba(color, alpha)

  if (value >= 90) {
    return { label: 'Peak', color, glow }
  }
  if (value >= 70) {
    return { label: 'High', color, glow }
  }
  if (value >= 45) {
    return { label: 'Building', color, glow }
  }
  if (value >= 25) {
    return { label: 'Low', color, glow }
  }
  return { label: 'Quiet', color, glow }
}

const HEAT_STOPS = [
  { at: 0, color: '#071426' },
  { at: 28, color: '#31206A' },
  { at: 52, color: '#7A2F82' },
  { at: 72, color: '#FC6558' },
  { at: 86, color: '#F2B84B' },
  { at: 100, color: '#EF4444' },
]

function heatColor(value: number): string {
  const upperIndex = HEAT_STOPS.findIndex((stop) => value <= stop.at)
  if (upperIndex <= 0) return HEAT_STOPS[0].color
  const lower = HEAT_STOPS[upperIndex - 1]
  const upper = HEAT_STOPS[upperIndex]
  const amount = (value - lower.at) / (upper.at - lower.at)
  return mixHex(lower.color, upper.color, amount)
}

function mixHex(from: string, to: string, amount: number): string {
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const mix = {
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount),
  }
  return `#${toHex(mix.r)}${toHex(mix.g)}${toHex(mix.b)}`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha.toFixed(2)})`
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, '0')
}

export function getPairValues(
  emgData: Record<typeof CHANNEL_KEYS[number], number>,
  pair: SensorPair
): { left: number; right: number; average: number; symmetry: number } {
  return getRouteValues(emgData, routeFromPair(pair))
}

export function getRouteValues(
  emgData: Record<typeof CHANNEL_KEYS[number], number>,
  route: ChannelRoute
): { left: number; right: number; average: number; symmetry: number } {
  const left = emgData[CHANNEL_KEYS[route.leftIndex]]
  const right = emgData[CHANNEL_KEYS[route.rightIndex]]
  const average = (left + right) / 2
  const symmetry = 100 - Math.min(Math.abs(left - right), 100)
  return { left, right, average, symmetry }
}

export function getSideActivation(values: { left: number; right: number; average: number }, side: SideMode): number {
  if (side === 'left') return values.left
  if (side === 'right') return values.right
  return values.average
}
