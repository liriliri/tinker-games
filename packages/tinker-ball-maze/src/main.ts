import { Game } from './game/Game'
import { setLocale, t } from './lib/i18n'
import './ui/style.css'

async function initLanguage() {
  if (typeof tinker !== 'undefined') {
    try {
      const lang = await tinker.getLanguage()
      setLocale(lang)
    } catch {
      /* keep navigator.language fallback */
    }
  }
}

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
