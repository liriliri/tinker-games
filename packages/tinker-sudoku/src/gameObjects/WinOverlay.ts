import Phaser from 'phaser'
import { COLORS, TRANSITION_SPEED } from '../game/constants'
import { t } from '../lib/i18n'
import { GAME_CONTAINER_Y } from '../lib/layout'
import { s } from '../lib/scale'
import { addSharpText } from '../ui/sharpText'
import { boardFrameRect, computeCellSize } from './gridLayout'

export class WinOverlay {
  private container: Phaser.GameObjects.Container
  private overlay: Phaser.GameObjects.Graphics
  private messageText: Phaser.GameObjects.Text

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, s(GAME_CONTAINER_Y))
    this.container.setVisible(false)
    this.container.setDepth(120)

    this.overlay = scene.add.graphics()
    this.messageText = addSharpText(scene, 0, 0, '', 34, {
      color: COLORS.brightText,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.container.add([this.overlay, this.messageText])
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.container)
    this.container.destroy(true)
  }

  show() {
    const cellSize = computeCellSize()
    const frame = boardFrameRect(cellSize)

    this.overlay.clear()
    this.overlay.fillStyle(COLORS.winOverlay, 0.72)
    this.overlay.fillRoundedRect(
      frame.x,
      frame.y - s(GAME_CONTAINER_Y),
      frame.width,
      frame.height,
      s(14),
    )

    this.messageText.setText(t('youWin'))
    this.messageText.setPosition(frame.width / 2, frame.height / 2)
    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 500,
      delay: TRANSITION_SPEED * 2,
    })
  }

  hide() {
    this.container.setVisible(false)
    this.container.setAlpha(1)
  }
}
