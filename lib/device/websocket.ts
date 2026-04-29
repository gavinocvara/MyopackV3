// lib/device/websocket.ts
// Pure TypeScript WebSocket client for the MyoPack ESP32 telemetry
// server. Framework-agnostic — called from the React context.
//
// Responsibilities:
//   - Open a WebSocket to the device
//   - Auto-reconnect with exponential backoff (capped)
//   - Parse incoming JSON frames
//   - Emit typed callbacks for telemetry / connection state
//
// The React context owns one of these and wires up the handlers.

import {
  type HelloFrame,
  isHelloFrame,
  parseTelemetryFrame,
  type DeviceConnectionState,
  type NormalizedTelemetryFrame,
} from './types'

export interface DeviceTelemetryDiagnostics {
  messagesReceived: number
  telemetryFrames: number
  helloFrames: number
  parseErrors: number
  invalidFrames: number
  warningFrames: number
  droppedFrames: number
  reconnectAttempts: number
  inputHz: number
  expectedStreamHz: number | null
  sampleHz: number | null
  lastFrameAt: number | null
  lastFrameSource: 'ads' | 'firmware-sim' | null
  lastError: string | null
}

export interface DeviceClientHandlers {
  onState?: (s: DeviceConnectionState) => void
  onTelemetry?: (frame: NormalizedTelemetryFrame) => void
  onHello?: (frame: HelloFrame) => void
  onError?: (msg: string) => void
  onDiagnostics?: (diagnostics: DeviceTelemetryDiagnostics) => void
}

export const DEFAULT_DEVICE_DIAGNOSTICS: DeviceTelemetryDiagnostics = {
  messagesReceived: 0,
  telemetryFrames: 0,
  helloFrames: 0,
  parseErrors: 0,
  invalidFrames: 0,
  warningFrames: 0,
  droppedFrames: 0,
  reconnectAttempts: 0,
  inputHz: 0,
  expectedStreamHz: null,
  sampleHz: null,
  lastFrameAt: null,
  lastFrameSource: null,
  lastError: null,
}

export class DeviceClient {
  private ws: WebSocket | null = null
  private url: string | null = null
  private handlers: DeviceClientHandlers
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false
  private diagnostics: DeviceTelemetryDiagnostics = { ...DEFAULT_DEVICE_DIAGNOSTICS }
  private receiptTimes: number[] = []
  private lastSeq: number | null = null
  private lastDiagnosticsEmit = 0

  constructor(handlers: DeviceClientHandlers = {}) {
    this.handlers = handlers
  }

