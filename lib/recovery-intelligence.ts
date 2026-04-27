'use client'

import type { MuscleRegion } from '@/lib/muscle-selection'
import type { SessionRecord } from '@/lib/session-history'
import { averageScore, trendDelta } from '@/lib/session-history'

export type ImbalanceSeverity = 'insufficient' | 'low' | 'moderate' | 'high'
export type RecoveryRisk = 'unknown' | 'low' | 'watch' | 'elevated'

export interface CoachCard {
  title: string
  detail: string
}

export interface RecoveryInsight {
  severity: ImbalanceSeverity
  risk: RecoveryRisk
  confidence: 'low' | 'developing' | 'usable'
  headline: string
  summary: string
  imbalancePercent: number | null
  likelyLimitedSide: 'left' | 'right' | 'unknown'
  trend: number | null
  recommendations: string[]
  goals: string[]
  dataRequirement: string
  syncScore: number | null
  syncAgeLabel: string
  syncAgeExplanation: string
  estimatedSessionsToSync: number | null
  estimatedWeeksToSync: number | null
  projection: string
  learningSignals: string[]
  coachingPlan: CoachCard[]
  correctionQueue: string[]
  encouragement: string
}

const MIN_SESSIONS = 3
const TARGET_SESSIONS = 6
const NEAR_SYNC_SCORE = 92
const SESSIONS_PER_WEEK = 3

export function analyzeRecoveryLogs(records: SessionRecord[], region: MuscleRegion): RecoveryInsight {
  const bilateral = records.filter((record) => record.symmetry !== null)
  const usableRecords = bilateral.length >= 2 ? bilateral : records
  const avg = averageScore(usableRecords)
  const delta = trendDelta(usableRecords)
  const limitedSide = inferLimitedSide(usableRecords)
  const stability = calculateStability(usableRecords)
  const latest = usableRecords[usableRecords.length - 1]
  const latestScore = latest ? latest.symmetry ?? latest.activation : null
  const syncScore = latestScore === null ? null : Math.round(latestScore)

  if (records.length < MIN_SESSIONS || avg === null || latestScore === null) {
    return {
      severity: 'insufficient',
      risk: 'unknown',
      confidence: 'low',
      headline: 'Recovery coach is learning your baseline',
      summary: `MyoPack needs at least ${MIN_SESSIONS} saved ${region.label.toLowerCase()} attempts before it can responsibly estimate imbalance severity, trend direction, and time to near-sync.`,
      imbalancePercent: null,
      likelyLimitedSide: 'unknown',
      trend: null,
      recommendations: [
        'Run the same placement and side mode for several attempts.',
        'Use controlled contractions instead of chasing a single high peak.',
        'Avoid comparing sessions with different sensor placement.',
      ],
      goals: [
        `Save ${MIN_SESSIONS - records.length} more ${region.shortLabel} run${MIN_SESSIONS - records.length === 1 ? '' : 's'}.`,
        'Keep each attempt long enough to settle into a repeatable contraction pattern.',
      ],
      dataRequirement: `${records.length}/${MIN_SESSIONS} minimum runs saved`,
      syncScore,
      syncAgeLabel: 'Baseline forming',
      syncAgeExplanation:
        'Sync Age is a motivational symmetry band, not biological age. It becomes meaningful after repeated saved sessions.',
      estimatedSessionsToSync: null,
      estimatedWeeksToSync: null,
      projection: 'More local run history is required before projecting a responsible time frame.',
      learningSignals: [
        `Saved ${records.length}/${MIN_SESSIONS} minimum runs`,
        'Waiting for repeatable left/right comparison data',
        'Placement consistency matters more than one high score',
      ],
      coachingPlan: [
        {
          title: 'Baseline protocol',
          detail: `Complete ${MIN_SESSIONS} calm ${region.shortLabel} attempts with the same electrode placement.`,
        },
        {
          title: 'Consistency rule',
          detail: 'Use the same side mode and similar effort level so the coach can compare like with like.',
        },
        {
          title: 'Early correction',
          detail: 'If one side feels delayed, start with a low-load contraction on that side before bilateral work.',
        },
      ],
      correctionQueue: [
        'Confirm red/green active leads are aligned with the muscle fibers.',
        'Keep the reference electrode away from the contracting muscle belly.',
        'Repeat the same contraction tempo for each saved run.',
      ],
      encouragement: 'You are teaching the coach what your normal pattern looks like. Clean repetitions matter most right now.',
    }
  }

  const imbalancePercent = Math.max(0, Math.round(100 - latestScore))
  const severity = severityFromImbalance(imbalancePercent)
  const risk = riskFrom(severity, delta, stability)
  const confidence = records.length >= TARGET_SESSIONS ? 'usable' : 'developing'
  const projection = estimateTimeToSync(latestScore, delta, stability, records.length)
  const syncAge = syncAgeFor(latestScore, avg, stability)
  const coachingPlan = buildCoachingPlan({
    region,
    severity,
    delta,
    limitedSide,
    stability,
    latestScore,
    count: records.length,
  })

  return {
    severity,
    risk,
    confidence,
    headline: headlineFor(severity, risk, delta),
    summary: summaryFor(region.label, imbalancePercent, avg, delta, limitedSide, stability),
    imbalancePercent,
    likelyLimitedSide: limitedSide,
    trend: delta,
    recommendations: recommendationsFor(severity, delta, limitedSide, stability),
    goals: goalsFor(region.shortLabel, imbalancePercent, records.length, projection.sessions),
    dataRequirement: `${records.length}/${TARGET_SESSIONS} runs toward stronger confidence`,
    syncScore: Math.round(latestScore),
    syncAgeLabel: syncAge.label,
    syncAgeExplanation: syncAge.explanation,
    estimatedSessionsToSync: projection.sessions,
    estimatedWeeksToSync: projection.weeks,
    projection: projection.copy,
    learningSignals: learningSignalsFor(records, avg, delta, limitedSide, stability),
    coachingPlan,
    correctionQueue: correctionQueueFor(severity, limitedSide, stability),
    encouragement: encouragementFor(delta, latestScore, records.length),
  }
}

