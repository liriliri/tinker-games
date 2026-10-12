import Phaser from 'phaser'
import { initLanguage } from './lib/i18n'
import { GAME_HEIGHT, GAME_WIDTH } from './lib/layout'
import { GameScene } from './scenes/GameScene'
import { bindRenderScale } from './lib/scale'

async function init() {
  await initLanguage()

  new Phaser.Game({
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: document.body,
    backgroundColor: '#ffffff',
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
    scene: [GameScene],
  })
}

init()
