import { Game } from './game/game'
import { initLanguage } from './lib/i18n'
import './ui/style.css'

async function init() {
  await initLanguage()

  const game = new Game()
  game.start()

  if (import.meta.env.DEV) {
    ;(window as unknown as { __battleTank?: Game }).__battleTank = game
  }
}

init()
