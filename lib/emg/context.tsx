'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react'
import {
  EMGData,
  DEFAULT_EMG_DATA,
  DEFAULT_TEMP,
  simulateEMGTick,
  constrain,
} from '@/lib/emg/calculations'
import {
  DEFAULT_DEVICE_DIAGNOSTICS,
  DeviceClient,
  type DeviceTelemetryDiagnostics,
} from '@/lib/device/websocket'
import { AblyRelayClient } from '@/lib/device/ably-relay'
import { DEFAULT_RELAY_DEVICE_ID } from '@/lib/device/relay-config'
import {
  appendHistoryPoint,
  emgDataFromChannels,
  smoothTelemetryChannels,
  type EMGHistoryPoint,
} from '@/lib/emg/ingestion'
import type {
  DataSource,
  DeviceConnectionState,
  HelloFrame,
  NormalizedTelemetryFrame,
} from '@/lib/device/types'

export type { EMGHistoryPoint } from '@/lib/emg/ingestion'

interface EMGContextValue {
  emgData: EMGData
  temperature: number
  channelLabels: [string, string, string, string]
  history: EMGHistoryPoint[]
  precheckSamples: EMGHistoryPoint[]
  isMonitoring: boolean
  isPrechecking: boolean
  sessionTime: number
  toggleMonitoring: () => void
  startPrecheck: () => void
  stopPrecheck: () => void
  resetPrecheck: () => void
  dataSource: DataSource
  setDataSource: (s: DataSource) => void
  deviceState: DeviceConnectionState
  deviceAddress: string
  deviceFirmwareVersion: string | null
  deviceDiagnostics: DeviceTelemetryDiagnostics
  connectDevice: (target: string) => void
  connectRelay: (deviceId?: string) => void
  disconnectDevice: () => void
  syncDeviceLabels: (labels: [string, string, string, string]) => void
}

const EMGContext = createContext<EMGContextValue | null>(null)

const LS_SOURCE = 'myopack:data_source'
const LS_ADDRESS = 'myopack:device_address'
const MAX_HISTORY_POINTS = 120
const MAX_PRECHECK_POINTS = 80
const DEFAULT_LIVE_SOURCE: DataSource = 'relay'

