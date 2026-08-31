import Phaser from 'phaser'
import LocalStore from 'licia/LocalStore'
import type { Difficulty } from '../game/SpiderBoard'

const REGISTRY_STORAGE_KEY = 'storage'

const STORAGE_KEYS = {
  difficulty: 'difficulty',
} as const

export class GameStorage {
  constructor(private store: LocalStore) {}

  getDifficulty(): unknown {
    return this.store.get(STORAGE_KEYS.difficulty)
  }

  setDifficulty(difficulty: Difficulty) {
    this.store.set(STORAGE_KEYS.difficulty, difficulty)
  }
}

export function initStorage(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORAGE_KEY)) {
    game.registry.set(
      REGISTRY_STORAGE_KEY,
      new GameStorage(new LocalStore('tinker-spider-solitaire')),
    )
  }
}

export function getStorage(scene: Phaser.Scene): GameStorage {
  return scene.registry.get(REGISTRY_STORAGE_KEY)
}
