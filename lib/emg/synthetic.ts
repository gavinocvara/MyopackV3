import type { TelemetryFrame } from '@/lib/device/types'

export type SyntheticIssue =
  | 'idle'
  | 'burst'
  | 'dropout'
  | 'malformed'
  | 'left-right-swap'
  | 'low-rate'
  | 'oversmoothed'

export interface SyntheticFrameEvent {
  atMs: number
  payload: unknown
  issue: SyntheticIssue
}

export interface SyntheticEmgOptions {
  durationMs?: number
  streamHz?: number
  seed?: number
  baseline?: number
  noise?: number
  leftAmplitude?: number
  rightAmplitude?: number
  burstStartMs?: number
  burstEndMs?: number
  dropoutStartMs?: number
  dropoutEndMs?: number
  malformedEvery?: number
  jitterMs?: number
  leftRightSwap?: boolean
  oversmoothed?: boolean
  lowRate?: boolean
}

export function generateSyntheticEmgScenario(options: SyntheticEmgOptions = {}): SyntheticFrameEvent[] {
  const durationMs = options.durationMs ?? 5000
  const nominalHz = options.lowRate ? Math.min(options.streamHz ?? 20, 5) : options.streamHz ?? 20
  const periodMs = 1000 / nominalHz
  const baseline = options.baseline ?? 3
  const noise = options.noise ?? 1.8
  const leftAmplitude = options.leftAmplitude ?? 72
  const rightAmplitude = options.rightAmplitude ?? 54
  const burstStart = options.burstStartMs ?? 1100
  const burstEnd = options.burstEndMs ?? 3100
  const dropoutStart = options.dropoutStartMs ?? 3600
  const dropoutEnd = options.dropoutEndMs ?? 4100
  const malformedEvery = options.malformedEvery ?? 0
  const jitterMs = options.jitterMs ?? 0
  const random = seededRandom(options.seed ?? 42)
  const events: SyntheticFrameEvent[] = []
  let previous: [number, number, number, number] | null = null
  let seq = 0

  for (let atMs = 0; atMs <= durationMs; atMs += periodMs) {
    const jitter = jitterMs === 0 ? 0 : (random() * 2 - 1) * jitterMs
    const eventTime = Math.max(0, Math.round(atMs + jitter))

    if (eventTime >= dropoutStart && eventTime <= dropoutEnd) {
      continue
    }

    if (malformedEvery > 0 && seq > 0 && seq % malformedEvery === 0) {
      events.push({
        atMs: eventTime,
        payload: { t: eventTime, ch: ['bad', 12, 14], labels: ['Left', 'Left B', 'Right', 'Right B'] },
        issue: 'malformed',
      })
      seq += 1
      continue
    }

    const inBurst = eventTime >= burstStart && eventTime <= burstEnd
    const envelope = inBurst ? burstEnvelope(eventTime, burstStart, burstEnd) : 0
    const rawLeft = baseline + envelope * leftAmplitude + signedNoise(random, noise)
    const rawRight = baseline + envelope * rightAmplitude + signedNoise(random, noise)
    let values: [number, number, number, number] = [
      clampPercent(rawLeft),
      clampPercent(rawLeft * 0.78 + signedNoise(random, noise)),
      clampPercent(rawRight),
      clampPercent(rawRight * 0.76 + signedNoise(random, noise)),
    ]

    if (options.oversmoothed && previous) {
      values = values.map((value, index) =>
        clampPercent(previous![index] * 0.86 + value * 0.14)
      ) as [number, number, number, number]
    }
    previous = values

    if (options.leftRightSwap) {
      values = [values[2], values[3], values[0], values[1]]
    }

    const payload: TelemetryFrame = {
      t: eventTime,
      seq,
      ch: values,
      labels: ['Left Primary', 'Left Alt', 'Right Primary', 'Right Alt'],
      streamHz: nominalHz,
      sampleHz: options.lowRate ? 500 : 1000,
      state: 'monitoring',
    }

    events.push({
      atMs: eventTime,
      payload,
      issue: options.leftRightSwap
        ? 'left-right-swap'
        : options.lowRate
          ? 'low-rate'
          : options.oversmoothed
            ? 'oversmoothed'
            : inBurst
              ? 'burst'
              : 'idle',
    })
    seq += 1
  }

  if (events.every((event) => event.issue !== 'dropout')) {
    events.push({
      atMs: dropoutStart,
      payload: { note: `dropout from ${dropoutStart} to ${dropoutEnd}` },
      issue: 'dropout',
    })
  }

  return events.sort((a, b) => a.atMs - b.atMs)
}

function burstEnvelope(t: number, start: number, end: number): number {
  const progress = (t - start) / Math.max(1, end - start)
  return Math.sin(Math.PI * Math.max(0, Math.min(1, progress)))
}

function signedNoise(random: () => number, amount: number): number {
  return (random() * 2 - 1) * amount
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}
