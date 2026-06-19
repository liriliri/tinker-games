import Phaser from 'phaser'
import { LocalStorageManager } from './game/LocalStorageManager'

const REGISTRY_STORAGE = 'storage'

export function initRegistry(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORAGE)) {
    game.registry.set(REGISTRY_STORAGE, new LocalStorageManager())
  }
}

export function getStorage(scene: Phaser.Scene): LocalStorageManager {
  return scene.registry.get(REGISTRY_STORAGE)
}
