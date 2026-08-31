import Phaser from 'phaser'
import LocalStore from 'licia/LocalStore'
import type { LevelId } from '../game/levels'

const REGISTRY_STORAGE_KEY = 'storage'

const STORAGE_KEYS = {
  level: 'level',
  soundEnabled: 'soundEnabled',
} as const

export class GameStorage {
  constructor(private store: LocalStore) {}

  getLevel(): unknown {
    return this.store.get(STORAGE_KEYS.level)
  }

  setLevel(levelId: LevelId) {
    this.store.set(STORAGE_KEYS.level, levelId)
  }

  getSoundEnabled(): boolean {
    return this.store.get(STORAGE_KEYS.soundEnabled) ?? true
  }

  setSoundEnabled(enabled: boolean) {
    this.store.set(STORAGE_KEYS.soundEnabled, enabled)
  }
}

export function initStorage(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORAGE_KEY)) {
    game.registry.set(
      REGISTRY_STORAGE_KEY,
      new GameStorage(new LocalStore('tinker-minesweeper')),
    )
  }
}

export function getStorage(scene: Phaser.Scene): GameStorage {
  return scene.registry.get(REGISTRY_STORAGE_KEY)
}
