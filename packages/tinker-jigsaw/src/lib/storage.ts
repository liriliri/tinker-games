import Phaser from 'phaser'
import LocalStore from 'licia/LocalStore'
import { isJigsawSize, type JigsawSize } from '../game/Jigsaw'

const REGISTRY_STORAGE_KEY = 'storage'
const SIZE_KEY = 'size'

class GameStorage {
  constructor(private store: LocalStore) {}

  getSize(): JigsawSize {
    const value = this.store.get(SIZE_KEY)
    return isJigsawSize(value) ? value : 3
  }

  setSize(size: JigsawSize) {
    this.store.set(SIZE_KEY, size)
  }
}

export function initStorage(game: Phaser.Game) {
  if (!game.registry.has(REGISTRY_STORAGE_KEY)) {
    game.registry.set(
      REGISTRY_STORAGE_KEY,
      new GameStorage(new LocalStore('tinker-jigsaw')),
    )
  }
}

export function getStorage(scene: Phaser.Scene): GameStorage {
  return scene.registry.get(REGISTRY_STORAGE_KEY)
}
