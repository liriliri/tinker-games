import Phaser from 'phaser'
import LocalStore from 'licia/LocalStore'
import type { SerializedGrid } from '../game/Grid'

const REGISTRY_STORAGE_KEY = 'storage'

const STORAGE_KEYS = {
  bestScore: 'bestScore',
  gameGeneration: 'gameGeneration',
  gameState: 'gameState',
  inSession: 'inSession',
  soundEnabled: 'soundEnabled',
} as const

export interface SerializedGameState {
  grid: SerializedGrid
  score: number
  over: boolean
  won: boolean
  keepPlaying: boolean
  gameGeneration?: number
}

export class GameStorage {
  constructor(private store: LocalStore) {}

  startNewGame() {
    this.clearGameState()
    this.bumpGameGeneration()
  }

  hasResumableGame(): boolean {
    const state = this.getGameState()
    if (!state) return false
    if (!this.isInSession()) return true
    return (state.gameGeneration ?? 0) === this.getGameGeneration()
  }

  markInSession() {
    this.store.set(STORAGE_KEYS.inSession, true)
  }

  isInSession(): boolean {
    return this.store.get(STORAGE_KEYS.inSession) === true
  }

  getGameGeneration(): number {
    return this.store.get(STORAGE_KEYS.gameGeneration) ?? 0
  }

  bumpGameGeneration(): number {
    const next = this.getGameGeneration() + 1
    this.store.set(STORAGE_KEYS.gameGeneration, next)
    return next
  }

  getBestScore(): number {
    return this.store.get(STORAGE_KEYS.bestScore) ?? 0
  }

  setBestScore(score: number) {
    this.store.set(STORAGE_KEYS.bestScore, score)
  }

  getGameState(): SerializedGameState | null {
    return this.store.get(STORAGE_KEYS.gameState) ?? null
  }

  setGameState(state: SerializedGameState) {
    this.store.set(STORAGE_KEYS.gameState, state)
  }

  clearGameState() {
    this.store.remove(STORAGE_KEYS.gameState)
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
      new GameStorage(new LocalStore('tinker-2048')),
    )
  }
}

export function getStorage(scene: Phaser.Scene): GameStorage {
  return scene.registry.get(REGISTRY_STORAGE_KEY)
}
