import type { SerializedGrid } from './Grid'
import { SessionManager } from './SessionManager'

export interface SerializedGameState {
  grid: SerializedGrid
  score: number
  over: boolean
  won: boolean
  keepPlaying: boolean
  gameGeneration?: number
}

const fakeStorage: Storage = {
  _data: {} as Record<string, string>,
  get length() {
    return Object.keys(this._data).length
  },
  key() {
    return null
  },
  setItem(id: string, val: string) {
    this._data[id] = String(val)
  },
  getItem(id: string) {
    return Object.prototype.hasOwnProperty.call(this._data, id)
      ? this._data[id]
      : null
  },
  removeItem(id: string) {
    delete this._data[id]
  },
  clear() {
    this._data = {}
  },
}

export class LocalStorageManager {
  private bestScoreKey = 'bestScore'
  private gameStateKey = 'gameState'
  private storage: Storage

  constructor() {
    this.storage = this.localStorageSupported()
      ? window.localStorage
      : fakeStorage
  }

  private localStorageSupported(): boolean {
    try {
      const testKey = 'test'
      window.localStorage.setItem(testKey, '1')
      window.localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }

  getBestScore(): number {
    return Number(this.storage.getItem(this.bestScoreKey)) || 0
  }

  setBestScore(score: number) {
    this.storage.setItem(this.bestScoreKey, String(score))
  }

  getGameState(): SerializedGameState | null {
    const stateJSON = this.storage.getItem(this.gameStateKey)
    return stateJSON ? JSON.parse(stateJSON) : null
  }

  setGameState(gameState: SerializedGameState) {
    this.storage.setItem(this.gameStateKey, JSON.stringify(gameState))
  }

  clearGameState() {
    this.storage.removeItem(this.gameStateKey)
  }

  hasSavedGame(): boolean {
    return this.getGameState() !== null
  }

  hasResumableGame(): boolean {
    const state = this.getGameState()
    if (!state) return false

    const session = new SessionManager()
    if (!session.isInSession()) return true

    return (state.gameGeneration ?? 0) === session.getGameGeneration()
  }
}
