'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { BrainCircuit, CalendarDays, Clock3, Sparkles, Target, TrendingUp } from 'lucide-react'
import { useEMG } from '@/lib/emg/context'
import { useMuscleSelection } from '@/lib/muscle-selection-context'
import {
  getActivationPhase,
  getMuscleRegion,
  getRouteValues,
  getSideActivation,
} from '@/lib/muscle-selection'
import {
  averageScore,
  loadSessionRecords,
  recordsForGroup,
  trendDelta,
  type SessionRecord,
} from '@/lib/session-history'
import { analyzeRecoveryLogs, type ImbalanceSeverity, type RecoveryRisk } from '@/lib/recovery-intelligence'

function scoreColor(score: number) {
  if (score >= 85) return 'var(--mp-jade)'
  if (score >= 70) return 'var(--mp-amber)'
  return 'var(--mp-rose)'
}

function ProgressLine({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-bold" style={{ color: 'var(--mp-t2)' }}>
          {label}
        </span>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {value}/{target}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

function formatRecordDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function severityColor(severity: ImbalanceSeverity, risk: RecoveryRisk) {
  if (severity === 'insufficient' || risk === 'unknown') return 'var(--mp-t4)'
  if (risk === 'elevated' || severity === 'high') return 'var(--mp-rose)'
  if (risk === 'watch' || severity === 'moderate') return 'var(--mp-amber)'
  return 'var(--mp-jade)'
}

function severitySurface(severity: ImbalanceSeverity, risk: RecoveryRisk) {
  if (severity === 'insufficient' || risk === 'unknown') return 'rgba(255,255,255,0.045)'
  if (risk === 'elevated' || severity === 'high') return 'rgba(248,113,113,0.12)'
  if (risk === 'watch' || severity === 'moderate') return 'rgba(242,184,75,0.12)'
  return 'rgba(36,214,162,0.12)'
}

export default function HealthPage() {
  const { emgData } = useEMG()
  const { selectedGroup, sideMode, channelRoute } = useMuscleSelection()
  const [records, setRecords] = useState<SessionRecord[]>([])
  const region = getMuscleRegion(selectedGroup ?? 'quads')
  const values = getRouteValues(emgData, channelRoute)
  const activation = getSideActivation(values, sideMode)
  const phase = getActivationPhase(activation)
  const progressScore = sideMode === 'bilateral' ? values.symmetry : activation
  const regionRecords = useMemo(
    () => recordsForGroup(records, region.id).slice(-8),
    [records, region.id]
  )
  const avgRegionScore = averageScore(regionRecords)
  const regionDelta = trendDelta(regionRecords)
  const recoveryInsight = useMemo(
    () => analyzeRecoveryLogs(regionRecords, region),
    [region, regionRecords]
  )
  const insightColor = severityColor(recoveryInsight.severity, recoveryInsight.risk)
  const insightSurface = severitySurface(recoveryInsight.severity, recoveryInsight.risk)

  useEffect(() => {
    setRecords(loadSessionRecords())
    const onStorage = () => setRecords(loadSessionRecords())
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onStorage)
    }
  }, [])

  const week = regionRecords.length > 0
    ? regionRecords.slice(-7).map((record) => ({
        day: formatRecordDate(record.timestamp),
        score: Math.round(record.symmetry ?? record.activation),
      }))
    : [
        { day: 'M', score: null as number | null },
        { day: 'T', score: null as number | null },
        { day: 'W', score: null as number | null },
        { day: 'T', score: null as number | null },
        { day: 'F', score: null as number | null },
        { day: 'S', score: Math.round(progressScore) },
        { day: 'S', score: null as number | null },
      ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-5 px-4 pt-6 pb-8"
    >
      <header className="pr-14">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--mp-jade)' }}>
          Rehabilitation progress
        </p>
        <h1 className="text-[38px] font-black leading-none tracking-[-0.04em]" style={{ color: 'var(--mp-t1)' }}>
          Health
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: 'var(--mp-t3)' }}>
          Longitudinal context for {region.label.toLowerCase()} using the current sensor assignment and local session history.
        </p>
      </header>

      <section
        className="rounded-[28px] p-5"
        style={{
          background:
            'radial-gradient(circle at 80% 16%, ' + phase.glow + ', transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))',
          border: '1px solid var(--mp-line2)',
          boxShadow: '0 22px 70px rgba(0,0,0,0.36)',
        }}
      >
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
              Current focus
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]" style={{ color: 'var(--mp-t1)' }}>
              {region.label}
            </h2>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--mp-t3)' }}>
              {sideMode === 'bilateral' ? `${Math.round(values.symmetry)}% bilateral control` : `${Math.round(activation)}% ${sideMode} activation`} through the selected left/right electrode array for {region.shortLabel.toLowerCase()}.
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-[56px] font-black leading-none tracking-[-0.06em]" style={{ color: scoreColor(progressScore) }}>
              {Math.round(progressScore)}
            </span>
            <span className="text-xl font-black" style={{ color: scoreColor(progressScore) }}>
              %
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={16} style={{ color: 'var(--mp-t4)' }} />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Saved run trend
          </p>
        </div>
        <div className="flex items-end justify-between gap-2">
          {week.map((item, index) => (
            <div key={`${item.day}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="flex w-full items-end justify-center rounded-xl"
                style={{
                  height: 92,
                  background: 'rgba(255,255,255,0.035)',
                  border: '1px solid var(--mp-line)',
                  padding: 6,
                }}
              >
                {item.score === null ? (
                  <div className="h-8 w-full rounded-lg border border-dashed" style={{ borderColor: 'var(--mp-line2)' }} />
                ) : (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(18, item.score)}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full rounded-lg"
                    style={{ background: scoreColor(item.score) }}
                  />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--mp-t4)' }}>
                {item.day}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Runs', value: `${regionRecords.length}`, icon: CalendarDays, color: 'var(--mp-sky)' },
          { label: 'Average', value: avgRegionScore === null ? '--' : `${Math.round(avgRegionScore)}`, icon: Target, color: 'var(--mp-jade)' },
          { label: 'Trend', value: regionDelta === null ? '--' : `${regionDelta >= 0 ? '+' : ''}${Math.round(regionDelta)}`, icon: TrendingUp, color: 'var(--mp-coral)' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-2xl p-4"
              style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}
            >
              <Icon size={16} style={{ color: item.color }} />
              <p className="mt-4 font-mono text-2xl font-black tracking-[-0.04em]" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                {item.label}
              </p>
            </div>
          )
        })}
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <BrainCircuit size={16} style={{ color: insightColor }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                Recovery coach
              </p>
            </div>
            <h3 className="text-xl font-black tracking-[-0.03em]" style={{ color: insightColor }}>
              {recoveryInsight.headline}
            </h3>
          </div>
          <div className="rounded-full px-3 py-2" style={{ background: insightSurface, border: '1px solid var(--mp-line2)' }}>
            <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: insightColor }}>
              {recoveryInsight.risk}
            </span>
          </div>
        </div>
        <p className="text-sm leading-6" style={{ color: 'var(--mp-t2)' }}>
          {recoveryInsight.summary}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Imbalance', value: recoveryInsight.imbalancePercent === null ? '--' : `${recoveryInsight.imbalancePercent}%` },
            { label: 'Limited', value: recoveryInsight.likelyLimitedSide },
            { label: 'Confidence', value: recoveryInsight.confidence },
          ].map((item) => (
            <div key={item.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--mp-t4)' }}>
                {item.label}
              </p>
              <p className="mt-1 font-mono text-sm font-black capitalize" style={{ color: insightColor }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={16} style={{ color: 'var(--mp-sky)' }} />
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
                Recovery coach
              </p>
            </div>
            <h3 className="text-xl font-black tracking-[-0.03em]" style={{ color: 'var(--mp-t1)' }}>
              Local adaptive learning
            </h3>
          </div>
          <div className="rounded-full px-3 py-2" style={{ background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.24)' }}>
            <span className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: '#2DD4BF' }}>
              offline
            </span>
          </div>
        </div>

        <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          The coach learns from saved local runs only. As your history grows, it adapts time-to-sync estimates, correction priorities, and encouragement around your own trend without sending data anywhere else.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--mp-t4)' }}>
              Sync age
            </p>
            <p className="text-lg font-black" style={{ color: 'var(--mp-sky)' }}>
              {recoveryInsight.syncAgeLabel}
            </p>
            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--mp-t3)' }}>
              {recoveryInsight.syncAgeExplanation}
            </p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--mp-t4)' }}>
              Near-sync ETA
            </p>
            <p className="text-lg font-black" style={{ color: insightColor }}>
              {recoveryInsight.estimatedWeeksToSync === null
                ? '--'
                : recoveryInsight.estimatedWeeksToSync === 0
                  ? 'Now'
                  : `${recoveryInsight.estimatedWeeksToSync} wk`}
            </p>
            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--mp-t3)' }}>
              {recoveryInsight.projection}
            </p>
          </div>
          <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--mp-t4)' }}>
              Coach memory
            </p>
            <p className="text-lg font-black" style={{ color: 'var(--mp-jade)' }}>
              {regionRecords.length} runs
            </p>
            <p className="mt-2 text-[11px] leading-5" style={{ color: 'var(--mp-t3)' }}>
              More repeated sessions make the local advice more specific to your pattern.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <div className="mb-4 flex items-center gap-2">
          <Clock3 size={16} style={{ color: 'var(--mp-t4)' }} />
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
            What the coach is learning
          </p>
        </div>
        <div className="grid gap-2">
          {recoveryInsight.learningSignals.map((signal) => (
            <div key={signal} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <p className="text-xs leading-5" style={{ color: 'var(--mp-t2)' }}>
                {signal}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Adaptive plan
        </p>
        <div className="flex flex-col gap-3">
          {recoveryInsight.coachingPlan.map((item) => (
            <div key={item.title} className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <p className="text-sm font-black" style={{ color: 'var(--mp-t1)' }}>
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Corrective focus
        </p>
        <div className="flex flex-col gap-3">
          {recoveryInsight.recommendations.map((item) => (
            <div key={item} className="rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <p className="text-xs leading-5" style={{ color: 'var(--mp-t2)' }}>
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Correction queue
        </p>
        <div className="flex flex-col gap-3">
          {recoveryInsight.correctionQueue.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <Sparkles size={14} style={{ color: insightColor, flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs leading-5" style={{ color: 'var(--mp-t2)' }}>
                {item}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
          {recoveryInsight.encouragement}
        </p>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Next goals
        </p>
        <div className="flex flex-col gap-3">
          {recoveryInsight.goals.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl px-3 py-3" style={{ background: 'rgba(255,255,255,0.035)' }}>
              <Target size={14} style={{ color: insightColor, flexShrink: 0, marginTop: 2 }} />
              <p className="text-xs leading-5" style={{ color: 'var(--mp-t2)' }}>
                {item}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] leading-5" style={{ color: 'var(--mp-t4)' }}>
          {recoveryInsight.dataRequirement}
        </p>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'var(--mp-s1)', border: '1px solid var(--mp-line2)' }}>
        <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Rehab milestones
        </p>
        <div className="flex flex-col gap-5">
          <ProgressLine label={`${region.shortLabel} control`} value={Math.round(avgRegionScore ?? progressScore)} target={95} color={scoreColor(avgRegionScore ?? progressScore)} />
          <ProgressLine label="Saved run goal" value={Math.min(regionRecords.length, 12)} target={12} color="var(--mp-sky)" />
          <ProgressLine label="Consistency" value={Math.min(regionRecords.length, 6)} target={6} color="var(--mp-jade)" />
        </div>
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid var(--mp-line)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-t4)' }}>
          Recovery log
        </p>
        {regionRecords.length === 0 ? (
          <p className="text-xs leading-5" style={{ color: 'var(--mp-t3)' }}>
            No saved {region.label.toLowerCase()} runs yet. End a monitoring session on the Monitor page to create the first local record.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {regionRecords.slice().reverse().map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.035)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--mp-t2)' }}>
                  {formatRecordDate(record.timestamp)} · {record.sideMode}
                </span>
                <span className="font-mono text-xs font-bold" style={{ color: scoreColor(record.symmetry ?? record.activation) }}>
                  {Math.round(record.symmetry ?? record.activation)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl p-4" style={{ background: 'rgba(252,101,88,0.07)', border: '1px solid rgba(252,101,88,0.18)' }}>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--mp-coral)' }}>
          Disclaimer
        </p>
        <p className="text-[11px] leading-5" style={{ color: 'var(--mp-t3)' }}>
          MyoPack is a rehabilitation monitoring prototype, not a diagnostic device. It is intended to help surface small muscle-contraction imbalances over repeated sessions so recovery work can be tracked more consistently. The Recovery Coach is local rule-based guidance generated from saved session summaries in this browser. Sync Age is a motivational symmetry band, not a biological age estimate, and recommendations should not replace clinician guidance.
        </p>
      </section>
    </motion.div>
  )
}
