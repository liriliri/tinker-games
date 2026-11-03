import once from 'licia/once'

/** Same pattern as board games: clipped elements, unlock on first gesture. */
export class AudioKit {
  private readonly turnAudio = new Audio('sound/turn.mp3')
  private readonly victoryAudio = new Audio('sound/victory.mp3')
  private readonly unlockAudio = once(() => {
    this.turnAudio.load()
    this.victoryAudio.load()
  })

  constructor() {
    this.turnAudio.preload = 'auto'
    this.turnAudio.volume = 0.7
    this.victoryAudio.preload = 'auto'
    this.victoryAudio.volume = 0.7
  }

  unlock(): void {
    this.unlockAudio()
  }

  playTurn(): void {
    this.unlock()
    this.turnAudio.currentTime = 0
    void this.turnAudio.play().catch(() => {})
  }

  playVictory(): void {
    this.unlock()
    this.victoryAudio.currentTime = 0
    void this.victoryAudio.play().catch(() => {})
  }
}
