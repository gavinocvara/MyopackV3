'use client'
import { motion } from 'framer-motion'
import { useEMG } from '@/lib/emg/context'

// Small floating pill in the top corner of the app. Shows the current
// data source + device link state. Tap to open the connect modal.
//
// States:
//   simulated          → neutral pill, "SIM"
//   device connecting  → amber pulse, "LINKING"
//   device connected   → jade dot pulse, "LIVE"
//   device error       → rose pulse, "OFFLINE"

interface DeviceStatusPillProps {
  onTap: () => void
}

function stateStyle(state: string, source: string): {
  bg: string; border: string; color: string; label: string; dot: boolean
} {
  if (source === 'simulated') {
    return {
      bg: 'rgba(96,165,250,0.06)',
      border: 'rgba(96,165,250,0.18)',
      color: 'var(--mp-sky)',
      label: 'SIM',
      dot: false,
    }
  }
  if (state === 'connected') {
    return {
      bg: 'rgba(31,216,164,0.10)',
      border: 'rgba(31,216,164,0.30)',
      color: 'var(--mp-jade)',
      label: 'LIVE',
      dot: true,
    }
  }
  if (state === 'connecting') {
    return {
      bg: 'rgba(251,191,36,0.10)',
      border: 'rgba(251,191,36,0.28)',
      color: 'var(--mp-amber)',
      label: 'LINKING',
      dot: true,
    }
  }
  // disconnected / error
  return {
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.22)',
    color: 'var(--mp-rose)',
    label: 'OFFLINE',
    dot: false,
  }
}

export function DeviceStatusPill({ onTap }: DeviceStatusPillProps) {
  const { dataSource, deviceState } = useEMG()
  const s = stateStyle(deviceState, dataSource)

  return (
    <motion.button
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
      aria-label="Device connection"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 14px)',
        right: 14,
        zIndex: 40,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 9999,
        padding: '6px 11px 6px 9px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        outline: 'none',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {s.dot ? (
        <motion.div
          animate={{ opacity: [1, 0.35, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: s.color, flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: s.color, opacity: 0.55, flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: s.color,
          fontFamily: 'monospace',
        }}
      >
        {s.label}
      </span>
    </motion.button>
  )
}
