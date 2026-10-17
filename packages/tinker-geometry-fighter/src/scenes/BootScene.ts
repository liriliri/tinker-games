import Phaser from 'phaser'
import { GlowPipeline } from '../game/GlowPipeline'
import { SCENE_BOOT, SCENE_GAME } from './keys'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT)
  }

  create() {
    const renderer = this.game.renderer
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      renderer.pipelines.addPostPipeline('Glow', GlowPipeline)
    }
    this.scene.start(SCENE_GAME)
  }
}
