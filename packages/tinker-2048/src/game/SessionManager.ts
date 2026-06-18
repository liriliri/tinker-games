const IN_SESSION_KEY = '2048-in-session'
const GAME_GENERATION_KEY = '2048-game-generation'

export class SessionManager {
  markInSession() {
    sessionStorage.setItem(IN_SESSION_KEY, '1')
  }

  isInSession(): boolean {
    return sessionStorage.getItem(IN_SESSION_KEY) === '1'
  }

  getGameGeneration(): number {
    return Number(sessionStorage.getItem(GAME_GENERATION_KEY)) || 0
  }

  bumpGameGeneration(): number {
    const next = this.getGameGeneration() + 1
    sessionStorage.setItem(GAME_GENERATION_KEY, String(next))
    return next
  }
}