function inferLimitedSide(records: SessionRecord[]): 'left' | 'right' | 'unknown' {
  const usable = records.filter(
    (record) =>
      typeof record.leftActivation === 'number' &&
      typeof record.rightActivation === 'number'
  )
  if (usable.length === 0) return 'unknown'
  const leftAvg =
    usable.reduce((sum, record) => sum + (record.leftActivation ?? 0), 0) / usable.length
  const rightAvg =
    usable.reduce((sum, record) => sum + (record.rightActivation ?? 0), 0) / usable.length
  if (Math.abs(leftAvg - rightAvg) < 5) return 'unknown'
  return leftAvg < rightAvg ? 'left' : 'right'
}

function scoreFor(record: SessionRecord): number {
  return record.symmetry ?? record.activation
}

function calculateStability(records: SessionRecord[]): number | null {
  if (records.length < 3) return null
  const scores = records.map(scoreFor)
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / scores.length
  const standardDeviation = Math.sqrt(variance)
  return Math.max(0, Math.min(100, Math.round(100 - standardDeviation * 3)))
}

function severityFromImbalance(imbalance: number): ImbalanceSeverity {
  if (imbalance >= 25) return 'high'
  if (imbalance >= 15) return 'moderate'
  return 'low'
}

function riskFrom(
  severity: ImbalanceSeverity,
  delta: number | null,
  stability: number | null
): RecoveryRisk {
  if (severity === 'high') return 'elevated'
  if (severity === 'moderate' || (delta !== null && delta <= -8) || (stability !== null && stability < 68)) {
    return 'watch'
  }
  return 'low'
}

function headlineFor(severity: ImbalanceSeverity, risk: RecoveryRisk, delta: number | null): string {
  if (risk === 'elevated') return 'Elevated imbalance signal'
  if (risk === 'watch') return delta !== null && delta < 0 ? 'Pattern needs a reset' : 'Watch this pattern'
  if (severity === 'low') return 'Controlled symmetry pattern'
  return 'Recovery pattern forming'
}

function summaryFor(
  regionLabel: string,
  imbalance: number,
  average: number,
  delta: number | null,
  limitedSide: 'left' | 'right' | 'unknown',
  stability: number | null
): string {
  const sideCopy =
    limitedSide === 'unknown'
      ? 'No consistent lower-output side is clear yet.'
      : `The ${limitedSide} side is trending lower across saved attempts.`
  const trendCopy =
    delta === null
      ? 'Trend direction is still forming.'
      : delta >= 5
        ? `Recent ${regionLabel.toLowerCase()} control is improving by about ${Math.round(delta)} points.`
        : delta <= -5
          ? `Recent ${regionLabel.toLowerCase()} control has dropped by about ${Math.abs(Math.round(delta))} points.`
          : `Recent ${regionLabel.toLowerCase()} control is mostly stable.`
  const stabilityCopy =
    stability === null
      ? 'Stability needs more runs.'
      : stability >= 82
        ? 'Output is becoming repeatable.'
        : 'Output is still variable between attempts.'

  return `${regionLabel} shows about a ${imbalance}% current imbalance signal with an average score of ${Math.round(average)}%. ${sideCopy} ${trendCopy} ${stabilityCopy}`
}

