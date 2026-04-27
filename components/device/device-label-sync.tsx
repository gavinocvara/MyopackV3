'use client'

import { useEffect } from 'react'
import { useEMG } from '@/lib/emg/context'
import { useMuscleSelection } from '@/lib/muscle-selection-context'
import type { MuscleGroup } from '@/lib/muscle-selection'

// Channel label order matches physical chip assignment:
//   ch[0] = U1 (CS=21) CH1 → Left body side, primary
//   ch[1] = U1 (CS=21) CH2 → Left body side, secondary
//   ch[2] = U4 (CS=22) CH1 → Right body side, primary
//   ch[3] = U4 (CS=22) CH2 → Right body side, secondary
const DEVICE_LABELS: Record<MuscleGroup, [string, string, string, string]> = {
  quads:      ['Left Quad',     'Left Quad B',     'Right Quad',     'Right Quad B'],
  hamstrings: ['Left Ham',      'Left Ham B',      'Right Ham',      'Right Ham B'],
  biceps:     ['Left Bicep',    'Left Bicep B',    'Right Bicep',    'Right Bicep B'],
  shoulders:  ['Left Shoulder', 'Left Shoulder B', 'Right Shoulder', 'Right Shoulder B'],
}

export function DeviceLabelSync() {
  const { dataSource, deviceState, syncDeviceLabels } = useEMG()
  const { selectedGroup } = useMuscleSelection()

  useEffect(() => {
    if (!selectedGroup) return
    if (dataSource !== 'device' || deviceState !== 'connected') return
    syncDeviceLabels(DEVICE_LABELS[selectedGroup])
  }, [dataSource, deviceState, selectedGroup, syncDeviceLabels])

  return null
}