  // Accepts either a full ws:// URL or a host/IP (port defaults to 81).
  // Examples:
  //   connect('192.168.1.42')
  //   connect('myopack.local')
  //   connect('ws://192.168.1.42:81')
  connect(target: string): void {
    const url = normalizeTarget(target)
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.close() } catch { /* noop */ }
      this.ws = null
    }
    this.url = url
    this.shouldReconnect = true
    this.reconnectAttempts = 0
    this.resetDiagnostics()
    this.openSocket()
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      try { this.ws.close() } catch { /* noop */ }
      this.ws = null
    }
    this.emitState('disconnected')
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  sendJson(payload: unknown): boolean {
    if (!this.isConnected() || !this.ws) return false
    try {
      this.ws.send(JSON.stringify(payload))
      return true
    } catch {
      return false
    }
  }

  setLabel(ch: 0 | 1 | 2 | 3, name: string): boolean {
    return this.sendJson({ cmd: 'label', ch, name })
  }

  // ── internal ───────────────────────────────────────────

  private emitState(s: DeviceConnectionState) {
    this.handlers.onState?.(s)
  }

  private resetDiagnostics() {
    this.diagnostics = { ...DEFAULT_DEVICE_DIAGNOSTICS }
    this.receiptTimes = []
    this.lastSeq = null
    this.emitDiagnostics(true)
  }

  private emitDiagnostics(force = false) {
    const now = Date.now()
    if (!force && now - this.lastDiagnosticsEmit < 500) return
    this.lastDiagnosticsEmit = now
    this.handlers.onDiagnostics?.({ ...this.diagnostics })
  }

  private noteError(message: string) {
    this.diagnostics.lastError = message
    this.handlers.onError?.(message)
    this.emitDiagnostics(true)
  }

  private openSocket() {
    if (!this.url) return
    this.emitState('connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch (e) {
      this.noteError(`Invalid WebSocket URL: ${this.url}`)
      this.emitState('error')
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempts = 0
      this.diagnostics.reconnectAttempts = 0
      this.emitState('connected')
      this.emitDiagnostics(true)
    }

    ws.onmessage = (ev) => {
      this.diagnostics.messagesReceived += 1
      let data: unknown
      try {
        data = JSON.parse(ev.data as string)
      } catch {
        this.diagnostics.parseErrors += 1
        this.diagnostics.lastError = 'Non-JSON WebSocket frame ignored'
        this.emitDiagnostics(true)
        return
      }
      if (isHelloFrame(data)) {
        this.diagnostics.helloFrames += 1
        this.diagnostics.expectedStreamHz =
          typeof data.rate === 'number' && Number.isFinite(data.rate) ? data.rate : this.diagnostics.expectedStreamHz
        this.diagnostics.sampleHz =
          typeof data.sampleHz === 'number' && Number.isFinite(data.sampleHz) ? data.sampleHz : this.diagnostics.sampleHz
        this.handlers.onHello?.(data)
        this.emitDiagnostics(true)
        return
      }
      const parsed = parseTelemetryFrame(data, Date.now())
      if (!parsed.ok || !parsed.frame) {
        this.diagnostics.invalidFrames += 1
        this.diagnostics.lastError = parsed.errors.join('; ') || 'Invalid telemetry frame ignored'
        this.emitDiagnostics(true)
        return
      }
      if (parsed.warnings.length > 0) {
        this.diagnostics.warningFrames += 1
        this.diagnostics.lastError = parsed.warnings[0]
      }

      this.noteTelemetryReceipt(parsed.frame)
      this.handlers.onTelemetry?.(parsed.frame)
      this.emitDiagnostics()
    }

    ws.onerror = () => {
      this.noteError('WebSocket error')
      this.emitState('error')
    }

    ws.onclose = () => {
      this.ws = null
      if (this.shouldReconnect) {
        this.emitState('connecting')
        this.scheduleReconnect()
      } else {
        this.emitState('disconnected')
      }
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return
    if (this.reconnectTimer) return
    // Exponential backoff capped at 10s: 500ms, 1s, 2s, 4s, 8s, 10s, 10s...
    const delay = Math.min(500 * Math.pow(2, this.reconnectAttempts), 10_000)
    this.reconnectAttempts++
    this.diagnostics.reconnectAttempts = this.reconnectAttempts
    this.emitDiagnostics(true)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.openSocket()
    }, delay)
  }

  private noteTelemetryReceipt(frame: NormalizedTelemetryFrame) {
    const now = Date.now()
    this.diagnostics.telemetryFrames += 1
    this.diagnostics.lastFrameAt = now
    if (frame.source) this.diagnostics.lastFrameSource = frame.source
    if (typeof frame.streamHz === 'number') this.diagnostics.expectedStreamHz = frame.streamHz
    if (typeof frame.sampleHz === 'number') this.diagnostics.sampleHz = frame.sampleHz

    const expectedHz = this.diagnostics.expectedStreamHz ?? 20
    const expectedPeriod = 1000 / expectedHz
    const previousReceipt = this.receiptTimes[this.receiptTimes.length - 1]
    if (previousReceipt && now - previousReceipt > expectedPeriod * 2.5) {
      this.diagnostics.droppedFrames += Math.max(1, Math.round((now - previousReceipt) / expectedPeriod) - 1)
    }

    if (typeof frame.seq === 'number') {
      if (this.lastSeq !== null && frame.seq > this.lastSeq + 1) {
        this.diagnostics.droppedFrames += frame.seq - this.lastSeq - 1
      }
      this.lastSeq = frame.seq
    }

    this.receiptTimes.push(now)
    if (this.receiptTimes.length > 50) this.receiptTimes.shift()
    if (this.receiptTimes.length >= 2) {
      const first = this.receiptTimes[0]
      const last = this.receiptTimes[this.receiptTimes.length - 1]
      const elapsed = last - first
      this.diagnostics.inputHz = elapsed > 0
        ? ((this.receiptTimes.length - 1) * 1000) / elapsed
        : 0
    }
  }
}

// Accept loose input (IP, hostname, full URL) and normalize.
function normalizeTarget(target: string): string {
  const trimmed = target.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
    return trimmed
  }
  // Add default port 81 if user didn't include one
  const hasPort = /:\d+$/.test(trimmed)
  return `ws://${trimmed}${hasPort ? '' : ':81'}`
}