function estimateTimeToSync(
  latestScore: number,
  delta: number | null,
  stability: number | null,
  count: number
): { sessions: number | null; weeks: number | null; copy: string } {
  const gap = Math.max(0, NEAR_SYNC_SCORE - latestScore)
  if (gap === 0) {
    return {
      sessions: 0,
      weeks: 0,
      copy: 'Near-sync is already showing. The next goal is holding it across two or more saved sessions.',
    }
  }

  if (count < MIN_SESSIONS || delta === null) {
    return {
      sessions: null,
      weeks: null,
      copy: 'The coach needs more saved attempts before projecting a useful time frame.',
    }
  }

  const trendRate = Math.max(0.75, delta > 0 ? delta / Math.max(1, count - 1) : 0.75)
  const stabilityModifier = stability === null ? 1.35 : stability >= 82 ? 0.9 : stability >= 70 ? 1.15 : 1.45
  const sessions = Math.max(2, Math.ceil((gap / trendRate) * stabilityModifier))
  const weeks = Math.max(1, Math.ceil(sessions / SESSIONS_PER_WEEK))

  return {
    sessions,
    weeks,
    copy:
      delta <= 0
        ? `At the current pattern, expect roughly ${sessions} focused sessions before near-sync is realistic. Improving consistency can shorten that window.`
        : `Based on your local trend, near-sync could be realistic in about ${sessions} focused sessions, or roughly ${weeks} week${weeks === 1 ? '' : 's'} at three quality sessions per week.`,
  }
}

function syncAgeFor(
  latestScore: number,
  average: number,
  stability: number | null
): { label: string; explanation: string } {
  const blended = latestScore * 0.55 + average * 0.3 + (stability ?? 70) * 0.15

  if (blended >= 94) {
    return {
      label: 'Prime sync',
      explanation:
        'Your saved pattern is in the highest symmetry band. This is a motivational Sync Age marker, not a biological age estimate.',
    }
  }
  if (blended >= 86) {
    return {
      label: 'Athletic sync',
      explanation:
        'Your left/right pattern is moving like a well-coordinated system. Keep proving it across repeated sessions.',
    }
  }
  if (blended >= 74) {
    return {
      label: 'Rebuilding sync',
      explanation:
        'The system is improving but still needs steadier side-to-side timing and output.',
    }
  }
  if (blended >= 60) {
    return {
      label: 'Protected sync',
      explanation:
        'This band suggests controlled work is smarter than chasing intensity. Build repeatability first.',
    }
  }
  return {
    label: 'Foundational sync',
    explanation:
      'Start with low-load, repeatable contractions. The coach is looking for cleaner consistency before higher effort.',
  }
}

function learningSignalsFor(
  records: SessionRecord[],
  average: number,
  delta: number | null,
  limitedSide: 'left' | 'right' | 'unknown',
  stability: number | null
): string[] {
  return [
    `${records.length} saved local run${records.length === 1 ? '' : 's'} analyzed`,
    `Average control: ${Math.round(average)}%`,
    delta === null ? 'Trend: forming' : `Trend: ${delta >= 0 ? '+' : ''}${Math.round(delta)} points`,
    `Lower-output side: ${limitedSide}`,
    stability === null ? 'Stability: learning' : `Stability: ${stability}%`,
  ]
}

function recommendationsFor(
  severity: ImbalanceSeverity,
  delta: number | null,
  limitedSide: 'left' | 'right' | 'unknown',
  stability: number | null
): string[] {
  const side = limitedSide === 'unknown' ? 'the lower-output side' : `the ${limitedSide} side`

  if (severity === 'high') {
    return [
      `Reduce intensity and avoid adding load until the imbalance signal is below 15%.`,
      `Use short sets that let ${side} match the stronger side without compensation.`,
      'If pain, swelling, or sharp fatigue appears, stop and review the pattern with a clinician.',
    ]
  }

  if (severity === 'moderate') {
    return [
      `Add an extra warm-up set focused on ${side}.`,
      'Use controlled bilateral contractions and stop the set when one side fades.',
      delta !== null && delta < 0
        ? 'Because the trend is drifting down, keep the next session shorter and reassess.'
        : 'Retest after a rest interval to see if the imbalance persists.',
    ]
  }

  return [
    `Begin the next session with low-load activation on ${side} before bilateral work.`,
    stability !== null && stability < 75
      ? 'Prioritize matching the same output twice before increasing effort.'
      : 'Use slower reps and hold the peak contraction briefly so output remains repeatable.',
    'Keep electrode placement consistent between attempts before comparing trend changes.',
  ]
}

