import {
  LEFT_CHANNEL_CANDIDATES,
  RIGHT_CHANNEL_CANDIDATES,
  SENSOR_PAIRS,
  type ChannelIndex,
  type ChannelRoute,
  type SensorPair,
  type SideMode,
} from '@/lib/muscle-selection'
import type { EMGHistoryPoint } from '@/lib/emg/context'

export type ReadinessState = 'idle' | 'checking' | 'ready' | 'caution' | 'not-ready'

export interface ElectrodeArrayReadiness {
  id: 'left' | 'right'
  label: string
  channelIndex?: ChannelIndex
  score: number
  state: ReadinessState
  peak: number
  range: number
  average: number
  issues: string[]
}

export interface ElectrodeReadiness {
  state: ReadinessState
  score: number
  headline: string
  summary: string
  samples: number
  arrays: ElectrodeArrayReadiness[]
}

const MIN_SAMPLES = 24
const SATURATION_EDGE_HIGH = 96
const MAX_READY_AVERAGE = 76
const MAX_READY_BASELINE_AVERAGE = 55
const MAX_READY_BASELINE_RANGE = 40
const MIN_READY_RANGE = 6
const MIN_READY_RESPONSE_DELTA = 5
const MIN_READY_ELEVATED_RUN = 3
const MAX_LARGE_JUMP_RATIO = 0.34
const MAX_EDGE_HIT_RATIO = 0.18

export function recommendSensorPair(
  samples: EMGHistoryPoint[],
  currentPair: SensorPair,
  sideMode: SideMode
): SensorPair {
  if (samples.length < MIN_SAMPLES) return currentPair

  const current = analyzeElectrodeReadiness(samples, currentPair, sideMode)
  const alternatePair: SensorPair = currentPair === 'pairA' ? 'pairB' : 'pairA'
  const alternate = analyzeElectrodeReadiness(samples, alternatePair, sideMode)

  const alternateIsUsable = alternate.state === 'ready' || alternate.state === 'caution'
  const currentIsBlocked = current.state === 'not-ready' || current.score < 45
  const alternateClearlyBetter = alternate.score >= current.score + 18

  if (alternateIsUsable && (currentIsBlocked || alternateClearlyBetter)) {
    return alternatePair
  }

  return currentPair
}

export function recommendChannelRoute(
  samples: EMGHistoryPoint[],
  currentRoute: ChannelRoute,
  sideMode: SideMode
): ChannelRoute {
  if (samples.length < MIN_SAMPLES) return currentRoute

  return {
    leftIndex:
      sideMode === 'right'
        ? currentRoute.leftIndex
        : recommendSideIndex(samples, currentRoute.leftIndex, LEFT_CHANNEL_CANDIDATES, 'left'),
    rightIndex:
      sideMode === 'left'
        ? currentRoute.rightIndex
        : recommendSideIndex(samples, currentRoute.rightIndex, RIGHT_CHANNEL_CANDIDATES, 'right'),
  }
}

export function analyzeElectrodeReadinessForRoute(
  samples: EMGHistoryPoint[],
  route: ChannelRoute,
  sideMode: SideMode
): ElectrodeReadiness {
  const requiredSides: Array<'left' | 'right'> =
    sideMode === 'left' ? ['left'] : sideMode === 'right' ? ['right'] : ['left', 'right']
  const arrays = requiredSides.map((side) => {
    const index = side === 'left' ? route.leftIndex : route.rightIndex
    return analyzeArray(samples.map((sample) => sample.values[index]), side, index)
  })

  return summarizeReadiness(samples, arrays)
}

export function analyzeElectrodeReadiness(
  samples: EMGHistoryPoint[],
  pair: SensorPair,
  sideMode: SideMode
): ElectrodeReadiness {
  const requiredSides: Array<'left' | 'right'> =
    sideMode === 'left' ? ['left'] : sideMode === 'right' ? ['right'] : ['left', 'right']
  const meta = SENSOR_PAIRS[pair]
  const arrays = requiredSides.map((side) => {
    const index = side === 'left' ? meta.leftIndex : meta.rightIndex
    return analyzeArray(samples.map((sample) => sample.values[index]), side, index)
  })

  return summarizeReadiness(samples, arrays)
}

function summarizeReadiness(
  samples: EMGHistoryPoint[],
  arrays: ElectrodeArrayReadiness[]
): ElectrodeReadiness {
  if (samples.length === 0) {
    return {
      state: 'idle',
      score: 0,
      headline: 'Run passive contact check',
      summary: 'MyoPack will listen to the selected electrode array before the session starts.',
      samples: 0,
      arrays,
    }
  }

  if (samples.length < MIN_SAMPLES) {
    return {
      state: 'checking',
      score: Math.round((samples.length / MIN_SAMPLES) * 45),
      headline: 'Listening for clean contact',
      summary: 'Keep the electrodes still, then make one gentle test contraction.',
      samples: samples.length,
      arrays,
    }
  }

  const score = Math.round(arrays.reduce((sum, item) => sum + item.score, 0) / arrays.length)
  const hasNotReady = arrays.some((item) => item.state === 'not-ready')
  const hasCaution = arrays.some((item) => item.state === 'caution')

  if (hasNotReady) {
    return {
      state: 'not-ready',
      score,
      headline: 'Check electrode contact',
      summary: arrays.flatMap((item) => item.issues).slice(0, 2).join(' '),
      samples: samples.length,
      arrays,
    }
  }

  if (hasCaution || score < 74) {
    return {
      state: 'caution',
      score,
      headline: 'Usable, but improve contact',
      summary: 'Signal is usable for a live test, but cleaner contact will make the trend smoother.',
      samples: samples.length,
      arrays,
    }
  }

  return {
    state: 'ready',
    score,
    headline: 'Electrodes ready',
    summary: 'Both selected arrays show responsive, non-saturated signal for a clean run.',
    samples: samples.length,
    arrays,
  }
}

