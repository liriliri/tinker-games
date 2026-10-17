import Phaser from 'phaser'
import fragShader from './shaders/glow.frag?raw'

/** Camera post-FX: OLED bloom + light chromatic fringe. */
export class GlowPipeline
  extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline
{
  constructor(game: Phaser.Game) {
    super({
      game,
      name: 'Glow',
      fragShader,
    })
  }

  onDraw(target: Phaser.Renderer.WebGL.RenderTarget) {
    this.set2f('resolution', target.width, target.height)
    this.bindAndDraw(target)
  }
}
