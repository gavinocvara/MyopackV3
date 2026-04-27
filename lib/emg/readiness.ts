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

const MIN_SAMPLES = 18

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

  if (hasCaution || score < 78) {
    return {
      state: 'caution',
      score,
      headline: 'Usable, but improve contact',
      summary: 'A session can start, but the signal would be stronger with cleaner contact or a clearer test contraction.',
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
  const saturated = max >= 98 || min <= -1
  const flat = range < 1.2
  const weak = max < 8 && range < 4
  const responsive = range >= 5 || max >= 18
  const issues: string[] = []

  if (saturated) issues.push(`${capitalize(side)} array looks saturated; reseat the active leads.`)
  if (flat) issues.push(`${capitalize(side)} array is too flat; confirm the electrodes are attached.`)
  if (weak) issues.push(`${capitalize(side)} array response is weak; try cleaning skin or pressing the pad edges down.`)
  if (!responsive && !flat && !weak) issues.push(`${capitalize(side)} array needs a clearer gentle test contraction.`)

  const responseScore = Math.min(38, range * 3.2)
  const peakScore = Math.min(26, max * 1.15)
  const stabilityScore = saturated ? 0 : 22
  const baselineScore = average > 0.5 && average < 96 ? 14 : 4
  const score = Math.max(0, Math.min(100, Math.round(responseScore + peakScore + stabilityScore + baselineScore)))

  let state: ReadinessState = 'ready'
  if (saturated || flat || weak) state = 'not-ready'
  else if (!responsive || score < 78) state = 'caution'

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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
