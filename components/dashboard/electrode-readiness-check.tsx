'use client'

import { CheckCircle2, CircleAlert, Radio, RotateCcw } from 'lucide-react'
import {
  analyzeElectrodeReadiness,
  analyzeElectrodeReadinessForRoute,
  type ReadinessState,
} from '@/lib/emg/readiness'
import { getActivationPhase, type ChannelRoute, type SensorPair, type SideMode } from '@/lib/muscle-selection'
import type { EMGHistoryPoint } from '@/lib/emg/context'

interface ElectrodeReadinessCheckProps {
  samples: EMGHistoryPoint[]
  isChecking: boolean
  sensorPair: SensorPair
  channelRoute?: ChannelRoute
  sideMode: SideMode
  muscleLabel: string
  onStart: () => void
  onStop: () => void
  onReset: () => void
}

function stateColor(state: ReadinessState) {
  if (state === 'ready') return 'var(--mp-jade)'
  if (state === 'caution' || state === 'checking') return 'var(--mp-amber)'
  if (state === 'not-ready') return 'var(--mp-rose)'
  return 'var(--mp-t4)'
}

function stateSurface(state: ReadinessState) {
  if (state === 'ready') return 'rgba(36,214,162,0.12)'
  if (state === 'caution' || state === 'checking') return 'rgba(242,184,75,0.12)'
  if (state === 'not-ready') return 'rgba(248,113,113,0.12)'
  return 'rgba(255,255,255,0.045)'
}

export function ElectrodeReadinessCheck({
  samples,
  isChecking,
  sensorPair,
  channelRoute,
  sideMode,
  muscleLabel,
  onStart,
  onStop,
  onReset,
}: ElectrodeReadinessCheckProps) {
  const readiness = channelRoute
    ? analyzeElectrodeReadinessForRoute(samples, channelRoute, sideMode)
    : analyzeElectrodeReadiness(samples, sensorPair, sideMode)
  const color = stateColor(readiness.state)
  const surface = stateSurface(readiness.state)
  const Icon = readiness.state === 'ready' ? CheckCircle2 : readiness.state === 'not-ready' ? CircleAlert : Radio

  return (
    <section className="rounded-[26px] p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Icon size={16} style={{ color }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Passive electrode check
            </p>
          </div>
          <h3 className="text-lg font-black tracking-[-0.03em]" style={{ color }}>
            {readiness.headline}
          </h3>
        </div>
        <span className="rounded-full px-3 py-2 font-mono text-[10px] font-black" style={{ color, background: surface, border: '1px solid var(--mp-line2)' }}>
          {readiness.samples} samples
        </span>
      </div>

      <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
        {readiness.summary} This does not stimulate the body; it only listens to the selected {muscleLabel.toLowerCase()} electrode array.
      </p>

      <div className="mt-4 grid gap-3">
        {readiness.arrays.map((array) => {
          const heat = getActivationPhase(array.score)
          return (
            <div key={array.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                    {array.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold capitalize" style={{ color: stateColor(array.state) }}>
                    {array.state.replace('-', ' ')}{array.channelIndex !== undefined ? ` · ch${array.channelIndex}` : ''}
                  </p>
                </div>
                <p className="font-mono text-2xl font-black tracking-[-0.04em]" style={{ color: heat.color }}>
                  {array.score}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Peak', value: array.peak },
                  { label: 'Range', value: array.range },
                  { label: 'Avg', value: array.average },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl px-2 py-2" style={{ background: 'rgba(0,0,0,0.14)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--mp-t4)' }}>
                      {item.label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-black" style={{ color: 'var(--mp-t2)' }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              {array.issues.length > 0 ? (
                <p className="mt-3 text-[11px] leading-5" style={{ color: stateColor(array.state) }}>
                  {array.issues[0]}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <button
          onClick={isChecking ? onStop : onStart}
          className="h-12 rounded-2xl text-xs font-black uppercase tracking-[0.12em]"
          style={{
            background: isChecking ? 'rgba(242,184,75,0.12)' : 'rgba(36,214,162,0.13)',
            border: `1px solid ${isChecking ? 'rgba(242,184,75,0.30)' : 'rgba(36,214,162,0.32)'}`,
            color: isChecking ? 'var(--mp-amber)' : 'var(--mp-jade)',
          }}
        >
          {isChecking ? 'Stop check' : samples.length > 0 ? 'Run check again' : 'Run passive check'}
        </button>
        <button
          onClick={onReset}
          aria-label="Reset passive electrode check"
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid var(--mp-line2)',
            color: 'var(--mp-t3)',
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </section>
  )
}
