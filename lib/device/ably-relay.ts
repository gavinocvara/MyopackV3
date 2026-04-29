// lib/device/ably-relay.ts
// Browser-side Ably Realtime client for the Vercel-hosted device path.

import * as Ably from 'ably'
import {
  isHelloFrame,
  parseTelemetryFrame,
  type DeviceConnectionState,
  type HelloFrame,
  type NormalizedTelemetryFrame,
} from './types'
import {
  DEFAULT_DEVICE_DIAGNOSTICS,
  type DeviceTelemetryDiagnostics,
} from './websocket'
import { DEFAULT_RELAY_DEVICE_ID, normalizeRelayDeviceId, relayChannelName } from './relay-config'

export interface RelayClientHandlers {
  onState?: (s: DeviceConnectionState) => void
  onTelemetry?: (frame: NormalizedTelemetryFrame) => void
  onHello?: (frame: HelloFrame) => void
  onError?: (msg: string) => void
  onDiagnostics?: (diagnostics: DeviceTelemetryDiagnostics) => void
}

export class AblyRelayClient {
  private client: Ably.Realtime | null = null
  private telemetryChannel: ReturnType<Ably.Realtime['channels']['get']> | null = null
  private controlChannel: ReturnType<Ably.Realtime['channels']['get']> | null = null
  private handlers: RelayClientHandlers
  private diagnostics: DeviceTelemetryDiagnostics = { ...DEFAULT_DEVICE_DIAGNOSTICS }
  private receiptTimes: number[] = []
  private lastSeq: number | null = null
  private lastDiagnosticsEmit = 0
  private activeDeviceId = DEFAULT_RELAY_DEVICE_ID
  private connectingRun = 0

  constructor(handlers: RelayClientHandlers = {}) {
    this.handlers = handlers
  }

  connect(deviceId: string = DEFAULT_RELAY_DEVICE_ID): void {
    this.disconnect(false)
    this.activeDeviceId = normalizeRelayDeviceId(deviceId)
    this.connectingRun += 1
    const run = this.connectingRun
    this.resetDiagnostics()
    this.emitState('connecting')

    const authUrl = `/api/ably-token?deviceId=${encodeURIComponent(this.activeDeviceId)}`
    const client = new Ably.Realtime({
      authUrl,
      autoConnect: true,
      clientId: `myopack-web-${this.activeDeviceId}`,
    })

    this.client = client
    this.telemetryChannel = client.channels.get(relayChannelName(this.activeDeviceId, 'telemetry'))
    this.controlChannel = client.channels.get(relayChannelName(this.activeDeviceId, 'control'))

    client.connection.on('connected', () => {
      if (run !== this.connectingRun) return
      this.emitState('connected')
      this.emitDiagnostics(true)
    })
    client.connection.on('connecting', () => {
      if (run !== this.connectingRun) return
      this.emitState('connecting')
    })
    client.connection.on('disconnected', () => {
      if (run !== this.connectingRun) return
      this.emitState('connecting')
    })
    client.connection.on('suspended', () => {
      if (run !== this.connectingRun) return
      this.noteError('Ably relay suspended; waiting for reconnect')
      this.emitState('connecting')
    })
    client.connection.on('failed', (change) => {
      if (run !== this.connectingRun) return
      this.noteError(change.reason?.message ?? 'Ably relay connection failed')
      this.emitState('error')
    })

    this.telemetryChannel.subscribe((message: Ably.InboundMessage) => {
      if (run !== this.connectingRun) return
      this.handleMessage(message.data)
    }).catch((error: unknown) => {
      this.noteError(error instanceof Error ? error.message : 'Unable to subscribe to Ably telemetry')
      this.emitState('error')
    })
  }

  disconnect(emit = true): void {
    this.connectingRun += 1
    if (this.telemetryChannel) {
      try { this.telemetryChannel.unsubscribe() } catch { /* noop */ }
      this.telemetryChannel = null
    }
    if (this.client) {
      try { this.client.close() } catch { /* noop */ }
      this.client = null
    }
    this.controlChannel = null
    if (emit) this.emitState('disconnected')
  }

  isConnected(): boolean {
    return this.client?.connection.state === 'connected'
  }

  setLabel(ch: 0 | 1 | 2 | 3, name: string): boolean {
    if (!this.controlChannel || !this.isConnected()) return false
    this.controlChannel.publish('label', { cmd: 'label', ch, name }).catch((error: unknown) => {
      this.noteError(error instanceof Error ? error.message : 'Unable to publish label command')
    })
    return true
  }

  private handleMessage(data: unknown) {
    this.diagnostics.messagesReceived += 1

    const decoded = decodeAblyPayload(data)
    if (!decoded.ok) {
      this.diagnostics.parseErrors += 1
      this.diagnostics.lastError = decoded.error
      this.emitDiagnostics(true)
      return
    }

    let payload = decoded.payload
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        this.diagnostics.parseErrors += 1
        this.diagnostics.lastError = 'Non-JSON Ably telemetry frame ignored'
        this.emitDiagnostics(true)
        return
      }
    }

    if (isHelloFrame(payload)) {
      this.diagnostics.helloFrames += 1
      this.diagnostics.expectedStreamHz =
        typeof payload.rate === 'number' && Number.isFinite(payload.rate)
          ? payload.rate
          : this.diagnostics.expectedStreamHz
      this.diagnostics.sampleHz =
        typeof payload.sampleHz === 'number' && Number.isFinite(payload.sampleHz)
          ? payload.sampleHz
          : this.diagnostics.sampleHz
      this.handlers.onHello?.(payload)
      this.emitDiagnostics(true)
      return
    }

    const parsed = parseTelemetryFrame(payload, Date.now())
    if (!parsed.ok || !parsed.frame) {
      this.diagnostics.invalidFrames += 1
      this.diagnostics.lastError = parsed.errors.join('; ') || 'Invalid Ably telemetry frame ignored'
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

  private noteTelemetryReceipt(frame: NormalizedTelemetryFrame) {
    const now = Date.now()
    this.diagnostics.telemetryFrames += 1
    this.diagnostics.lastFrameAt = now
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

function decodeAblyPayload(data: unknown): { ok: true; payload: unknown } | { ok: false; error: string } {
  if (typeof data === 'string') return { ok: true, payload: data }
  if (data instanceof ArrayBuffer) {
    return { ok: true, payload: new TextDecoder().decode(new Uint8Array(data)) }
  }
  if (ArrayBuffer.isView(data)) {
    return {
      ok: true,
      payload: new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)),
    }
  }

  if (isNodeBufferJson(data)) {
    return { ok: true, payload: new TextDecoder().decode(Uint8Array.from(data.data)) }
  }

  return { ok: true, payload: data }
}

function isNodeBufferJson(data: unknown): data is { type: 'Buffer'; data: number[] } {
  if (!data || typeof data !== 'object') return false
  const candidate = data as { type?: unknown; data?: unknown }
  return candidate.type === 'Buffer' &&
    Array.isArray(candidate.data) &&
    candidate.data.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
}
