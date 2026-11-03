import { Game } from './game/Game'
import { initLanguage, t } from './lib/i18n'
import './ui/style.css'

async function init() {
  await initLanguage()
  document.title = t('cubeLabel')
  new Game()
}

init()
