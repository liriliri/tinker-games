import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { bindRenderScale } from './scale'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: FIELD_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,
  backgroundColor: '#faf8ef',
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
  scene: [BootScene, MenuScene, GameScene],
}

new Phaser.Game(config)
