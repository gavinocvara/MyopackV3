// lib/device/types.ts
// Shared telemetry type definitions. Mirror the firmware JSON frame
// exactly — see firmware/src/telemetry_server.cpp.

export interface HelloFrame {
  hello: 'myopack'
  version: string
  rate: number
  sampleHz?: number
  labels?: string[]
}

export interface TelemetryFrame {
  t?: number       // ms since device boot
  ts?: number      // legacy/current firmware timestamp alias
  seq?: number     // optional monotonically increasing frame counter
  ch: number[]     // activation % per channel
  labels?: string[] // current channel labels from the device
  bal?: number     // overall balance %
  qsym?: number    // quad L/R symmetry %
  hsym?: number    // ham L/R symmetry %
  state?: 'monitoring' | 'idle'
  streamHz?: number
  sampleHz?: number
}

export type AnyFrame = HelloFrame | TelemetryFrame

export interface NormalizedTelemetryFrame {
  timestamp: number
  channels: [number, number, number, number]
  labels?: [string, string, string, string]
  balance?: number
  qsym?: number
  hsym?: number
  state?: 'monitoring' | 'idle'
  seq?: number
  streamHz?: number
  sampleHz?: number
  warnings: string[]
  raw: TelemetryFrame
}

export interface TelemetryParseResult {
  ok: boolean
  frame?: NormalizedTelemetryFrame
  errors: string[]
  warnings: string[]
}

const CHANNEL_COUNT = 4

export function parseTelemetryFrame(
  input: unknown,
  fallbackTimestamp = Date.now()
): TelemetryParseResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['frame is not an object'], warnings }
  }

  const raw = input as Partial<TelemetryFrame>
  if (!Array.isArray(raw.ch)) {
    return { ok: false, errors: ['missing ch[] array'], warnings }
  }
  if (raw.ch.length < CHANNEL_COUNT) {
    return { ok: false, errors: [`ch[] has ${raw.ch.length} values; expected 4`], warnings }
  }

  const channels = raw.ch.slice(0, CHANNEL_COUNT).map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      errors.push(`ch[${index}] is not a finite number`)
      return 0
    }
    if (value < 0 || value > 100) {
      warnings.push(`ch[${index}] outside 0-100 activation range; clamped`)
    }
    return clampPercent(value)
  }) as [number, number, number, number]

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }

  const labels = parseLabels(raw.labels, warnings)
  const timestampSource = typeof raw.t === 'number' ? raw.t : raw.ts
  const timestamp = Number.isFinite(timestampSource) ? Number(timestampSource) : fallbackTimestamp
  if (!Number.isFinite(timestampSource)) {
    warnings.push('missing finite t/ts timestamp; used local receipt time')
  }

  const normalized: NormalizedTelemetryFrame = {
    timestamp,
    channels,
    labels,
    balance: parseOptionalPercent(raw.bal, 'bal', warnings),
    qsym: parseOptionalPercent(raw.qsym, 'qsym', warnings),
    hsym: parseOptionalPercent(raw.hsym, 'hsym', warnings),
    state: raw.state === 'monitoring' || raw.state === 'idle' ? raw.state : undefined,
    seq: Number.isFinite(raw.seq) ? Number(raw.seq) : undefined,
    streamHz: Number.isFinite(raw.streamHz) ? Number(raw.streamHz) : undefined,
    sampleHz: Number.isFinite(raw.sampleHz) ? Number(raw.sampleHz) : undefined,
    warnings,
    raw: raw as TelemetryFrame,
  }

  return { ok: true, frame: normalized, errors, warnings }
}

export function isTelemetryFrame(f: unknown): f is TelemetryFrame {
  return parseTelemetryFrame(f).ok
}

function parseLabels(value: unknown, warnings: string[]): [string, string, string, string] | undefined {
  if (typeof value === 'undefined') return undefined
  if (!Array.isArray(value) || value.length < CHANNEL_COUNT) {
    warnings.push('labels[] missing or shorter than 4; preserving previous labels')
    return undefined
  }
  const labels = value.slice(0, CHANNEL_COUNT)
  if (!labels.every((label) => typeof label === 'string')) {
    warnings.push('labels[] contains non-string values; preserving previous labels')
    return undefined
  }
  return labels as [string, string, string, string]
}

function parseOptionalPercent(value: unknown, label: string, warnings: string[]): number | undefined {
  if (typeof value === 'undefined') return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    warnings.push(`${label} is not finite; ignored`)
    return undefined
  }
  if (value < 0 || value > 100) {
    warnings.push(`${label} outside 0-100 range; clamped`)
  }
  return clampPercent(value)
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function isHelloFrame(f: unknown): f is HelloFrame {
  return (
    !!f &&
    typeof f === 'object' &&
    (f as { hello?: unknown }).hello === 'myopack'
  )
}

export type DeviceConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export type DataSource = 'simulated' | 'device' | 'relay'
