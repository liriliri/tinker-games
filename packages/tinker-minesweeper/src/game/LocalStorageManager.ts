const BEST_TIME_KEY = 'tinker-minesweeper-best-time'

export class LocalStorageManager {
  getBestTime(): number | null {
    const raw = localStorage.getItem(BEST_TIME_KEY)
    if (!raw) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }

  setBestTime(seconds: number) {
    const current = this.getBestTime()
    if (current === null || seconds < current) {
      localStorage.setItem(BEST_TIME_KEY, String(seconds))
    }
  }
}
