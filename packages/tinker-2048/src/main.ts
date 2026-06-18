import Phaser from 'phaser'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: FIELD_WIDTH,
  height: GAME_HEIGHT,
  parent: document.body,
  backgroundColor: '#faf8ef',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [MenuScene, GameScene],
}

new Phaser.Game(config)
