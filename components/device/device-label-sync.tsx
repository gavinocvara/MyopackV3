'use client'

import { useEffect } from 'react'
import { useEMG } from '@/lib/emg/context'
import { useMuscleSelection } from '@/lib/muscle-selection-context'
import { SWAP_PHYSICAL_SIDES, type MuscleGroup } from '@/lib/muscle-selection'

const BASE_DEVICE_LABELS: Record<MuscleGroup, { left: [string, string]; right: [string, string] }> = {
  quads:      { left: ['Left Quad',     'Left Quad B'],     right: ['Right Quad',     'Right Quad B'] },
  hamstrings: { left: ['Left Ham',      'Left Ham B'],      right: ['Right Ham',      'Right Ham B'] },
  biceps:     { left: ['Left Bicep',    'Left Bicep B'],    right: ['Right Bicep',    'Right Bicep B'] },
  shoulders:  { left: ['Left Shoulder', 'Left Shoulder B'], right: ['Right Shoulder', 'Right Shoulder B'] },
}

function labelsForGroup(group: MuscleGroup): [string, string, string, string] {
  const labels = BASE_DEVICE_LABELS[group]
  return SWAP_PHYSICAL_SIDES
    ? [labels.right[0], labels.right[1], labels.left[0], labels.left[1]]
    : [labels.left[0], labels.left[1], labels.right[0], labels.right[1]]
}

export function DeviceLabelSync() {
  const { dataSource, deviceState, syncDeviceLabels } = useEMG()
  const { selectedGroup } = useMuscleSelection()

  useEffect(() => {
    if (!selectedGroup) return
    if ((dataSource !== 'device' && dataSource !== 'relay') || deviceState !== 'connected') return
    syncDeviceLabels(labelsForGroup(selectedGroup))
  }, [dataSource, deviceState, selectedGroup, syncDeviceLabels])

  return null
}
