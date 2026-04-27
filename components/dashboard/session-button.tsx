'use client'
import { motion, AnimatePresence } from 'framer-motion'

interface SessionButtonProps {
  isMonitoring: boolean
  onToggle: () => void
  disabled?: boolean
  idleLabel?: string
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 2.5 L11 7 L3 11.5 Z" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="1" y="1" width="10" height="10" rx="3" />
    </svg>
  )
}

export function SessionButton({ isMonitoring, onToggle, disabled = false, idleLabel = 'Begin Session' }: SessionButtonProps) {
  const isDisabled = !isMonitoring && disabled

  return (
    <motion.button
      onClick={onToggle}
      disabled={isDisabled}
      whileTap={{ scale: 0.98 }}
      aria-label={isMonitoring ? 'End monitoring session' : 'Begin monitoring session'}
      style={{
        width: '100%',
        height: '64px',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden',
        opacity: isDisabled ? 0.56 : 1,
        ...(isMonitoring
          ? {
              background: 'rgba(247,71,71,0.10)',
              border: '1px solid rgba(247,71,71,0.25)',
              color: 'var(--mp-rose)',
            }
          : {
              background: isDisabled ? 'rgba(255,255,255,0.045)' : 'rgba(31,216,164,0.15)',
              border: isDisabled ? '1px solid var(--mp-line2)' : '1.5px solid rgba(31,216,164,0.40)',
              color: isDisabled ? 'var(--mp-t4)' : 'var(--mp-jade)',
              boxShadow: isDisabled ? 'none' : 'inset 0 1px 0 rgba(31,216,164,0.15)',
            }),
      }}
      {...(isMonitoring
        ? {
            animate: {
              boxShadow: [
                '0 0 0px rgba(247,71,71,0)',
                '0 0 20px rgba(247,71,71,0.15)',
                '0 0 0px rgba(247,71,71,0)',
              ],
            },
            transition: { duration: 3, repeat: Infinity },
          }
        : {})}
    >
      <AnimatePresence mode="wait">
        {isMonitoring ? (
          <motion.div
            key="end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <StopIcon />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              End Session
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="begin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <PlayIcon />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {idleLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
