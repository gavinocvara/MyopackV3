import type { MuscleGroup } from '@/lib/muscle-selection'

export interface PlacementGuide {
  muscleGroup: MuscleGroup
  cue: string
  activeSite: string
  referenceSite: string
  orientation: string
  test: string
}
