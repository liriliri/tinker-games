import Phaser from 'phaser'
import each from 'licia/each'
import isPlainObj from 'licia/isPlainObj'
import LocalStore from 'licia/LocalStore'
import max from 'licia/max'

const REGISTRY_STORAGE_KEY = 'storage'
const RANK_KEY = 'rank'
const SIZE_KEY = 'size'
const STARS_KEY = 'stars'

export type SplitRank = 0 | 1 | 2

class GameStorage {
  constructor(private store: LocalStore) {}

  getRank(): SplitRank {
    const rank = this.store.get(RANK_KEY)
    if (isSplitRank(rank)) return rank
    return legacyRank(this.store.get(SIZE_KEY))
  }

  setRank(rank: SplitRank) {
    this.store.set(RANK_KEY, rank)
  }

  getBest(pictureId: string): SplitRank | null {
    return this.readStars()[pictureId] ?? null
  }

  recordClear(pictureId: string, rank: number): SplitRank | null {
    const stars = this.readStars()
    const previous = stars[pictureId]
    if (!isSplitRank(rank)) return previous ?? null
    const best =
      previous === undefined ? rank : (max(previous, rank) as SplitRank)
    if (previous !== best) {
      stars[pictureId] = best
      this.store.set(STARS_KEY, stars)
    }
    return best
  }

  private readStars(): Record<string, SplitRank> {
    const value = this.store.get(STARS_KEY)
    if (!isPlainObj(value)) return {}
    const stars: Record<string, SplitRank> = {}
    each(value, (rank: unknown, id: string) => {
      if (isSplitRank(rank)) stars[id] = rank
    })
    return stars
  }
}

function isSplitRank(value: unknown): value is SplitRank {
  return value === 0 || value === 1 || value === 2
}

// Older saves stored the short-side count 3, 4, or 5.
function legacyRank(value: unknown): SplitRank {
  if (value === 4) return 1
  if (value === 5) return 2
  return 0
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
