'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getMuscleRegion,
  LEFT_CHANNEL_CANDIDATES,
  MUSCLE_REGIONS,
  pairFromRoute,
  RIGHT_CHANNEL_CANDIDATES,
  routeFromPair,
  type ChannelRoute,
  type MuscleGroup,
  type SensorPair,
  type SideMode,
} from '@/lib/muscle-selection'

interface MuscleSelectionValue {
  selectedGroup: MuscleGroup | null
  sideMode: SideMode
  sensorPair: SensorPair
  channelRoute: ChannelRoute
  hasSelection: boolean
  placementConfirmed: boolean
  selectGroup: (group: MuscleGroup) => void
  confirmPlacement: () => void
  setSideMode: (mode: SideMode) => void
  setSensorPair: (pair: SensorPair) => void
  setChannelRoute: (route: ChannelRoute) => void
  resetSelection: () => void
}

const MuscleSelectionContext = createContext<MuscleSelectionValue | null>(null)

const LS_GROUP = 'myopack:selected_muscle'
const LS_SIDE = 'myopack:selected_side'
const LS_PAIR = 'myopack:selected_sensor_pair'
const LS_ROUTE = 'myopack:selected_channel_route'
const LS_PLACEMENT = 'myopack:placement_confirmed'


function isSideMode(value: string | null): value is SideMode {
  return value === 'left' || value === 'right' || value === 'bilateral'
}

function isSensorPair(value: string | null): value is SensorPair {
  return value === 'pairA' || value === 'pairB'
}

function isMuscleGroup(value: string | null): value is MuscleGroup {
  return MUSCLE_REGIONS.some((region) => region.id === value)
}

function parseChannelRoute(value: string | null): ChannelRoute | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<ChannelRoute>
    const leftOk = LEFT_CHANNEL_CANDIDATES.includes(parsed.leftIndex as ChannelRoute['leftIndex'])
    const rightOk = RIGHT_CHANNEL_CANDIDATES.includes(parsed.rightIndex as ChannelRoute['rightIndex'])
    if (!leftOk || !rightOk) return null
    const leftIndex = parsed.leftIndex as ChannelRoute['leftIndex']
    const rightIndex = parsed.rightIndex as ChannelRoute['rightIndex']
    return { leftIndex, rightIndex }
  } catch {
    return null
  }
}

function persistRoute(route: ChannelRoute) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LS_ROUTE, JSON.stringify(route))
}

export function MuscleSelectionProvider({ children }: { children: ReactNode }) {
  const [selectedGroup, setSelectedGroup] = useState<MuscleGroup | null>(null)
  const [sideMode, setSideModeState] = useState<SideMode>('bilateral')
  const [sensorPair, setSensorPairState] = useState<SensorPair>('pairA')
  const [channelRoute, setChannelRouteState] = useState<ChannelRoute>(() => routeFromPair('pairA'))
  const [placementConfirmed, setPlacementConfirmed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedGroup = window.localStorage.getItem(LS_GROUP)
      const savedSide = window.localStorage.getItem(LS_SIDE)
      const savedPair = window.localStorage.getItem(LS_PAIR)
      const savedRoute = parseChannelRoute(window.localStorage.getItem(LS_ROUTE))

      if (isMuscleGroup(savedGroup)) {
        const defaultPair = getMuscleRegion(savedGroup).defaultPair
        const resolvedPair = isSensorPair(savedPair) ? savedPair : defaultPair
        const resolvedRoute = savedRoute ?? routeFromPair(resolvedPair)
        setSelectedGroup(savedGroup)
        setPlacementConfirmed(window.localStorage.getItem(LS_PLACEMENT) === 'true')
        setSensorPairState(pairFromRoute(resolvedRoute) ?? resolvedPair)
        setChannelRouteState(resolvedRoute)
      } else if (isSensorPair(savedPair)) {
        const resolvedRoute = savedRoute ?? routeFromPair(savedPair)
        setSensorPairState(pairFromRoute(resolvedRoute) ?? savedPair)
        setChannelRouteState(resolvedRoute)
      } else if (savedRoute) {
        setChannelRouteState(savedRoute)
      }
      if (isSideMode(savedSide)) setSideModeState(savedSide)
    } catch {
      // ignore storage failures
    }
  }, [])

  const selectGroup = useCallback((group: MuscleGroup) => {
    const defaultPair = getMuscleRegion(group).defaultPair
    const defaultRoute = routeFromPair(defaultPair)
    setSelectedGroup(group)
    setSensorPairState(defaultPair)
    setChannelRouteState(defaultRoute)
    setPlacementConfirmed(false)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_GROUP, group)
        window.localStorage.setItem(LS_PAIR, defaultPair)
        persistRoute(defaultRoute)
        window.localStorage.setItem(LS_PLACEMENT, 'false')
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const confirmPlacement = useCallback(() => {
    setPlacementConfirmed(true)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_PLACEMENT, 'true')
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const setSideMode = useCallback((mode: SideMode) => {
    setSideModeState(mode)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_SIDE, mode)
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const setSensorPair = useCallback((pair: SensorPair) => {
    const route = routeFromPair(pair)
    setSensorPairState(pair)
    setChannelRouteState(route)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LS_PAIR, pair)
        persistRoute(route)
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const setChannelRoute = useCallback((route: ChannelRoute) => {
    setChannelRouteState(route)
    const pair = pairFromRoute(route)
    if (pair) setSensorPairState(pair)
    if (typeof window !== 'undefined') {
      try {
        persistRoute(route)
        if (pair) window.localStorage.setItem(LS_PAIR, pair)
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const resetSelection = useCallback(() => {
    setSelectedGroup(null)
    setPlacementConfirmed(false)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LS_GROUP)
        window.localStorage.removeItem(LS_PLACEMENT)
      } catch {
        // ignore storage failures
      }
    }
  }, [])

  const value = useMemo<MuscleSelectionValue>(
    () => ({
      selectedGroup,
      sideMode,
      sensorPair,
      channelRoute,
      hasSelection: selectedGroup !== null,
      placementConfirmed,
      selectGroup,
      confirmPlacement,
      setSideMode,
      setSensorPair,
      setChannelRoute,
      resetSelection,
    }),
    [
      confirmPlacement,
      placementConfirmed,
      resetSelection,
      selectGroup,
      selectedGroup,
      sensorPair,
      channelRoute,
      setChannelRoute,
      setSensorPair,
      setSideMode,
      sideMode,
    ]
  )

  return (
    <MuscleSelectionContext.Provider value={value}>
      {children}
    </MuscleSelectionContext.Provider>
  )
}

export function useMuscleSelection(): MuscleSelectionValue {
  const ctx = useContext(MuscleSelectionContext)
  if (!ctx) throw new Error('useMuscleSelection must be used inside <MuscleSelectionProvider>')
  return ctx
}