function goalsFor(
  regionShortLabel: string,
  imbalance: number,
  count: number,
  estimatedSessions: number | null
): string[] {
  return [
    `Bring ${regionShortLabel} imbalance below 10% across two saved sessions.`,
    estimatedSessions === null
      ? `Save ${Math.max(0, TARGET_SESSIONS - count)} more run${Math.max(0, TARGET_SESSIONS - count) === 1 ? '' : 's'} for higher-confidence projection.`
      : `Target near-sync over the next ${estimatedSessions} focused session${estimatedSessions === 1 ? '' : 's'}.`,
    imbalance > 12
      ? 'End the set when the lower-output side fades instead of letting the stronger side dominate.'
      : 'Maintain the current pattern and prove it with repeated saved attempts.',
  ]
}

function buildCoachingPlan({
  region,
  severity,
  delta,
  limitedSide,
  stability,
  latestScore,
  count,
}: {
  region: MuscleRegion
  severity: ImbalanceSeverity
  delta: number | null
  limitedSide: 'left' | 'right' | 'unknown'
  stability: number | null
  latestScore: number
  count: number
}): CoachCard[] {
  const side = limitedSide === 'unknown' ? 'lower-output side' : `${limitedSide} side`
  const intensity = severity === 'high' ? 'low' : severity === 'moderate' ? 'moderate-low' : 'controlled'
  const hold = latestScore >= 86 ? '3-5 seconds' : '1-3 seconds'

  return [
    {
      title: 'Session structure',
      detail: `Use ${intensity} effort for ${region.shortLabel}. Start with the ${side}, then move into bilateral contractions once both sides wake up.`,
    },
    {
      title: 'Tempo target',
      detail: `Use a slow ramp, hold peak contraction for ${hold}, then relax fully before the next attempt.`,
    },
    {
      title: 'Learning rule',
      detail:
        count >= TARGET_SESSIONS
          ? 'The coach is now comparing recent sessions against your own baseline instead of one-off scores.'
          : `Save ${TARGET_SESSIONS - count} more run${TARGET_SESSIONS - count === 1 ? '' : 's'} so the coach can separate real progress from noise.`,
    },
    {
      title: 'Progress gate',
      detail:
        delta !== null && delta < -5
          ? 'Because the trend dipped, repeat the last easier setup before adding challenge.'
          : stability !== null && stability < 75
            ? 'Hold the same difficulty until two sessions land within a similar score range.'
            : 'If the next session stays balanced, slightly increase range or resistance while keeping symmetry first.',
    },
  ]
}

function correctionQueueFor(
  severity: ImbalanceSeverity,
  limitedSide: 'left' | 'right' | 'unknown',
  stability: number | null
): string[] {
  const side = limitedSide === 'unknown' ? 'lower-output side' : `${limitedSide} side`
  const corrections = [
    `Start every set by checking whether the ${side} activates at the same time as the stronger side.`,
    'Keep the red/green active pair on the same muscle belly location between sessions.',
    'Stop the attempt if form changes just to increase the number.',
  ]

  if (severity === 'high') {
    corrections.unshift('Lower the effort level and rebuild clean activation before chasing peak output.')
  }
  if (stability !== null && stability < 70) {
    corrections.push('Shorten the set and repeat the same contraction until output becomes repeatable.')
  }

  return corrections
}

function encouragementFor(delta: number | null, latestScore: number, count: number): string {
  if (latestScore >= NEAR_SYNC_SCORE) {
    return 'Excellent sync is showing. Your job now is to make it repeatable, not harder.'
  }
  if (delta !== null && delta > 4) {
    return 'The pattern is moving in the right direction. Keep the setup consistent and let the trend compound.'
  }
  if (delta !== null && delta < -4) {
    return 'A downshift is useful information, not failure. Repeat the easier version and rebuild clean output.'
  }
  if (count >= TARGET_SESSIONS) {
    return 'You have enough history for the coach to compare you against your own baseline. Small improvements now matter.'
  }
  return 'Keep stacking clean sessions. The coach gets sharper as your local history grows.'
}
