import type { ChannelIndex } from '@/lib/muscle-selection'

export const ENABLE_EMG_DISPLAY_CONDITIONING = true

export type ChannelConnectionState = 'disconnected' | 'warming' | 'connected' | 'low-confidence'

export interface RawChannelSample {
  channelIndex: ChannelIndex
  timestamp: number
  value: number
}

export interface ChannelConfidence {
  score: number
  connected: boolean
  state: ChannelConnectionState
  reason: string | null
}

export interface ConditionedChannelState {
  channelIndex: ChannelIndex
  initialized: boolean
  lastRaw: number
  baseline: number
  envelope: number
  displayValue: number
  recentValues: number[]
  dropoutFrames: number
  confidence: ChannelConfidence
}

export interface DisplaySample {
  timestamp: number
  values: [number, number, number, number]
  confidence: [ChannelConfidence, ChannelConfidence, ChannelConfidence, ChannelConfidence]
}

export interface DisplayConditioningParameters {
  windowSize: number
  confidenceWarmupSamples: number
  baselineAlpha: number
  attackAlpha: number
  releaseAlpha: number
  riseLimitPerFrame: number
  fallLimitPerFrame: number
  displayGain: number
  noiseFloor: number
  lowSignalFloor: number
  highRailThreshold: number
  maxRailRatio: number
  maxLargeJumpRatio: number
  largeJumpThreshold: number
  dropoutDecay: number
  reconnectAlpha: number
}

export const DISPLAY_CONDITIONING_PARAMS: DisplayConditioningParameters = {
  windowSize: 18,
  confidenceWarmupSamples: 6,
  baselineAlpha: 0.035,
  attackAlpha: 0.42,
  releaseAlpha: 0.22,
  riseLimitPerFrame: 16,
  fallLimitPerFrame: 11,
  displayGain: 1.22,
  noiseFloor: 2.2,
  lowSignalFloor: 0.6,
  highRailThreshold: 97,
  maxRailRatio: 0.22,
  maxLargeJumpRatio: 0.38,
  largeJumpThreshold: 48,
  dropoutDecay: 0.72,
  reconnectAlpha: 0.18,
}

const ZERO_CONFIDENCE: ChannelConfidence = {
  score: 0,
  connected: false,
  state: 'disconnected',
  reason: 'No live samples yet.',
}

export function createInitialConditionedState(channelIndex: ChannelIndex): ConditionedChannelState {
  return {
    channelIndex,
    initialized: false,
    lastRaw: 0,
    baseline: 0,
    envelope: 0,
    displayValue: 0,
    recentValues: [],
    dropoutFrames: 0,
    confidence: { ...ZERO_CONFIDENCE },
  }
}

export function createInitialConditionedStates(): [
  ConditionedChannelState,
  ConditionedChannelState,
  ConditionedChannelState,
  ConditionedChannelState,
] {
  return [0, 1, 2, 3].map((channel) => createInitialConditionedState(channel as ChannelIndex)) as [
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
  ]
}

export function conditionDisplayFrame(
  rawValues: [number, number, number, number],
  timestamp: number,
  previousStates: [
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
  ],
  params: DisplayConditioningParameters = DISPLAY_CONDITIONING_PARAMS
): {
  sample: DisplaySample
  states: [
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
  ]
} {
  if (!ENABLE_EMG_DISPLAY_CONDITIONING) {
    const confidence = rawValues.map((_, index) => ({
      score: 1,
      connected: true,
      state: 'connected' as const,
      reason: null,
    })) as [ChannelConfidence, ChannelConfidence, ChannelConfidence, ChannelConfidence]
    return {
      sample: { timestamp, values: rawValues, confidence },
      states: previousStates,
    }
  }

  const states = rawValues.map((value, index) =>
    updateConditionedChannel(
      { channelIndex: index as ChannelIndex, timestamp, value },
      previousStates[index],
      params
    )
  ) as [
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
    ConditionedChannelState,
  ]

  return {
    sample: {
      timestamp,
      values: states.map((state) => state.displayValue) as [number, number, number, number],
      confidence: states.map((state) => state.confidence) as [
        ChannelConfidence,
        ChannelConfidence,
        ChannelConfidence,
        ChannelConfidence,
      ],
    },
    states,
  }
}

