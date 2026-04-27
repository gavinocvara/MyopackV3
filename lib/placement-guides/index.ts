import type { MuscleGroup } from '@/lib/muscle-selection'
import type { PlacementGuide } from './types'
import { bicepsPlacement } from './biceps'
import { hamstringsPlacement } from './hamstrings'
import { quadsPlacement } from './quads'
import { shouldersPlacement } from './shoulders'

export type { PlacementGuide } from './types'

export const PLACEMENT_GUIDES: Record<MuscleGroup, PlacementGuide> = {
  quads: quadsPlacement,
  hamstrings: hamstringsPlacement,
  biceps: bicepsPlacement,
  shoulders: shouldersPlacement,
}

export function getPlacementGuide(group: MuscleGroup): PlacementGuide {
  return PLACEMENT_GUIDES[group]
}
