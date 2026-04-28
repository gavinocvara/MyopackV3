'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEMG } from '@/lib/emg/context'
import { DEFAULT_RELAY_DEVICE_ID, normalizeRelayDeviceId, relayChannelName } from '@/lib/device/relay-config'

interface DeviceConnectModalProps {
  open: boolean
  onClose: () => void
}

type LinkMode = 'relay' | 'local'

export function DeviceConnectModal({ open, onClose }: DeviceConnectModalProps) {
  const {
    dataSource,
    setDataSource,
    deviceState,
    deviceAddress,
    deviceFirmwareVersion,
    connectDevice,
    connectRelay,
    disconnectDevice,
  } = useEMG()

  const defaultDeviceId = process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID || DEFAULT_RELAY_DEVICE_ID
  const [mode, setMode] = useState<LinkMode>('relay')
  const [localInput, setLocalInput] = useState(deviceAddress || '')
  const [relayInput, setRelayInput] = useState(defaultDeviceId)
  const [isHostedHttps, setIsHostedHttps] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const relayDeviceId = useMemo(() => normalizeRelayDeviceId(relayInput), [relayInput])
  const telemetryChannel = relayChannelName(relayDeviceId, 'telemetry')
  const controlChannel = relayChannelName(relayDeviceId, 'control')

  useEffect(() => {
    if (!open) return
    setConnectionNotice(null)
    setMode(dataSource === 'device' ? 'local' : 'relay')
    if (dataSource === 'device') {
      setLocalInput(deviceAddress || '')
    } else {
      setRelayInput(deviceAddress || defaultDeviceId)
    }
    const id = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(id)
  }, [open, dataSource, deviceAddress, defaultDeviceId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = window.location.hostname
    setIsHostedHttps(
      window.location.protocol === 'https:' &&
        host !== 'localhost' &&
        host !== '127.0.0.1' &&
        host !== '[::1]'
    )
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleRelayConnect = () => {
    setConnectionNotice(null)
    connectRelay(relayDeviceId)
  }

  const handleLocalConnect = () => {
    const target = localInput.trim()
    if (!target) return
    const isSecureTarget = target.startsWith('wss://')
    if (isHostedHttps && !isSecureTarget) {
      setConnectionNotice(
        'Vercel is HTTPS, so mobile browsers block direct ws:// ESP32 links. Use Cloud Relay for phone demos, or use Local LAN only from a local HTTP app.'
      )
      return
    }
    connectDevice(target)
  }

  const handleUseSim = () => {
    disconnectDevice()
    setDataSource('simulated')
    onClose()
  }

  const stateColor =
    deviceState === 'connected'  ? 'var(--mp-jade)' :
    deviceState === 'connecting' ? 'var(--mp-amber)' :
    deviceState === 'error'      ? 'var(--mp-rose)' :
                                   'var(--mp-t3)'

  const stateLabel =
    deviceState === 'connected'  ? dataSource === 'relay' ? 'Cloud relay live' : 'Local device live' :
    deviceState === 'connecting' ? 'Linking...' :
    deviceState === 'error'      ? 'Unreachable' :
                                   'Not connected'

  const isActiveModeConnected =
    deviceState === 'connected' &&
    ((mode === 'relay' && dataSource === 'relay') || (mode === 'local' && dataSource === 'device'))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(8,10,13,0.78)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 14px calc(env(safe-area-inset-bottom, 0px) + 16px)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              key="sheet"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label="Connect MyoPack device"
              style={{
                width: 'min(100%, 390px)',
                maxHeight: 'min(660px, calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))',
                overflowY: 'auto',
                zIndex: 100,
                background: 'var(--mp-s1)',
                border: '1px solid var(--mp-line2)',
                borderRadius: 22,
                padding: 24,
                boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <p
                    style={{
                      fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
                      color: 'var(--mp-t4)', fontWeight: 700, marginBottom: 4,
                    }}
                  >
                    Device Link
                  </p>
                  <h2
                    style={{
                      fontSize: 20, fontWeight: 800, color: 'var(--mp-t1)',
                      lineHeight: 1.1,
                    }}
                  >
                    Connect MyoPack
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'var(--mp-s2)',
                    border: '1px solid var(--mp-line2)',
                    color: 'var(--mp-t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <div
                style={{
                  marginTop: 16,
                  background: 'var(--mp-s2)',
                  border: '1px solid var(--mp-line)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <motion.div
                    animate={
                      deviceState === 'connected' || deviceState === 'connecting'
                        ? { opacity: [1, 0.4, 1] }
                        : {}
                    }
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: stateColor,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--mp-t2)', fontWeight: 600 }}>
                    {stateLabel}
                  </span>
                </div>
                {deviceFirmwareVersion && deviceState === 'connected' && (
                  <span style={{ fontSize: 10, color: 'var(--mp-t4)', fontFamily: 'monospace' }}>
                    fw {deviceFirmwareVersion}
                  </span>
                )}
              </div>

              <div
                role="tablist"
                aria-label="Device link mode"
                style={{
                  marginTop: 16,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                {([
                  ['relay', 'Cloud Relay'],
                  ['local', 'Local LAN'],
                ] as const).map(([id, label]) => {
                  const active = mode === id
                  return (
                    <button
                      key={id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setMode(id); setConnectionNotice(null) }}
                      style={{
                        height: 38,
                        borderRadius: 12,
                        border: `1px solid ${active ? 'rgba(31,216,164,0.42)' : 'var(--mp-line2)'}`,
                        background: active ? 'rgba(31,216,164,0.12)' : 'rgba(255,255,255,0.025)',
                        color: active ? 'var(--mp-jade)' : 'var(--mp-t3)',
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {mode === 'relay' ? (
                <div style={{ marginTop: 18 }}>
                  <label
                    htmlFor="relay-device-id"
                    style={{
                      display: 'block',
                      fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: 'var(--mp-t4)', fontWeight: 700, marginBottom: 8,
                    }}
                  >
                    Device ID
                  </label>
                  <input
                    id="relay-device-id"
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={DEFAULT_RELAY_DEVICE_ID}
                    value={relayInput}
                    onChange={(e) => setRelayInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRelayConnect() }}
                    style={{
                      width: '100%',
                      background: 'var(--mp-bg2)',
                      border: '1px solid var(--mp-line2)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: 'var(--mp-t1)',
                      fontSize: 14,
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 12,
                      padding: 10,
                      background: 'rgba(31,216,164,0.08)',
                      border: '1px solid rgba(31,216,164,0.20)',
                    }}
                  >
                    <p style={{ fontSize: 10, color: 'var(--mp-t3)', lineHeight: 1.55 }}>
                      Trusted path: Ably TLS relay at main.mqtt.ably.net:8883 for the ESP32 and Ably Realtime WSS for this app.
                    </p>
                    <p style={{ marginTop: 6, fontSize: 10, color: 'var(--mp-t4)', fontFamily: 'monospace', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                      {telemetryChannel}
                    </p>
                    <p style={{ marginTop: 2, fontSize: 10, color: 'var(--mp-t4)', fontFamily: 'monospace', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                      {controlChannel}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 18 }}>
                  <label
                    htmlFor="device-target"
                    style={{
                      display: 'block',
                      fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                      color: 'var(--mp-t4)', fontWeight: 700, marginBottom: 8,
                    }}
                  >
                    Address
                  </label>
                  <input
                    id="device-target"
                    ref={inputRef}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="myopack.local or 192.168.1.42"
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLocalConnect() }}
                    style={{
                      width: '100%',
                      background: 'var(--mp-bg2)',
                      border: '1px solid var(--mp-line2)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      color: 'var(--mp-t1)',
                      fontSize: 14,
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                  <p style={{ fontSize: 10, color: 'var(--mp-t3)', marginTop: 8, lineHeight: 1.5 }}>
                    Serial monitor prints the IP after the device joins WiFi. Port 81 is assumed for local HTTP demos.
                  </p>
                  {isHostedHttps && (
                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 14,
                        padding: 12,
                        background: 'rgba(242,184,75,0.10)',
                        border: '1px solid rgba(242,184,75,0.24)',
                      }}
                    >
                      <p
                        style={{
                          marginBottom: 6,
                          fontSize: 9,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--mp-amber)',
                          fontWeight: 800,
                        }}
                      >
                        Hosted app limit
                      </p>
                      <p style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--mp-t2)' }}>
                        This Vercel page is HTTPS. Direct ESP32 LAN links are plain ws://, so phone browsers block them before MyoPack can read telemetry.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {connectionNotice && (
                <div
                  role="status"
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    padding: 10,
                    background: 'rgba(248,113,113,0.10)',
                    border: '1px solid rgba(248,113,113,0.24)',
                    color: 'var(--mp-rose)',
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  {connectionNotice}
                </div>
              )}

              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {isActiveModeConnected ? (
                  <button
                    onClick={() => { disconnectDevice() }}
                    style={{
                      width: '100%', height: 46, borderRadius: 12,
                      background: 'rgba(248,113,113,0.10)',
                      border: '1px solid rgba(248,113,113,0.28)',
                      color: 'var(--mp-rose)',
                      fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={mode === 'relay' ? handleRelayConnect : handleLocalConnect}
                    disabled={mode === 'local' && !localInput.trim()}
                    style={{
                      width: '100%', height: 46, borderRadius: 12,
                      background: mode === 'local' && !localInput.trim() ? 'var(--mp-s2)' : 'rgba(31,216,164,0.15)',
                      border: `1px solid ${mode === 'local' && !localInput.trim() ? 'var(--mp-line2)' : 'rgba(31,216,164,0.40)'}`,
                      color: mode === 'local' && !localInput.trim() ? 'var(--mp-t3)' : 'var(--mp-jade)',
                      fontSize: 12, fontWeight: 700,
                      letterSpacing: '0.1em', textTransform: 'uppercase',
                      cursor: mode === 'local' && !localInput.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deviceState === 'connecting' ? 'Linking...' : mode === 'relay' ? 'Connect Cloud Relay' : 'Connect Local'}
                  </button>
                )}

                <button
                  onClick={handleUseSim}
                  style={{
                    width: '100%', height: 38, borderRadius: 12,
                    background: 'transparent',
                    border: '1px solid var(--mp-line2)',
                    color: dataSource === 'simulated' ? 'var(--mp-sky)' : 'var(--mp-t3)',
                    fontSize: 11, fontWeight: 600,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  {dataSource === 'simulated' ? 'Using Simulation' : 'Use Simulation Instead'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
