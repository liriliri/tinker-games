import Phaser from 'phaser'
import { initLanguage } from './lib/i18n'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'

async function init() {
  await initLanguage()

  new Phaser.Game({
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: document.body,
    backgroundColor: '#060c16',
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameScene],
  })
}

init()
