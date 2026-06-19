import Phaser from 'phaser'
import LocalStore from 'licia/LocalStore'

const REGISTRY_STORE = 'store'

export function initRegistry(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORE)) {
    game.registry.set(REGISTRY_STORE, new LocalStore('tinker-minesweeper'))
  }
}

export function getStore(scene: Phaser.Scene): LocalStore {
  return scene.registry.get(REGISTRY_STORE)
}
