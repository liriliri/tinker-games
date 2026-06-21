import contain from 'licia/contain'
import keys from 'licia/keys'

export type LevelId = 'beginner' | 'intermediate' | 'expert'

export interface LevelConfig {
  id: LevelId
  rows: number
  cols: number
  mines: number
}

export const LEVELS: Record<LevelId, LevelConfig> = {
  beginner: { id: 'beginner', rows: 9, cols: 9, mines: 10 },
  intermediate: { id: 'intermediate', rows: 16, cols: 16, mines: 40 },
  expert: { id: 'expert', rows: 16, cols: 30, mines: 99 },
}

export const DEFAULT_LEVEL_ID: LevelId = 'beginner'

let currentLevelId: LevelId = DEFAULT_LEVEL_ID

export function initCurrentLevel(id: LevelId) {
  currentLevelId = id
}

export function getCurrentLevel() {
  return LEVELS[currentLevelId]
}

export function isLevelId(value: unknown): value is LevelId {
  return contain(keys(LEVELS), value)
}
