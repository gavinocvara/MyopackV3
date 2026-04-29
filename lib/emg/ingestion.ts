import { calculateBalance, type EMGData } from '@/lib/emg/calculations'

export interface EMGHistoryPoint {
  timestamp: number
  values: [number, number, number, number]
}

export const EMPTY_CHANNEL_VALUES: [number, number, number, number] = [0, 0, 0, 0]

export interface EMGIngestionState {
  emgData: EMGData
  history: EMGHistoryPoint[]
  precheckSamples: EMGHistoryPoint[]
}

export interface EMGIngestionOptions {
  isMonitoring: boolean
  isPrechecking: boolean
  maxHistoryPoints: number
  maxPrecheckPoints: number
}

export function emgDataFromChannels(
  values: [number, number, number, number],
  timestamp = Date.now()
): EMGData {
  const [leftPrimary, leftSecondary, rightPrimary, rightSecondary] = values
  const base = {
    leftQuad: leftPrimary,
    rightQuad: leftSecondary,
    leftHam: rightPrimary,
    rightHam: rightSecondary,
    timestamp: new Date(timestamp),
  }
  return {
    ...base,
    balance: calculateBalance(base),
  }
}

export function smoothTelemetryChannels(
  previous: [number, number, number, number] | null,
  incoming: [number, number, number, number]
): [number, number, number, number] {
  if (!previous) return incoming

  return incoming.map((target, index) => {
    const current = previous[index]
    const delta = target - current
    const alpha = Math.abs(delta) > 24 ? 0.42 : 0.28
    const next = current + delta * alpha
    return clampPercent(next)
  }) as [number, number, number, number]
}

export function appendHistoryPoint(
  prev: EMGHistoryPoint[],
  values: [number, number, number, number],
  timestamp: number,
  maxPoints: number
): EMGHistoryPoint[] {
  const next = [...prev, { timestamp, values }]
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function applyTelemetryIngestion(
  state: EMGIngestionState,
  values: [number, number, number, number],
  timestamp: number,
  options: EMGIngestionOptions
): EMGIngestionState {
  const precheckSamples = options.isPrechecking
    ? appendHistoryPoint(state.precheckSamples, values, timestamp, options.maxPrecheckPoints)
    : state.precheckSamples

  if (!options.isMonitoring) {
    return {
      ...state,
      precheckSamples,
    }
  }

  return {
    emgData: emgDataFromChannels(values, timestamp),
    history: appendHistoryPoint(state.history, values, timestamp, options.maxHistoryPoints),
    precheckSamples,
  }
}

export function estimateHistoryRateHz(history: EMGHistoryPoint[]): number {
  if (history.length < 2) return 0
  const first = history[0].timestamp
  const last = history[history.length - 1].timestamp
  const elapsed = last - first
  return elapsed > 0 ? ((history.length - 1) * 1000) / elapsed : 0
}
