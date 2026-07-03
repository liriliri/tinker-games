export type LevelId = 'easy' | 'medium' | 'hard' | 'insane'

export interface LevelConfig {
  id: LevelId
  removalSteps: number
}

export const LEVELS: Record<LevelId, LevelConfig> = {
  easy: { id: 'easy', removalSteps: 72 },
  medium: { id: 'medium', removalSteps: 96 },
  hard: { id: 'hard', removalSteps: 128 },
  insane: { id: 'insane', removalSteps: 192 },
}

export const DEFAULT_LEVEL_ID: LevelId = 'medium'

let currentLevelId: LevelId = DEFAULT_LEVEL_ID

export function initCurrentLevel(levelId: LevelId) {
  currentLevelId = levelId
}

export function getCurrentLevel() {
  return LEVELS[currentLevelId]
}

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && value in LEVELS
}