export function updateConditionedChannel(
  sample: RawChannelSample,
  previous: ConditionedChannelState,
  params: DisplayConditioningParameters = DISPLAY_CONDITIONING_PARAMS
): ConditionedChannelState {
  const raw = clampPercent(sample.value)
  const recentValues = [...previous.recentValues, raw].slice(-params.windowSize)
  const confidence = estimateChannelConfidence(recentValues, previous, params)

  if (!previous.initialized) {
    const startingDisplay = confidence.connected ? Math.max(0, raw - params.noiseFloor) : 0
    return {
      ...previous,
      initialized: true,
      lastRaw: raw,
      baseline: raw,
      envelope: startingDisplay,
      displayValue: startingDisplay,
      recentValues,
      dropoutFrames: confidence.connected ? 0 : 1,
      confidence,
    }
  }

  if (!confidence.connected) {
    const displayValue = previous.displayValue * params.dropoutDecay
    return {
      ...previous,
      lastRaw: raw,
      recentValues,
      dropoutFrames: previous.dropoutFrames + 1,
      confidence,
      envelope: displayValue,
      displayValue: displayValue < 0.8 ? 0 : displayValue,
    }
  }

  const baselineAlpha = raw < previous.baseline + 6 ? params.baselineAlpha : params.baselineAlpha * 0.25
  const baseline = previous.baseline + (raw - previous.baseline) * baselineAlpha
  const energy = Math.max(0, raw - baseline * 0.55 - params.noiseFloor)
  const shapedTarget = shapeDisplayTarget(energy * params.displayGain, raw)
  const directionAlpha = shapedTarget >= previous.envelope ? params.attackAlpha : params.releaseAlpha
  const envelope = previous.envelope + (shapedTarget - previous.envelope) * directionAlpha
  const limited = rateLimit(previous.displayValue, envelope, params.riseLimitPerFrame, params.fallLimitPerFrame)
  const displayValue = confidence.state === 'warming'
    ? previous.displayValue + (limited - previous.displayValue) * params.reconnectAlpha
    : limited

  return {
    ...previous,
    lastRaw: raw,
    baseline,
    envelope,
    displayValue: clampPercent(displayValue),
    recentValues,
    dropoutFrames: 0,
    confidence,
  }
}

export function estimateChannelConfidence(
  values: number[],
  previous: ConditionedChannelState,
  params: DisplayConditioningParameters = DISPLAY_CONDITIONING_PARAMS
): ChannelConfidence {
  if (values.length === 0) return { ...ZERO_CONFIDENCE }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const railRatio = values.filter((value) => value >= params.highRailThreshold).length / values.length
  const lowFlat = max < params.lowSignalFloor && range < params.lowSignalFloor
  const largeJumpRatio = countLargeJumps(values, params.largeJumpThreshold) / Math.max(1, values.length - 1)
  const enoughSamples = values.length >= params.confidenceWarmupSamples

  let score = 1
  let reason: string | null = null

  if (lowFlat) {
    score -= 0.68
    reason = 'Flat zero-like signal.'
  }
  if (railRatio > params.maxRailRatio || average > 88) {
    score -= 0.7
    reason = 'Signal is railing high.'
  }
  if (largeJumpRatio > params.maxLargeJumpRatio && range > 70) {
    score -= 0.5
    reason = 'Signal is jumping like an open lead.'
  }
  if (!enoughSamples) {
    score -= 0.22
    reason = 'Warming up live channel.'
  }

  score = clamp01(score)
  const connected = score >= 0.42
  const state: ChannelConnectionState =
    connected && enoughSamples ? 'connected' :
    connected ? 'warming' :
    previous.confidence.connected ? 'low-confidence' :
    'disconnected'

  return { score, connected, state, reason: connected ? null : reason }
}

function shapeDisplayTarget(energy: number, raw: number): number {
  const bounded = clampPercent(energy)
  const compression = Math.sqrt(bounded / 100) * 100
  const rawAnchor = raw * 0.18
  return clampPercent(compression * 0.82 + rawAnchor)
}

function rateLimit(current: number, target: number, riseLimit: number, fallLimit: number): number {
  const delta = target - current
  if (delta > riseLimit) return current + riseLimit
  if (delta < -fallLimit) return current - fallLimit
  return target
}

function countLargeJumps(values: number[], threshold: number): number {
  let count = 0
  for (let i = 1; i < values.length; i += 1) {
    if (Math.abs(values[i] - values[i - 1]) > threshold) count += 1
  }
  return count
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
