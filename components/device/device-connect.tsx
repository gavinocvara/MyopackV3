'use client'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEMG } from '@/lib/emg/context'

interface DeviceConnectModalProps {
  open: boolean
  onClose: () => void
}

export function DeviceConnectModal({ open, onClose }: DeviceConnectModalProps) {
  const {
    dataSource,
    setDataSource,
    deviceState,
    deviceAddress,
    deviceFirmwareVersion,
    connectDevice,
    disconnectDevice,
  } = useEMG()

  const [input, setInput] = useState(deviceAddress || '')
  const [isHostedHttps, setIsHostedHttps] = useState(false)
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // When the modal opens, seed the input with the last-known address
  // and focus the field.
  useEffect(() => {
    if (open) {
      setInput(deviceAddress || '')
      setConnectionNotice(null)
      const id = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(id)
    }
  }, [open, deviceAddress])

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

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleConnect = () => {
    const target = input.trim()
    if (!target) return
    const isSecureTarget = target.startsWith('wss://')
    if (isHostedHttps && !isSecureTarget) {
      setConnectionNotice(
        'This hosted Vercel app is HTTPS, but the ESP32 streams plain ws:// on port 81. Mobile browsers block that mixed-security connection before MyoPack can read the device.'
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
    deviceState === 'connected'  ? 'Connected' :
    deviceState === 'connecting' ? 'Linking…' :
    deviceState === 'error'      ? 'Unreachable' :
                                   'Not connected'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
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
            {/* Sheet */}
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
                width: 'min(100%, 380px)',
                maxHeight: 'min(620px, calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))',
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
            {/* Header */}
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
                    letterSpacing: '-0.02em', lineHeight: 1.1,
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

            {/* Current state row */}
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

            {/* IP / hostname input */}
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
                placeholder="myopack.local  or  192.168.1.42"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConnect() }}
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
              <p
                style={{
                  fontSize: 10, color: 'var(--mp-t3)',
                  marginTop: 8, lineHeight: 1.5,
                }}
              >
                Serial monitor prints the IP after the device joins WiFi. Port 81 is assumed for local HTTP demos.
              </p>
            </div>

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
                  Vercel serves this page over HTTPS. Direct ESP32 links use insecure ws://, so the browser blocks them on phones.
                  For a live LAN demo, run the app locally over HTTP on a laptop connected to the same hotspot and open that laptop IP on the phone.
                  A Vercel-hosted live device path needs a WSS/cloud relay or trusted TLS on the device.
                </p>
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

            {/* Actions */}
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deviceState === 'connected' && dataSource === 'device' ? (
                <button
                  onClick={() => { disconnectDevice(); }}
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
                  onClick={handleConnect}
                  disabled={!input.trim()}
                  style={{
                    width: '100%', height: 46, borderRadius: 12,
                    background: input.trim() ? 'rgba(31,216,164,0.15)' : 'var(--mp-s2)',
                    border: `1px solid ${input.trim() ? 'rgba(31,216,164,0.40)' : 'var(--mp-line2)'}`,
                    color: input.trim() ? 'var(--mp-jade)' : 'var(--mp-t3)',
                    fontSize: 12, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  {deviceState === 'connecting' ? 'Linking…' : 'Connect'}
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
