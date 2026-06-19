import Phaser from 'phaser'
import { LocalStorageManager } from './game/LocalStorageManager'
import { SessionManager } from './game/SessionManager'

const REGISTRY_STORAGE = 'storage'
const REGISTRY_SESSION = 'session'

export function initRegistry(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORAGE)) {
    game.registry.set(REGISTRY_STORAGE, new LocalStorageManager())
  }
  if (!game.registry.has(REGISTRY_SESSION)) {
    game.registry.set(REGISTRY_SESSION, new SessionManager())
  }
}

export function getStorage(scene: Phaser.Scene): LocalStorageManager {
  return scene.registry.get(REGISTRY_STORAGE)
}

export function getSession(scene: Phaser.Scene): SessionManager {
  return scene.registry.get(REGISTRY_SESSION)
}
