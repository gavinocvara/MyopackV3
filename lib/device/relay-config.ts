export const DEFAULT_RELAY_DEVICE_ID = 'demo-01'

export function normalizeRelayDeviceId(deviceId: string): string {
  const cleaned = deviceId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  return cleaned || DEFAULT_RELAY_DEVICE_ID
}

export function relayChannelName(deviceId: string, lane: 'telemetry' | 'control'): string {
  return `myopack:${normalizeRelayDeviceId(deviceId)}:${lane}`
}
