'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, ChevronLeft } from 'lucide-react'
import { useEMG } from '@/lib/emg/context'
import { getBalanceStatus } from '@/lib/emg/calculations'
import { formatTime } from '@/lib/utils'
import { LiveMuscleGraph } from '@/components/dashboard/live-muscle-graph'
import { MuscleModel } from '@/components/dashboard/muscle-model'
import { SessionButton } from '@/components/dashboard/session-button'
import { ElectrodeReadinessCheck } from '@/components/dashboard/electrode-readiness-check'
import { useMuscleSelection } from '@/lib/muscle-selection-context'
import { analyzeElectrodeReadinessForRoute, recommendChannelRoute } from '@/lib/emg/readiness'
import { estimateHistoryRateHz } from '@/lib/emg/ingestion'
import {
  CHANNEL_COLORS,
  MUSCLE_REGIONS,
  SIDE_MODES,
  getActivationPhase,
  getMuscleRegion,
  getRouteValues,
  getSideActivation,
  type MuscleGroup,
} from '@/lib/muscle-selection'
import { PLACEMENT_GUIDES, getPlacementGuide } from '@/lib/placement-guides'
import { saveSessionRecord } from '@/lib/session-history'

const ELECTRODES = [
  {
    color: '#EF4444',
    label: 'Red',
    role: 'Active lead',
    detail: 'Place on the target muscle belly at the first active read point.',
  },
  {
    color: '#24D6A2',
    label: 'Green',
    role: 'Active lead',
    detail: 'Place near red along the muscle fibers to form the active EMG read pair.',
  },
  {
    color: '#F2B84B',
    label: 'Yellow',
    role: 'Reference / ground',
    detail: 'Place on a quiet bony or low-activity area away from the contracting muscle belly.',
  },
] as const

