'use client'

import { motion } from 'framer-motion'
import type { EMGHistoryPoint } from '@/lib/emg/context'

interface LiveMuscleGraphProps {
  history: EMGHistoryPoint[]
  title: string
  leftLabel: string
  rightLabel?: string
  leftColor: string
  rightColor?: string
  leftIndex: 0 | 1 | 2 | 3
  rightIndex?: 0 | 1 | 2 | 3
  rateLabel?: string
}

const GRAPH_WIDTH = 320
const GRAPH_HEIGHT = 160
const GRAPH_PADDING = 16

function buildPath(history: EMGHistoryPoint[], channelIndex: number): string {
  if (history.length === 0) return ''

  const innerWidth = GRAPH_WIDTH - GRAPH_PADDING * 2
  const innerHeight = GRAPH_HEIGHT - GRAPH_PADDING * 2

  return history
    .map((point, index) => {
      const firstTs = history[0]?.timestamp ?? 0
      const lastTs = history[history.length - 1]?.timestamp ?? firstTs
      const elapsed = lastTs - firstTs
      const timeRatio = elapsed > 0
        ? (point.timestamp - firstTs) / elapsed
        : index / Math.max(history.length - 1, 1)
      const x = GRAPH_PADDING + Math.max(0, Math.min(1, timeRatio)) * innerWidth
      const normalized = Math.max(0, Math.min(100, point.values[channelIndex]))
      const y = GRAPH_PADDING + innerHeight - (normalized / 100) * innerHeight
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export function LiveMuscleGraph({
  history,
  title,
  leftLabel,
  rightLabel,
  leftColor,
  rightColor,
  leftIndex,
  rightIndex,
  rateLabel = '20 Hz',
}: LiveMuscleGraphProps) {
  const leftPath = buildPath(history, leftIndex)
  const rightPath = typeof rightIndex === 'number' ? buildPath(history, rightIndex) : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: 'var(--mp-s1)',
        borderRadius: 18,
        padding: 18,
        border: '1px solid var(--mp-line2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <p
            style={{
              fontSize: 9,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--mp-t4)',
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Live Broadcast
          </p>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--mp-t1)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h3>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--mp-t4)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {rateLabel}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { label: leftLabel, color: leftColor },
          ...(rightLabel && rightColor ? [{ label: rightLabel, color: rightColor }] : []),
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: item.color,
                boxShadow: `0 0 0 4px ${item.color}18`,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--mp-t2)', fontWeight: 600 }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          borderRadius: 14,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {[25, 50, 75].map((value) => {
            const y =
              GRAPH_PADDING +
              (GRAPH_HEIGHT - GRAPH_PADDING * 2) -
              (value / 100) * (GRAPH_HEIGHT - GRAPH_PADDING * 2)
            return (
              <g key={value}>
                <line
                  x1={GRAPH_PADDING}
                  x2={GRAPH_WIDTH - GRAPH_PADDING}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 6"
                />
                <text
                  x={GRAPH_WIDTH - 2}
                  y={y + 4}
                  fill="rgba(255,255,255,0.35)"
                  fontSize="9"
                  textAnchor="end"
                >
                  {value}%
                </text>
              </g>
            )
          })}

          {leftPath && (
            <path
              d={leftPath}
              fill="none"
              stroke={leftColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {rightPath && rightColor && (
            <path
              d={rightPath}
              fill="none"
              stroke={rightColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </motion.div>
  )
}
