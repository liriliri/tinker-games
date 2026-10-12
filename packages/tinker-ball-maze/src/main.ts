import { Game } from './game/Game'
import { initLanguage, t } from './lib/i18n'
import './ui/style.css'

async function init() {
  await initLanguage()

  const levelLabel = document.querySelector('.level-label')
  if (levelLabel) {
    levelLabel.textContent = t('level')
  }

  const game = new Game()
  game.start()
}

init()
