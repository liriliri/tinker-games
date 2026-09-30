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

function applyCopy() {
  const scoreLabel = document.getElementById('score-label')
  const bestLabel = document.getElementById('best-label')
  const hint = document.getElementById('hint')
  const gameOverTitle = document.getElementById('game-over-title')
  const finalScoreLabel = document.getElementById('final-score-label')
  const restartBtn = document.getElementById('restart-btn')
  const overlayRecord = document.getElementById('overlay-record')

  if (scoreLabel) scoreLabel.textContent = t('score')
  if (bestLabel) bestLabel.textContent = t('best')
  if (hint) hint.textContent = t('hint')
  if (gameOverTitle) gameOverTitle.textContent = t('gameOver')
  if (finalScoreLabel) finalScoreLabel.textContent = t('score')
  if (restartBtn) restartBtn.textContent = t('playAgain')
  if (overlayRecord) overlayRecord.textContent = t('newBest')
  document.title = t('title')
}

async function init() {
  await initLanguage()
  applyCopy()

  const game = new Game()
  game.start()
}

init()
