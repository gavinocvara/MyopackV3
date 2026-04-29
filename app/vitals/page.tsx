'use client'

import { motion } from 'framer-motion'
import { Radio, ShieldCheck } from 'lucide-react'
import { useEMG } from '@/lib/emg/context'
import { estimateHistoryRateHz } from '@/lib/emg/ingestion'
import { formatTime } from '@/lib/utils'
import { LiveMuscleGraph } from '@/components/dashboard/live-muscle-graph'
import { MuscleModel } from '@/components/dashboard/muscle-model'
import { useMuscleSelection } from '@/lib/muscle-selection-context'
import {
  CHANNEL_COLORS,
  MUSCLE_REGIONS,
  SIDE_MODES,
  getActivationPhase,
  getMuscleRegion,
  getRouteValues,
  getSideActivation,
} from '@/lib/muscle-selection'

function symmetryColor(value: number) {
  if (value >= 85) return 'var(--mp-jade)'
  if (value >= 70) return 'var(--mp-amber)'
  return 'var(--mp-rose)'
}

function MetricTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))',
        border: '1px solid var(--mp-line2)',
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-black tracking-[-0.04em]" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

export default function VitalsPage() {
  const { emgData, sessionTime, history, isMonitoring, dataSource, deviceDiagnostics } = useEMG()
  const {
    selectedGroup,
    sideMode,
    channelRoute,
    setSideMode,
  } = useMuscleSelection()

  const activeGroup = selectedGroup ?? 'quads'
  const region = getMuscleRegion(activeGroup)
  const values = getRouteValues(emgData, channelRoute)
  const activation = getSideActivation(values, sideMode)
  const phase = getActivationPhase(activation)
  const primaryIndex = sideMode === 'right' ? channelRoute.rightIndex : channelRoute.leftIndex
  const leftColor = CHANNEL_COLORS[channelRoute.leftIndex]
  const rightColor = CHANNEL_COLORS[channelRoute.rightIndex]
  const primaryColor = CHANNEL_COLORS[primaryIndex]
  const sideHeatItems = [
    { id: 'left' as const, label: `Left ${region.shortLabel}`, value: values.left },
    { id: 'right' as const, label: `Right ${region.shortLabel}`, value: values.right },
  ].filter((item) => sideMode === 'bilateral' || sideMode === item.id)
  const activationSpread = Math.abs(values.left - values.right)
  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        sideMode === 'bilateral'
          ? values.symmetry * 0.55 + Math.max(values.left, values.right) * 0.3 + (isMonitoring ? 15 : 6)
          : activation * 0.72 + (isMonitoring ? 22 : 10)
      )
    )
  )
  const driftLabel =
    sideMode !== 'bilateral'
      ? 'Single-side capture'
      : activationSpread <= 10
        ? 'Tight left/right match'
        : activationSpread <= 25
          ? 'Moderate drift'
          : 'High imbalance drift'
  const captureState = isMonitoring ? 'Tracking' : sessionTime > 0 ? 'Frozen' : 'Ready'
  const graphRate = estimateHistoryRateHz(history)
  const inputRate = dataSource === 'device' || dataSource === 'relay'
    ? deviceDiagnostics.inputHz
    : graphRate || (isMonitoring ? 20 : 0)
  const rateLabel = inputRate > 0 ? `${Math.round(inputRate)} Hz` : 'Hold'
  const lastFrameAge =
    deviceDiagnostics.lastFrameAt === null ? null : Math.max(0, Date.now() - deviceDiagnostics.lastFrameAt)
  const sourceLabel =
    dataSource === 'simulated'
      ? 'Browser SIM'
      : deviceDiagnostics.lastFrameSource === 'firmware-sim'
        ? 'Firmware SIM'
        : deviceDiagnostics.lastFrameSource === 'ads'
          ? 'ADS live'
          : 'Waiting'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5 px-4 pt-6 pb-8"
    >
      <header className="pr-14">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mp-sky)' }}>
          Live instrumentation
        </p>
        <h1 className="text-[38px] font-black leading-none tracking-[-0.04em]" style={{ color: 'var(--mp-t1)' }}>
          Signal lab
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--mp-t3)' }}>
          Inspect the left/right electrode arrays for {region.label.toLowerCase()} with one-sided or bilateral traces.
        </p>
      </header>

      <section
        className="rounded-[26px] p-4"
        style={{
          background:
            'radial-gradient(circle at 82% 18%, ' + phase.glow + ', transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))',
          border: '1px solid var(--mp-line2)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Focus
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]" style={{ color: 'var(--mp-t1)' }}>
              {region.label}
            </h2>
          </div>
          <div className="rounded-full px-3 py-2" style={{ background: phase.glow, color: phase.color }}>
            <span className="font-mono text-xs font-black">{Math.round(activation)}%</span>
          </div>
        </div>

        <div className="mt-4">
          <MuscleModel
            selectedGroup={activeGroup}
            activation={activation}
            sideActivations={{ left: values.left, right: values.right }}
            sideMode={sideMode}
            compact
          />
        </div>

        <div className={`mt-4 grid gap-3 ${sideHeatItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {sideHeatItems.map((item) => {
            const heat = getActivationPhase(item.value)
            return (
              <div key={item.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--mp-line)' }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                    {item.label}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: heat.color, boxShadow: `0 0 14px ${heat.glow}` }} />
                </div>
                <p className="font-mono text-2xl font-black tracking-[-0.04em]" style={{ color: heat.color }}>
                  {Math.round(item.value)}%
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {MUSCLE_REGIONS.map((item) => {
          const active = activeGroup === item.id
          return (
            <button
              key={item.id}
              disabled={!active}
              aria-disabled={!active}
              className="rounded-2xl px-3 py-3 text-left text-sm font-bold"
              style={{
                background: active ? 'rgba(45,212,191,0.13)' : 'var(--mp-s1)',
                border: '1px solid var(--mp-line2)',
                color: active ? '#2DD4BF' : 'var(--mp-t4)',
                opacity: active ? 1 : 0.42,
                cursor: active ? 'default' : 'not-allowed',
              }}
            >
              <span className="block">{item.label}</span>
              <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: active ? '#2DD4BF' : 'var(--mp-t4)' }}>
                {active ? 'selected' : 'locked'}
              </span>
            </button>
          )
        })}
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-2xl p-2" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        {SIDE_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setSideMode(mode.id)}
            className="h-10 rounded-xl text-xs font-bold"
            style={{
              background: sideMode === mode.id ? 'rgba(252,101,88,0.13)' : 'transparent',
              color: sideMode === mode.id ? 'var(--mp-coral)' : 'var(--mp-t3)',
            }}
          >
            {mode.label}
          </button>
        ))}
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Electrode layout
            </p>
            <h3 className="mt-1 text-lg font-black tracking-[-0.03em]" style={{ color: 'var(--mp-t1)' }}>
              6-electrode left/right array
            </h3>
          </div>
          <span className="rounded-full px-3 py-2 font-mono text-[10px] font-black" style={{ color: symmetryColor(values.symmetry), background: 'rgba(255,255,255,0.045)', border: '1px solid var(--mp-line)' }}>
            {sideMode === 'bilateral' ? `${Math.round(values.symmetry)} sym` : 'single side'}
          </span>
        </div>
        <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          Three electrodes are assigned to the left side and three to the right. MyoPack compares those two arrays for the selected {region.label.toLowerCase()} evaluation.
        </p>
        <div className={`mt-4 grid gap-3 ${sideHeatItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {sideHeatItems.map((item) => {
            const heat = getActivationPhase(item.value)
            return (
              <div key={item.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                    {item.id === 'left' ? 'Left array' : 'Right array'}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: heat.color, boxShadow: `0 0 14px ${heat.glow}` }} />
                </div>
                <p className="font-mono text-2xl font-black tracking-[-0.04em]" style={{ color: heat.color }}>
                  {Math.round(item.value)}%
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <LiveMuscleGraph
        history={history}
        title={`${region.label} ${sideMode === 'bilateral' ? 'bilateral trace' : `${sideMode} trace`}`}
        leftLabel={sideMode === 'bilateral' ? `Left ${region.shortLabel}` : `${sideMode === 'right' ? 'Right' : 'Left'} ${region.shortLabel}`}
        rightLabel={sideMode === 'bilateral' ? `Right ${region.shortLabel}` : undefined}
        leftColor={sideMode === 'bilateral' ? leftColor : primaryColor}
        rightColor={sideMode === 'bilateral' ? rightColor : undefined}
        leftIndex={sideMode === 'bilateral' ? channelRoute.leftIndex : primaryIndex}
        rightIndex={sideMode === 'bilateral' ? channelRoute.rightIndex : undefined}
        rateLabel={rateLabel}
      />

      <section className="grid grid-cols-2 gap-3">
        <MetricTile label="Session" value={sessionTime > 0 ? formatTime(sessionTime) : '--:--'} color={isMonitoring ? 'var(--mp-sky)' : 'var(--mp-t4)'} />
        <MetricTile label="Symmetry" value={sideMode === 'bilateral' ? `${Math.round(values.symmetry)}%` : 'Single'} color={sideMode === 'bilateral' ? phase.color : 'var(--mp-t3)'} />
        <MetricTile label="Cadence" value={isMonitoring ? rateLabel.replace(' ', '') : 'Hold'} color="var(--mp-coral)" />
        <MetricTile label="Source" value={dataSource === 'relay' ? 'RELAY' : dataSource === 'device' ? 'WS' : 'SIM'} color={dataSource === 'simulated' ? 'var(--mp-sky)' : 'var(--mp-jade)'} />
      </section>

      <section
        className="rounded-[26px] p-4"
        style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Software diagnostics
            </p>
            <h3 className="mt-1 text-lg font-black tracking-[-0.03em]" style={{ color: 'var(--mp-t1)' }}>
              Signal path check
            </h3>
          </div>
          <span className="rounded-full px-3 py-2 font-mono text-[10px] font-black" style={{ color: dataSource === 'simulated' ? 'var(--mp-sky)' : 'var(--mp-jade)', background: 'rgba(255,255,255,0.045)', border: '1px solid var(--mp-line)' }}>
            {dataSource === 'relay' ? 'relay' : dataSource === 'device' ? 'device' : 'sim'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Input rate', value: inputRate > 0 ? `${inputRate.toFixed(1)} Hz` : '--' },
            { label: 'Graph buffer', value: graphRate > 0 ? `${graphRate.toFixed(1)} Hz` : '--' },
            { label: 'Dropped', value: `${deviceDiagnostics.droppedFrames}` },
            { label: 'Parse errors', value: `${deviceDiagnostics.parseErrors + deviceDiagnostics.invalidFrames}` },
            { label: 'Route', value: `L${channelRoute.leftIndex} / R${channelRoute.rightIndex}` },
            { label: 'Frame age', value: lastFrameAge === null ? '--' : `${Math.round(lastFrameAge)} ms` },
            { label: 'Frame source', value: sourceLabel },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl p-3" style={{ background: 'rgba(0,0,0,0.14)', border: '1px solid var(--mp-line)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                {item.label}
              </p>
              <p className="mt-2 font-mono text-sm font-black" style={{ color: 'var(--mp-t2)' }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-5" style={{ color: 'var(--mp-t4)' }}>
          Acquisition remains firmware-owned; this panel checks transport health, routed channels, and graph-buffer cadence without changing the live signal.
        </p>
      </section>

      <section
        className="rounded-[26px] p-4"
        style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} style={{ color: 'var(--mp-jade)' }} />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Electrode readiness fingerprint
            </p>
          </div>
          <span className="rounded-full px-3 py-1.5 font-mono text-[10px] font-black" style={{ color: phase.color, background: phase.glow }}>
            {readinessScore}%
          </span>
        </div>
        <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          A selected-region snapshot that compares capture strength, left/right drift, and whether the live session is actively tracking or frozen.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>Capture state</p>
            <p className="mt-2 text-lg font-black" style={{ color: isMonitoring ? 'var(--mp-jade)' : 'var(--mp-t2)' }}>{captureState}</p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>Array drift</p>
            <p className="mt-2 text-lg font-black" style={{ color: sideMode === 'bilateral' ? symmetryColor(values.symmetry) : 'var(--mp-t2)' }}>
              {sideMode === 'bilateral' ? `${Math.round(activationSpread)}%` : 'Off'}
            </p>
          </div>
          <div className="col-span-2 rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-black" style={{ color: 'var(--mp-t1)' }}>{driftLabel}</p>
              <p className="font-mono text-xs font-bold" style={{ color: phase.color }}>{Math.round(activation)}% active</p>
            </div>
            <div className={`grid gap-3 ${sideHeatItems.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {sideHeatItems.map((item) => {
                const heat = getActivationPhase(item.value)
                return (
                  <div key={item.id} className="rounded-xl px-3 py-3" style={{ background: 'rgba(0,0,0,0.14)' }}>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                        {item.id} array
                      </span>
                      <span className="font-mono text-xs font-black" style={{ color: heat.color }}>{Math.round(item.value)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {['#EF4444', '#24D6A2', '#F2B84B'].map((dot, index) => (
                        <span
                          key={dot}
                          className="h-4 flex-1 rounded-full"
                          style={{
                            background: dot,
                            opacity: Math.max(0.18, item.value / 100 - index * 0.08),
                            boxShadow: `0 0 ${8 + item.value / 5}px ${dot}55`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="flex items-center gap-3 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)' }}>
        <Radio size={17} style={{ color: isMonitoring ? 'var(--mp-jade)' : 'var(--mp-t4)', flexShrink: 0 }} />
        <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          Graph updates only during an active monitoring session. Stopped sessions preserve the last valid trace.
        </p>
      </section>
    </motion.div>
  )
}
