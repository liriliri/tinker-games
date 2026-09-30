import LocalStore from 'licia/LocalStore'

const store = new LocalStore('tinker-jump-jump')

export function getBestScore(): number {
  return store.get('bestScore') ?? 0
}

export function setBestScore(score: number) {
  store.set('bestScore', score)
}
