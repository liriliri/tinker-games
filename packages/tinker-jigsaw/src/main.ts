import Phaser from 'phaser'
import { COLORS } from './game/constants'
import { GalleryScene } from './scenes/GalleryScene'
import { GameScene } from './scenes/GameScene'
import { FIELD_WIDTH, GAME_HEIGHT } from './lib/layout'
import { initLanguage } from './lib/i18n'
import { bindRenderScale } from './lib/scale'

async function init() {
  await initLanguage()

  new Phaser.Game({
    type: Phaser.AUTO,
    width: FIELD_WIDTH,
    height: GAME_HEIGHT,
    parent: document.body,
    backgroundColor: COLORS.page,
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
    scene: [GalleryScene, GameScene],
  })
}

init()