function recommendSideIndex(
  samples: EMGHistoryPoint[],
  currentIndex: ChannelIndex,
  candidates: ChannelIndex[],
  side: 'left' | 'right'
): ChannelIndex {
  const scored = candidates.map((index) => analyzeArray(samples.map((sample) => sample.values[index]), side, index))
  const current = scored.find((item) => item.channelIndex === currentIndex) ?? scored[0]
  const best = [...scored].sort((a, b) => b.score - a.score)[0]
  const bestUsable = best.state === 'ready' || best.state === 'caution'
  const currentBlocked = current.state === 'not-ready' || current.score < 45
  const bestClearlyBetter = best.score >= current.score + 18
  return bestUsable && (currentBlocked || bestClearlyBetter)
    ? best.channelIndex ?? currentIndex
    : currentIndex
}

function analyzeArray(values: number[], side: 'left' | 'right', channelIndex?: ChannelIndex): ElectrodeArrayReadiness {
  if (values.length === 0) {
    return {
      id: side,
      label: `${capitalize(side)} array`,
      channelIndex,
      score: 0,
      state: 'idle',
      peak: 0,
      range: 0,
      average: 0,
      issues: ['No pre-check samples captured yet.'],
    }
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const range = max - min
  const baselineWindow = values.slice(0, Math.max(6, Math.floor(values.length / 4)))
  const baselineMin = Math.min(...baselineWindow)
  const baselineMax = Math.max(...baselineWindow)
  const baselineAverage = baselineWindow.reduce((sum, value) => sum + value, 0) / baselineWindow.length
  const baselineRange = baselineMax - baselineMin
  const largeJumps = countLargeJumps(values)
  const largeJumpRatio = values.length > 1 ? largeJumps / (values.length - 1) : 0
  const edgeHits = values.filter((value) => value >= SATURATION_EDGE_HIGH).length
  const edgeHitRatio = edgeHits / values.length
  const elevatedThreshold = Math.max(12, baselineAverage + MIN_READY_RESPONSE_DELTA)
  const elevatedRun = longestRun(values, (value) => value >= elevatedThreshold)
  const responseDelta = max - baselineAverage

  const saturated =
    average > MAX_READY_AVERAGE ||
    edgeHitRatio > MAX_EDGE_HIT_RATIO
  const flat = range < 1.5
  const weak = max < 8 && range < 5
  const noisyFloating =
    range > 94 ||
    largeJumpRatio > MAX_LARGE_JUMP_RATIO ||
    edgeHitRatio > MAX_EDGE_HIT_RATIO
  const missingQuietBaseline =
    baselineAverage > MAX_READY_BASELINE_AVERAGE ||
    baselineRange > MAX_READY_BASELINE_RANGE ||
    baselineMin > 28
  const responsive =
    range >= MIN_READY_RANGE &&
    responseDelta >= MIN_READY_RESPONSE_DELTA &&
    elevatedRun >= MIN_READY_ELEVATED_RUN
  const issues: string[] = []

  if (saturated) issues.push(`${capitalize(side)} array is saturated or floating high; attach the red/green leads and reseat the plug.`)
  if (noisyFloating) issues.push(`${capitalize(side)} array is jumping like an open input; secure the snap leads and cable strain relief.`)
  if (missingQuietBaseline) issues.push(`${capitalize(side)} array needs a quiet low baseline first; keep the muscle relaxed when the check starts.`)
  if (flat) issues.push(`${capitalize(side)} array is too flat; confirm the electrodes are attached.`)
  if (weak) issues.push(`${capitalize(side)} array response is weak; try cleaning skin or pressing the pad edges down.`)
  if (!responsive && !flat && !weak) issues.push(`${capitalize(side)} array needs one smooth gentle contraction after the quiet baseline.`)

  const baselineScore = missingQuietBaseline ? 0 : 28
  const responseScore = responsive ? Math.min(34, responseDelta * 2.2 + elevatedRun * 2) : Math.min(18, range * 1.4)
  const stabilityScore = noisyFloating ? 0 : 22
  const saturationScore = saturated ? 0 : 16
  const score = Math.max(0, Math.min(100, Math.round(baselineScore + responseScore + stabilityScore + saturationScore)))

  let state: ReadinessState = 'ready'
  if (saturated || noisyFloating || missingQuietBaseline || flat || weak) state = 'not-ready'
  else if (!responsive || score < 74) state = 'caution'

  return {
    id: side,
    label: `${capitalize(side)} array`,
    channelIndex,
    score,
    state,
    peak: Math.round(max),
    range: Math.round(range),
    average: Math.round(average),
    issues,
  }
}

function countLargeJumps(values: number[]): number {
  let jumps = 0
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - values[i - 1]) > 28) jumps += 1
  }
  return jumps
}

function longestRun(values: number[], predicate: (value: number) => boolean): number {
  let best = 0
  let current = 0
  for (const value of values) {
    if (predicate(value)) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }
  return best
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
