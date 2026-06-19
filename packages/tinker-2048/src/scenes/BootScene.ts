import Phaser from 'phaser'
import { initRegistry } from '../registry'
import { SCENE_BOOT, SCENE_MENU } from './keys'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT)
  }

  create() {
    initRegistry(this.game)
    this.scene.start(SCENE_MENU)
  }
}