function PlacementDiagram({ group }: { group: MuscleGroup }) {
  const isUpper = group === 'biceps' || group === 'shoulders'
  const title = isUpper ? 'Close-up arm guide' : 'Close-up leg guide'
  const red = isUpper
    ? group === 'biceps' ? { x: 52, y: 92 } : { x: 45, y: 52 }
    : group === 'quads' ? { x: 50, y: 92 } : { x: 50, y: 110 }
  const green = isUpper
    ? group === 'biceps' ? { x: 52, y: 116 } : { x: 61, y: 66 }
    : group === 'quads' ? { x: 50, y: 120 } : { x: 50, y: 138 }
  const yellow = isUpper
    ? group === 'biceps' ? { x: 52, y: 174 } : { x: 104, y: 142 }
    : group === 'quads' ? { x: 50, y: 170 } : { x: 50, y: 178 }

  return (
    <div
      className="rounded-[26px] p-4"
      style={{
        background:
          'radial-gradient(circle at 32% 20%, rgba(252,101,88,0.14), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))',
        border: '1px solid var(--mp-line2)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          {title}
        </p>
        <span className="rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--mp-jade)', background: 'rgba(36,214,162,0.12)' }}>
          left + right
        </span>
      </div>

      <svg viewBox="0 0 160 220" role="img" aria-label={`${group} electrode placement diagram`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <linearGradient id="skinGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#E8D1BC" />
            <stop offset="100%" stopColor="#B8896C" />
          </linearGradient>
          <linearGradient id="muscleGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#FC6558" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#7A2F82" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {isUpper ? (
          <>
            <path d="M76 20 C105 24 124 44 126 72 C128 110 112 148 94 192 C88 206 67 203 68 187 C71 142 68 112 56 78 C48 54 52 31 76 20 Z" fill="url(#skinGrad)" opacity="0.95" />
            <path d="M61 78 C78 67 101 74 106 98 C112 126 96 154 84 175 C74 152 72 126 61 78 Z" fill="url(#muscleGrad)" opacity={group === 'biceps' ? 0.98 : 0.42} />
            <path d="M44 42 C63 20 100 18 123 42 C118 65 104 77 82 78 C60 78 48 64 44 42 Z" fill="url(#muscleGrad)" opacity={group === 'shoulders' ? 0.98 : 0.35} />
            <path d="M78 178 C91 181 98 190 96 202 C91 210 72 210 67 201 C65 190 68 181 78 178 Z" fill="#DAB89C" opacity="0.85" />
          </>
        ) : (
          <>
            <path d="M65 14 C93 12 111 32 108 66 C105 104 102 143 112 194 C101 210 66 210 55 194 C64 148 53 102 51 66 C49 34 42 18 65 14 Z" fill="url(#skinGrad)" opacity="0.95" />
            <path d="M61 58 C82 43 100 55 101 91 C102 127 94 153 84 180 C71 148 61 107 61 58 Z" fill="url(#muscleGrad)" opacity={group === 'quads' ? 0.95 : 0.38} />
            <path d="M60 64 C80 78 99 84 102 120 C104 149 96 172 84 191 C71 160 62 123 60 64 Z" fill="url(#muscleGrad)" opacity={group === 'hamstrings' ? 0.95 : 0.38} />
          </>
        )}

        {[
          { ...red, color: '#EF4444', label: 'R' },
          { ...green, color: '#24D6A2', label: 'G' },
          { ...yellow, color: '#F2B84B', label: 'Y' },
        ].map((dot) => (
          <g key={dot.label}>
            <circle cx={dot.x} cy={dot.y} r="13" fill={dot.color} opacity="0.18" />
            <circle cx={dot.x} cy={dot.y} r="7" fill={dot.color} />
            <text x={dot.x} y={dot.y + 3.5} textAnchor="middle" fontSize="8" fontWeight="900" fill="#071014">
              {dot.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function PlacementReference({ group }: { group: MuscleGroup }) {
  const region = getMuscleRegion(group)
  const guide = getPlacementGuide(group) ?? getPlacementGuide('quads')

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
        Placement reference
      </p>
      <div
        className="mt-4 rounded-2xl p-3"
        style={{
          background: 'rgba(36,214,162,0.10)',
          border: '1px solid rgba(36,214,162,0.28)',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-black" style={{ color: 'var(--mp-jade)' }}>
            {region.label}
          </h3>
          <span className="rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--mp-jade)', background: 'rgba(36,214,162,0.12)' }}>
            selected
          </span>
        </div>
        <p className="text-xs leading-5" style={{ color: 'var(--mp-t2)' }}>
          {guide.activeSite}
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          {guide.orientation}
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          Ref: {guide.referenceSite}
        </p>
      </div>
    </section>
  )
}

function statusCopy(status: 'optimal' | 'caution' | 'alert') {
  if (status === 'optimal') return 'Balanced activation'
  if (status === 'caution') return 'Mild asymmetry'
  return 'Needs attention'
}

export default function TodayPage() {
  const sessionStartedAtRef = useRef<string | null>(null)
  const {
    emgData,
    displayEmgData,
    isMonitoring,
    isPrechecking,
    sessionTime,
    toggleMonitoring,
    history,
    displayHistory,
    precheckSamples,
    startPrecheck,
    stopPrecheck,
    resetPrecheck,
    dataSource,
    deviceState,
    deviceDiagnostics,
  } = useEMG()
  const {
    selectedGroup,
    sideMode,
    sensorPair,
    channelRoute,
    hasSelection,
    placementConfirmed,
    selectGroup,
    confirmPlacement,
    setSideMode,
    setChannelRoute,
    resetSelection,
  } = useMuscleSelection()

  const region = getMuscleRegion(selectedGroup ?? 'quads')
  const placementGuide = PLACEMENT_GUIDES[region.id] ?? PLACEMENT_GUIDES.quads
  const rawValues = getRouteValues(emgData, channelRoute)
  const values = getRouteValues(displayEmgData, channelRoute)
  const activation = getSideActivation(values, sideMode)
  const rawActivation = getSideActivation(rawValues, sideMode)
  const phase = getActivationPhase(activation)
  const status = getBalanceStatus(sideMode === 'bilateral' ? values.symmetry : activation)
  const readiness = analyzeElectrodeReadinessForRoute(precheckSamples, channelRoute, sideMode)
  const recommendedRoute = recommendChannelRoute(precheckSamples, channelRoute, sideMode)
  const liveSource = dataSource === 'device' || dataSource === 'relay'
  const hasRecentTelemetry =
    deviceDiagnostics.lastFrameAt !== null &&
    Date.now() - deviceDiagnostics.lastFrameAt < 2500
  const trustedFrameSource =
    dataSource === 'relay'
      ? deviceDiagnostics.lastFrameSource === 'ads'
      : deviceDiagnostics.lastFrameSource !== 'firmware-sim'
  const liveTelemetryReady =
    liveSource &&
    deviceState === 'connected' &&
    hasRecentTelemetry &&
    trustedFrameSource &&
    deviceDiagnostics.inputHz >= 5
  const canStartSession = liveTelemetryReady && (readiness.state === 'ready' || readiness.state === 'caution')
  const graphRate = estimateHistoryRateHz(history)
  const rateLabel = dataSource === 'device' || dataSource === 'relay'
    ? `${Math.round(deviceDiagnostics.inputHz || deviceDiagnostics.expectedStreamHz || 0)} Hz`
    : `${Math.round(graphRate || 20)} Hz`

  useEffect(() => {
    if (isMonitoring) return
    if (
      recommendedRoute.leftIndex !== channelRoute.leftIndex ||
      recommendedRoute.rightIndex !== channelRoute.rightIndex
    ) {
      setChannelRoute(recommendedRoute)
    }
  }, [channelRoute.leftIndex, channelRoute.rightIndex, isMonitoring, recommendedRoute, setChannelRoute])

  const leftIndex = channelRoute.leftIndex
  const rightIndex = channelRoute.rightIndex
  const primaryIndex = sideMode === 'right' ? rightIndex : leftIndex
  const leftColor = CHANNEL_COLORS[leftIndex]
  const rightColor = CHANNEL_COLORS[rightIndex]
  const primaryColor = CHANNEL_COLORS[primaryIndex]
  const primaryLabel =
    sideMode === 'right'
      ? `Right ${region.shortLabel}`
      : sideMode === 'left'
        ? `Left ${region.shortLabel}`
        : `Left ${region.shortLabel}`

  const handleSessionToggle = () => {
    if (!isMonitoring && !canStartSession) return
    if (isMonitoring && sessionTime > 0 && selectedGroup) {
      saveSessionRecord({
        startedAt: sessionStartedAtRef.current ?? new Date(Date.now() - sessionTime * 1000).toISOString(),
        muscleGroup: selectedGroup,
        sideMode,
        sensorPair,
        channelRoute,
        durationSeconds: sessionTime,
        activation: rawActivation,
        symmetry: sideMode === 'bilateral' ? rawValues.symmetry : null,
        leftActivation: sideMode === 'right' ? 0 : rawValues.left,
        rightActivation: sideMode === 'left' ? 0 : rawValues.right,
        dataSource,
        inputHz: dataSource === 'device' || dataSource === 'relay' ? deviceDiagnostics.inputHz : graphRate,
        droppedFrames: dataSource === 'device' || dataSource === 'relay' ? deviceDiagnostics.droppedFrames : 0,
        parseErrors: dataSource === 'device' || dataSource === 'relay' ? deviceDiagnostics.parseErrors : 0,
        precheckScore: readiness.score,
      })
      sessionStartedAtRef.current = null
    } else if (!isMonitoring) {
      sessionStartedAtRef.current = new Date().toISOString()
    }
    toggleMonitoring()
  }

  const handleSelectGroup = (group: MuscleGroup) => {
    resetPrecheck()
    selectGroup(group)
  }

  return (
    <div className="px-4 pt-5" style={{ minHeight: '100%' }}>
      <AnimatePresence mode="wait">
        {!hasSelection ? (
          <motion.section
            key="selector"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-5 pb-8"
          >
            <div className="pr-16">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--mp-t2)' }}>
                MyoPack
              </p>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mp-coral)' }}>
                Muscle evaluation
              </p>
              <h1 className="text-[38px] font-black leading-[0.96] tracking-[-0.04em]" style={{ color: 'var(--mp-t1)' }}>
                Choose the region to monitor.
              </h1>
              <p className="mt-3 text-sm leading-6" style={{ color: 'var(--mp-t3)' }}>
                Place the sensors on the target muscle group, rotate the model, then tap a highlighted region to begin.
              </p>
            </div>

            <div className="relative">
              <MuscleModel
                selectedGroup={selectedGroup}
                activation={activation}
                interactive
                onSelect={handleSelectGroup}
              />
              <div
                className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(8,10,13,0.72)',
                  border: '1px solid var(--mp-line2)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t3)' }}>
                  Rotate + select
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--mp-t2)' }}>
                  Full body
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {MUSCLE_REGIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectGroup(item.id)}
                  className="text-left"
                  style={{
                    minHeight: 104,
                    borderRadius: 18,
                    padding: 16,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.025))',
                    border: '1px solid var(--mp-line2)',
                    color: 'var(--mp-t1)',
                  }}
                >
                  <span className="block text-lg font-extrabold tracking-[-0.02em]">{item.label}</span>
                <span className="mt-2 block text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                  {item.description}
                </span>
                </button>
              ))}
            </div>
          </motion.section>
        ) : !placementConfirmed ? (
          <motion.section
            key="placement"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4 pb-8"
          >
            <div className="flex items-center justify-between gap-3 pr-14">
              <button
                onClick={resetSelection}
                aria-label="Choose a different muscle group"
                className="grid h-10 w-10 place-items-center"
                style={{
                  borderRadius: 14,
                  background: 'var(--mp-s1)',
                  border: '1px solid var(--mp-line2)',
                  color: 'var(--mp-t2)',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mp-coral)' }}>
                  Electrode placement
                </p>
                <h1 className="mt-1 text-3xl font-black leading-none tracking-[-0.04em]" style={{ color: 'var(--mp-t1)' }}>
                  Set up {region.label}.
                </h1>
              </div>
            </div>

            <section
              className="rounded-[28px] p-4"
              style={{
                background:
                  'radial-gradient(circle at 50% 10%, rgba(252,101,88,0.16), transparent 44%), linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))',
                border: '1px solid var(--mp-line2)',
                boxShadow: '0 22px 70px rgba(0,0,0,0.36)',
              }}
            >
              <MuscleModel
                selectedGroup={selectedGroup}
                activation={activation}
                sideActivations={{ left: values.left, right: values.right }}
                sideMode="bilateral"
                showElectrodes
              />
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--mp-t2)' }}>
                {placementGuide.cue} Repeat the same red, green, and yellow order on the left and right sides so the app can compare contraction symmetry cleanly.
              </p>
              <div className="mt-4 grid gap-2">
                <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                  {placementGuide.activeSite}
                </p>
                <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                  {placementGuide.referenceSite}
                </p>
                <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                  {placementGuide.orientation}
                </p>
              </div>
            </section>

            <PlacementDiagram group={region.id} />

            <PlacementReference group={region.id} />

            <section className="grid gap-3">
              {ELECTRODES.map((electrode) => (
                <div
                  key={electrode.label}
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}
                >
                  <span
                    className="mt-0.5 h-4 w-4 rounded-full"
                    style={{ background: electrode.color, boxShadow: `0 0 18px ${electrode.color}66`, flexShrink: 0 }}
                  />
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--mp-t1)' }}>
                      {electrode.label} · {electrode.role}
                    </p>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                      {electrode.detail}
                    </p>
                  </div>
                </div>
              ))}
            </section>

            <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                Placement check
              </p>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                Use clean skin contact, keep the colored order consistent on both sides, and avoid placing electrodes directly over joints or bony areas.
              </p>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                Quick verification: {placementGuide.test}
              </p>
            </section>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={confirmPlacement}
                className="h-14 rounded-2xl text-sm font-black uppercase tracking-[0.12em]"
                style={{
                  background: 'rgba(36,214,162,0.15)',
                  border: '1px solid rgba(36,214,162,0.38)',
                  color: 'var(--mp-jade)',
                }}
              >
                Ready to continue
              </button>
              <button
                onClick={confirmPlacement}
                className="h-12 rounded-2xl text-xs font-bold uppercase tracking-[0.12em]"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--mp-line2)',
                  color: 'var(--mp-t3)',
                }}
              >
                Already placed · Begin
              </button>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="evaluation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4 pb-8"
          >
            <div className="flex items-center justify-between gap-3 pr-14">
              <button
                onClick={resetSelection}
                aria-label="Choose a different muscle group"
                className="grid h-10 w-10 place-items-center"
                style={{
                  borderRadius: 14,
                  background: 'var(--mp-s1)',
                  border: '1px solid var(--mp-line2)',
                  color: 'var(--mp-t2)',
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: isMonitoring ? 'var(--mp-jade)' : 'var(--mp-t4)' }}>
                  {isMonitoring ? 'Live evaluation' : sessionTime > 0 ? 'Frozen at stop' : 'Ready to evaluate'}
                </p>
                <h1 className="mt-1 text-3xl font-black leading-none tracking-[-0.04em]" style={{ color: 'var(--mp-t1)' }}>
                  {region.label}
                </h1>
              </div>
            </div>

            <div
              style={{
                borderRadius: 28,
                padding: 18,
                background:
                  'radial-gradient(circle at 50% 10%, ' + phase.glow + ', transparent 45%), linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))',
                border: '1px solid var(--mp-line2)',
                boxShadow: '0 22px 70px rgba(0,0,0,0.38)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                    Activation
                  </p>
                  <div className="mt-2 flex items-end gap-2">
                    <span
                      className="font-mono text-[68px] font-black leading-[0.86] tracking-[-0.06em]"
                      style={{ color: phase.color }}
                    >
                      {Math.round(activation)}
                    </span>
                    <span className="pb-1 text-2xl font-black" style={{ color: phase.color }}>
                      %
                    </span>
                  </div>
                  <p
                    className="mt-3 text-sm font-semibold"
                    style={{ color: 'var(--mp-t2)', minHeight: 44, lineHeight: '22px', maxWidth: 210 }}
                  >
                    {sideMode === 'bilateral' ? `${Math.round(values.symmetry)}% symmetry · ${statusCopy(status)}` : `${phase.label} single-side contraction`}
                  </p>
                </div>

                <div className="text-right">
                  <div
                    className="inline-flex items-center gap-2 rounded-full px-3 py-2"
                    style={{
                      background: isMonitoring ? 'rgba(31,216,164,0.12)' : 'rgba(255,255,255,0.055)',
                      color: isMonitoring ? 'var(--mp-jade)' : 'var(--mp-t3)',
                      border: '1px solid var(--mp-line2)',
                    }}
                  >
                    <span
                      className={isMonitoring ? 'live-dot block h-1.5 w-1.5 rounded-full' : 'block h-1.5 w-1.5 rounded-full'}
                      style={{ background: 'currentColor' }}
                    />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em]">
                      {isMonitoring ? 'Live' : 'Still'}
                    </span>
                  </div>
                  <p className="mt-3 font-mono text-lg font-bold" style={{ color: isMonitoring ? 'var(--mp-sky)' : 'var(--mp-t4)' }}>
                    {sessionTime > 0 ? formatTime(sessionTime) : '--:--'}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <MuscleModel
                  selectedGroup={selectedGroup}
                  activation={activation}
                  sideActivations={{ left: values.left, right: values.right }}
                  sideMode={sideMode}
                  compact
                />
              </div>
            </div>

            <div
              className="grid grid-cols-3 gap-2"
              style={{
                borderRadius: 18,
                padding: 6,
                background: 'var(--mp-s1)',
                border: '1px solid var(--mp-line2)',
              }}
            >
              {SIDE_MODES.map((mode) => {
                const active = sideMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => setSideMode(mode.id)}
                    className="h-10 rounded-xl text-xs font-bold"
                    style={{
                      background: active ? 'rgba(45,212,191,0.14)' : 'transparent',
                      color: active ? '#2DD4BF' : 'var(--mp-t3)',
                    }}
                  >
                    {mode.label}
                  </button>
                )
              })}
            </div>

            <LiveMuscleGraph
              history={displayHistory}
              title={`${region.label} ${sideMode === 'bilateral' ? 'bilateral' : sideMode}`}
              leftLabel={sideMode === 'bilateral' ? `Left ${region.shortLabel}` : primaryLabel}
              rightLabel={sideMode === 'bilateral' ? `Right ${region.shortLabel}` : undefined}
              leftColor={sideMode === 'bilateral' ? leftColor : primaryColor}
              rightColor={sideMode === 'bilateral' ? rightColor : undefined}
              leftIndex={sideMode === 'bilateral' ? leftIndex : primaryIndex}
              rightIndex={sideMode === 'bilateral' ? rightIndex : undefined}
              rateLabel={rateLabel}
            />

            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                  Electrode array
                </p>
                <p className="mt-2 text-sm font-bold" style={{ color: 'var(--mp-t1)' }}>
                  {sideMode === 'bilateral'
                    ? `3 left + 3 right`
                    : `${sideMode === 'right' ? 'Right' : 'Left'} array only`}
                </p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                  Phase
                </p>
                <p className="mt-2 text-sm font-bold" style={{ color: phase.color }}>
                  {phase.label}
                </p>
              </div>
            </div>

            <ElectrodeReadinessCheck
              samples={precheckSamples}
              isChecking={isPrechecking}
              sensorPair={sensorPair}
              channelRoute={channelRoute}
              sideMode={sideMode}
              muscleLabel={region.label}
              onStart={startPrecheck}
              onStop={stopPrecheck}
              onReset={resetPrecheck}
            />

            <SessionButton
              isMonitoring={isMonitoring}
              onToggle={handleSessionToggle}
              disabled={!canStartSession}
              idleLabel={canStartSession ? 'Begin Session' : liveTelemetryReady ? 'Pass Electrode Check' : 'Connect Live Board'}
            />

            <div className="flex items-center gap-2 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <Activity size={17} style={{ color: phase.color, flexShrink: 0 }} />
              <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                MyoPack is designed to reveal small contraction imbalances over time, helping rehab teams compare activation patterns across repeated attempts.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
