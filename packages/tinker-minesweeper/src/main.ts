import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { bindRenderScale } from './scale'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'
import { setLocale } from './i18n'

async function initLanguage() {
  if (typeof tinker !== 'undefined') {
    try {
      const lang = await tinker.getLanguage()
      setLocale(lang)
    } catch {
      // Fall back to navigator.language (already the default)
    }
  }
}

async function init() {
  await initLanguage()

  new Phaser.Game({
    type: Phaser.AUTO,
    width: FIELD_WIDTH,
    height: GAME_HEIGHT,
    parent: document.body,
    backgroundColor: '#bdbdbd',
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    callbacks: {
      postBoot: (game) => {
        bindRenderScale(game)
      },
    },
    scene: [BootScene, GameScene],
  })
}

init()
