'use client'
import { motion } from 'framer-motion'

interface QuadrantRingsProps {
  leftQuad: number
  rightQuad: number
  leftHam: number
  rightHam: number
  active: boolean
}

const CHANNELS = [
  { key: 'leftQuad',  label: 'L·QUAD', abbr: 'LQ', color: '#6EB5FF' },
  { key: 'rightQuad', label: 'R·QUAD', abbr: 'RQ', color: '#9B72F5' },
  { key: 'leftHam',   label: 'L·HAM',  abbr: 'LH', color: '#1FD8A4' },
  { key: 'rightHam',  label: 'R·HAM',  abbr: 'RH', color: '#FBBF24' },
] as const

type ChannelKey = typeof CHANNELS[number]['key']

interface RingCellProps {
  value: number
  color: string
  label: string
  abbr: string
  active: boolean
}

const C = 2 * Math.PI * 38

function RingCell({ value, color, label, abbr, active }: RingCellProps) {
  const displayValue = active ? value : 0
  const targetOffset = C * (1 - displayValue / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 96, height: 96 }}>
        <svg
          width="96"
          height="96"
          viewBox="0 0 96 96"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="6"
          />
          {/* Arc */}
          <motion.circle
            cx="48"
            cy="48"
            r="38"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"
          style={{ opacity: active ? 1 : 0.4, transition: 'opacity 0.4s ease' }}
        >
          <span
            style={{
              fontSize: '9px',
              color: 'var(--mp-t3)',
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            {abbr}
          </span>
          <span
            style={{
              fontSize: '20px',
              color,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {Math.round(active ? value : 0)}
          </span>
        </div>
      </div>
      <span
        style={{
          fontSize: '8px',
          color: 'var(--mp-t4)',
          fontWeight: 600,
          letterSpacing: '0.14em',
          opacity: active ? 1 : 0.4,
          transition: 'opacity 0.4s ease',
        }}
      >
        {label}
      </span>
    </div>
  )
}

export function QuadrantRings({
  leftQuad,
  rightQuad,
  leftHam,
  rightHam,
  active,
}: QuadrantRingsProps) {
  const data: Record<ChannelKey, number> = {
    leftQuad,
    rightQuad,
    leftHam,
    rightHam,
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {CHANNELS.map((ch) => (
        <RingCell
          key={ch.key}
          value={data[ch.key]}
          color={ch.color}
          label={ch.label}
          abbr={ch.abbr}
          active={active}
        />
      ))}
    </div>
  )
}
