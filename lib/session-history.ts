'use client'

import {
  LEFT_CHANNEL_CANDIDATES,
  RIGHT_CHANNEL_CANDIDATES,
  type ChannelRoute,
  type MuscleGroup,
  type SensorPair,
  type SideMode,
} from '@/lib/muscle-selection'

export interface SessionRecord {
  id: string
  timestamp: string
  muscleGroup: MuscleGroup
  sideMode: SideMode
  sensorPair: SensorPair
  channelRoute?: ChannelRoute
  durationSeconds: number
  activation: number
  symmetry: number | null
  leftActivation?: number
  rightActivation?: number
  dataSource?: 'simulated' | 'device'
  inputHz?: number
  droppedFrames?: number
  parseErrors?: number
  precheckScore?: number
}

const STORAGE_KEY = 'myopack:session_history'
const MAX_RECORDS = 200

export function loadSessionRecords(): SessionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSessionRecord).slice(-MAX_RECORDS)
  } catch {
    return []
  }
}

export function saveSessionRecord(record: Omit<SessionRecord, 'id' | 'timestamp'>): SessionRecord {
  const next: SessionRecord = {
    ...record,
    id: `session-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
  }
  const records = [...loadSessionRecords(), next].slice(-MAX_RECORDS)
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
    } catch {
      // ignore storage failures
    }
  }
  return next
}

export function recordsForGroup(records: SessionRecord[], muscleGroup: MuscleGroup): SessionRecord[] {
  return records.filter((record) => record.muscleGroup === muscleGroup)
}

export function averageScore(records: SessionRecord[]): number | null {
  if (records.length === 0) return null
  const total = records.reduce((sum, record) => {
    const score = record.symmetry ?? record.activation
    return sum + score
  }, 0)
  return total / records.length
}

export function trendDelta(records: SessionRecord[]): number | null {
  if (records.length < 2) return null
  const first = records[0].symmetry ?? records[0].activation
  const last = records[records.length - 1].symmetry ?? records[records.length - 1].activation
  return last - first
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<SessionRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.timestamp === 'string' &&
    isFiniteNumber(record.durationSeconds) &&
    isFiniteNumber(record.activation) &&
    (isFiniteNumber(record.symmetry) || record.symmetry === null) &&
    (isFiniteNumber(record.leftActivation) || typeof record.leftActivation === 'undefined') &&
    (isFiniteNumber(record.rightActivation) || typeof record.rightActivation === 'undefined') &&
    (isOptionalChannelRoute(record.channelRoute) || typeof record.channelRoute === 'undefined') &&
    (record.dataSource === 'simulated' || record.dataSource === 'device' || typeof record.dataSource === 'undefined') &&
    (isFiniteNumber(record.inputHz) || typeof record.inputHz === 'undefined') &&
    (isFiniteNumber(record.droppedFrames) || typeof record.droppedFrames === 'undefined') &&
    (isFiniteNumber(record.parseErrors) || typeof record.parseErrors === 'undefined') &&
    (isFiniteNumber(record.precheckScore) || typeof record.precheckScore === 'undefined') &&
    (record.muscleGroup === 'quads' ||
      record.muscleGroup === 'hamstrings' ||
      record.muscleGroup === 'biceps' ||
      record.muscleGroup === 'shoulders') &&
    (record.sideMode === 'left' || record.sideMode === 'right' || record.sideMode === 'bilateral') &&
    (record.sensorPair === 'pairA' || record.sensorPair === 'pairB')
  )
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalChannelRoute(value: unknown): value is ChannelRoute {
  if (!value || typeof value !== 'object') return false
  const route = value as Partial<ChannelRoute>
  return (
    LEFT_CHANNEL_CANDIDATES.includes(route.leftIndex as ChannelRoute['leftIndex']) &&
    RIGHT_CHANNEL_CANDIDATES.includes(route.rightIndex as ChannelRoute['rightIndex'])
  )
}