export function EMGProvider({ children }: { children: ReactNode }) {
  const defaultRelayDeviceId = process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID || DEFAULT_RELAY_DEVICE_ID
  const [emgData, setEmgData] = useState<EMGData>(DEFAULT_EMG_DATA)
  const [temperature, setTemperature] = useState(DEFAULT_TEMP)
  // Default labels before the firmware hello frame arrives.
  // ch[0]/ch[1] = U1 (CS=21) = left body side; ch[2]/ch[3] = U4 (CS=22) = right body side.
  const [channelLabels, setChannelLabels] = useState<[string, string, string, string]>([
    'Left Primary',
    'Left Alt',
    'Right Primary',
    'Right Alt',
  ])
  const [history, setHistory] = useState<EMGHistoryPoint[]>([])
  const [precheckSamples, setPrecheckSamples] = useState<EMGHistoryPoint[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isPrechecking, setIsPrechecking] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [dataSource, setDataSourceState] = useState<DataSource>(DEFAULT_LIVE_SOURCE)
  const [deviceState, setDeviceState] = useState<DeviceConnectionState>('disconnected')
  const [deviceAddress, setDeviceAddress] = useState<string>(defaultRelayDeviceId)
  const [deviceFirmwareVersion, setDeviceFirmwareVersion] = useState<string | null>(null)
  const [deviceDiagnostics, setDeviceDiagnostics] = useState<DeviceTelemetryDiagnostics>(DEFAULT_DEVICE_DIAGNOSTICS)

  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const precheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceClientRef = useRef<DeviceClient | null>(null)
  const relayClientRef = useRef<AblyRelayClient | null>(null)
  const isMonitoringRef = useRef(false)
  const isPrecheckingRef = useRef(false)
  const smoothedChannelsRef = useRef<[number, number, number, number] | null>(null)

  useEffect(() => {
    isMonitoringRef.current = isMonitoring
  }, [isMonitoring])

  useEffect(() => {
    isPrecheckingRef.current = isPrechecking
  }, [isPrechecking])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedSource = window.localStorage.getItem(LS_SOURCE) as DataSource | null
      const savedAddr = window.localStorage.getItem(LS_ADDRESS) ?? defaultRelayDeviceId
      if (savedSource === 'device' && savedAddr) {
        setDeviceAddress(savedAddr)
        setDataSourceState('device')
      } else {
        setDeviceAddress(savedAddr || defaultRelayDeviceId)
        setDataSourceState(DEFAULT_LIVE_SOURCE)
      }
    } catch {
      // ignore storage failures
    }
  }, [defaultRelayDeviceId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LS_SOURCE, dataSource === 'simulated' ? DEFAULT_LIVE_SOURCE : dataSource)
    } catch {
      // ignore storage failures
    }
  }, [dataSource])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(LS_ADDRESS, deviceAddress)
    } catch {
      // ignore storage failures
    }
  }, [deviceAddress])

  const stopSimTimers = useCallback(() => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current)
      simTimerRef.current = null
    }
  }, [])

  const stopPrecheckTimer = useCallback(() => {
    if (precheckTimerRef.current) {
      clearInterval(precheckTimerRef.current)
      precheckTimerRef.current = null
    }
  }, [])

  const stopSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }, [])

  const resetLiveState = useCallback(() => {
    isMonitoringRef.current = false
    isPrecheckingRef.current = false
    setIsMonitoring(false)
    setIsPrechecking(false)
    setSessionTime(0)
    setHistory([])
    setPrecheckSamples([])
    setEmgData(DEFAULT_EMG_DATA)
    setTemperature(DEFAULT_TEMP)
    smoothedChannelsRef.current = null
  }, [])

  const pushHistory = useCallback((values: [number, number, number, number], timestamp = Date.now()) => {
    setHistory((prev) => appendHistoryPoint(prev, values, timestamp, MAX_HISTORY_POINTS))
  }, [])

  const pushPrecheckSample = useCallback((values: [number, number, number, number], timestamp = Date.now()) => {
    setPrecheckSamples((prev) => appendHistoryPoint(prev, values, timestamp, MAX_PRECHECK_POINTS))
  }, [])

  const handleHello = useCallback((hello: HelloFrame) => {
    setDeviceFirmwareVersion(hello.version)
    if (hello.labels && hello.labels.length >= 4) {
      setChannelLabels([
        hello.labels[0],
        hello.labels[1],
        hello.labels[2],
        hello.labels[3],
      ])
    }
  }, [])

  const handleTelemetry = useCallback((frame: NormalizedTelemetryFrame) => {
    const values = frame.channels

    if (frame.labels) {
      setChannelLabels(frame.labels)
    }

    const timestamp = frame.timestamp

    if (isPrecheckingRef.current) {
      pushPrecheckSample(values, timestamp)
    }

    if (!isMonitoringRef.current) return

    const smoothed = smoothTelemetryChannels(smoothedChannelsRef.current, values)
    smoothedChannelsRef.current = smoothed
    setEmgData(emgDataFromChannels(smoothed, timestamp))
    pushHistory(smoothed, timestamp)
  }, [pushHistory, pushPrecheckSample])

  const ensureClient = useCallback((): DeviceClient => {
    if (deviceClientRef.current) return deviceClientRef.current

    const client = new DeviceClient({
      onState: (state) => setDeviceState(state),
      onHello: handleHello,
      onDiagnostics: (diagnostics) => {
        setDeviceDiagnostics(diagnostics)
      },
      onTelemetry: handleTelemetry,
      onError: (msg) => {
        console.warn('[device]', msg)
      },
    })

    deviceClientRef.current = client
    return client
  }, [handleHello, handleTelemetry])

  const ensureRelayClient = useCallback((): AblyRelayClient => {
    if (relayClientRef.current) return relayClientRef.current

    const client = new AblyRelayClient({
      onState: (state) => setDeviceState(state),
      onHello: handleHello,
      onDiagnostics: (diagnostics) => {
        setDeviceDiagnostics(diagnostics)
      },
      onTelemetry: handleTelemetry,
      onError: (msg) => {
        console.warn('[relay]', msg)
      },
    })

    relayClientRef.current = client
    return client
  }, [handleHello, handleTelemetry])

  const connectDevice = useCallback((target: string) => {
    setDeviceAddress(target)
    setDataSourceState('device')
    stopSimTimers()
    stopSessionTimer()
    stopPrecheckTimer()
    resetLiveState()
    relayClientRef.current?.disconnect()
    setDeviceDiagnostics(DEFAULT_DEVICE_DIAGNOSTICS)
    const client = ensureClient()
    client.connect(target)
  }, [ensureClient, resetLiveState, stopPrecheckTimer, stopSessionTimer, stopSimTimers])

  const connectRelay = useCallback((deviceId?: string) => {
    const relayDeviceId = deviceId || process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID || DEFAULT_RELAY_DEVICE_ID
    setDeviceAddress(relayDeviceId)
    setDeviceFirmwareVersion(null)
    setDataSourceState('relay')
    stopSimTimers()
    stopSessionTimer()
    stopPrecheckTimer()
    resetLiveState()
    deviceClientRef.current?.disconnect()
    setDeviceDiagnostics(DEFAULT_DEVICE_DIAGNOSTICS)
    const client = ensureRelayClient()
    client.connect(relayDeviceId)
  }, [ensureRelayClient, resetLiveState, stopPrecheckTimer, stopSessionTimer, stopSimTimers])

  const disconnectDevice = useCallback(() => {
    deviceClientRef.current?.disconnect()
    relayClientRef.current?.disconnect()
  }, [])

  const syncDeviceLabels = useCallback((labels: [string, string, string, string]) => {
    setChannelLabels(labels)
    const client = dataSource === 'relay' ? relayClientRef.current : deviceClientRef.current
    if (!client?.isConnected()) return
    labels.forEach((label, index) => {
      client.setLabel(index as 0 | 1 | 2 | 3, label)
    })
  }, [dataSource])

  useEffect(() => {
    if (dataSource !== 'device' || !deviceAddress) return
    const client = ensureClient()
    if (!client.isConnected()) client.connect(deviceAddress)
  }, [dataSource, deviceAddress, ensureClient])

  useEffect(() => {
    if (dataSource !== 'relay') return
    const client = ensureRelayClient()
    if (!client.isConnected()) client.connect(deviceAddress || process.env.NEXT_PUBLIC_MYOPACK_DEVICE_ID || DEFAULT_RELAY_DEVICE_ID)
  }, [dataSource, deviceAddress, ensureRelayClient])

  useEffect(() => {
    return () => {
      deviceClientRef.current?.disconnect()
      deviceClientRef.current = null
      relayClientRef.current?.disconnect()
      relayClientRef.current = null
    }
  }, [])

  const startSimulation = useCallback(() => {
    stopSimTimers()
    simTimerRef.current = setInterval(() => {
      setEmgData((prev) => {
        const next = simulateEMGTick(prev)
        pushHistory(
          [next.leftQuad, next.rightQuad, next.leftHam, next.rightHam],
          Date.now()
        )
        return next
      })
      setTemperature((prev) =>
        constrain(prev + (Math.random() * 0.2 - 0.1), 31.0, 34.0)
      )
    }, 50)
  }, [pushHistory, stopSimTimers])

  const resetPrecheck = useCallback(() => {
    setPrecheckSamples([])
  }, [])

  const stopPrecheck = useCallback(() => {
    isPrecheckingRef.current = false
    setIsPrechecking(false)
    stopPrecheckTimer()
  }, [stopPrecheckTimer])

  const startPrecheck = useCallback(() => {
    if (isMonitoringRef.current) return
    stopPrecheckTimer()
    setPrecheckSamples([])
    isPrecheckingRef.current = true
    setIsPrechecking(true)

    if (dataSource === 'simulated') {
      let current = emgData
      precheckTimerRef.current = setInterval(() => {
        current = simulateEMGTick(current)
        pushPrecheckSample(
          [current.leftQuad, current.rightQuad, current.leftHam, current.rightHam],
          Date.now()
        )
      }, 50)
    }
  }, [dataSource, emgData, pushPrecheckSample, stopPrecheckTimer])

  const startSession = useCallback(() => {
    isMonitoringRef.current = true
    stopPrecheck()
    stopSessionTimer()
    setSessionTime(0)
    setHistory([])
    smoothedChannelsRef.current = null
    sessionTimerRef.current = setInterval(() => {
      setSessionTime((t) => t + 1)
    }, 1000)

    if (dataSource === 'simulated') {
      startSimulation()
    }
  }, [dataSource, startSimulation, stopPrecheck, stopSessionTimer])

  const stopSession = useCallback(() => {
    isMonitoringRef.current = false
    stopSessionTimer()
    stopSimTimers()
    smoothedChannelsRef.current = null
  }, [stopSessionTimer, stopSimTimers])

  const toggleMonitoring = useCallback(() => {
    setIsMonitoring((prev) => {
      if (!prev) startSession()
      else stopSession()
      return !prev
    })
  }, [startSession, stopSession])

  const setDataSource = useCallback((source: DataSource) => {
    setDataSourceState(source)
    if (source === 'device') {
      stopSimTimers()
      stopSessionTimer()
      stopPrecheckTimer()
      resetLiveState()
      relayClientRef.current?.disconnect()
    } else if (source === 'relay') {
      stopSimTimers()
      stopSessionTimer()
      stopPrecheckTimer()
      resetLiveState()
      deviceClientRef.current?.disconnect()
    } else if (isMonitoringRef.current) {
      deviceClientRef.current?.disconnect()
      relayClientRef.current?.disconnect()
      startSimulation()
    }
  }, [resetLiveState, startSimulation, stopPrecheckTimer, stopSessionTimer, stopSimTimers])

  useEffect(() => {
    return () => {
      stopSimTimers()
      stopSessionTimer()
      stopPrecheckTimer()
    }
  }, [stopPrecheckTimer, stopSimTimers, stopSessionTimer])

  const value: EMGContextValue = {
    emgData,
    temperature,
    channelLabels,
    history,
    precheckSamples,
    isMonitoring,
    isPrechecking,
    sessionTime,
    toggleMonitoring,
    startPrecheck,
    stopPrecheck,
    resetPrecheck,
    dataSource,
    setDataSource,
    deviceState,
    deviceAddress,
    deviceFirmwareVersion,
    deviceDiagnostics,
    connectDevice,
    connectRelay,
    disconnectDevice,
    syncDeviceLabels,
  }

  return <EMGContext.Provider value={value}>{children}</EMGContext.Provider>
}

export function useEMG(): EMGContextValue {
  const ctx = useContext(EMGContext)
  if (!ctx) throw new Error('useEMG must be used inside <EMGProvider>')
  return ctx
}
