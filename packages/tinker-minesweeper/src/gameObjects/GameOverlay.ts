import Phaser from 'phaser'
import { COLORS, TRANSITION_SPEED, computeGridHeight } from '../game/constants'
import { FIELD_WIDTH, GAME_CONTAINER_Y } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { createButton } from '../ui/createButton'
import { addSharpText } from '../ui/sharpText'
import { boardBounds, computeCellSize } from './gridLayout'

export interface GameOverlayCallbacks {
  onRestart: () => void
}

export class GameOverlay {
  private container: Phaser.GameObjects.Container
  private overlay: Phaser.GameObjects.Graphics
  private messageText: Phaser.GameObjects.Text
  private retryBtn: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private callbacks: GameOverlayCallbacks,
  ) {
    const cellSize = computeCellSize()
    const bounds = boardBounds(cellSize)

    this.container = scene.add.container(0, 0)
    this.container.setVisible(false)
    this.container.setDepth(100)

    this.overlay = scene.add.graphics()

    this.messageText = addSharpText(
      scene,
      bounds.centerX,
      bounds.centerY - s(20),
      '',
      42,
      {
        color: COLORS.text,
        fontStyle: 'bold',
      },
    ).setOrigin(0.5)

    this.retryBtn = createButton(
      scene,
      t('tryAgain'),
      FIELD_WIDTH / 2,
      GAME_CONTAINER_Y + computeGridHeight() / 2 + 40,
      120,
      40,
    )
    this.retryBtn.on('pointerup', () => this.callbacks.onRestart())

    this.container.add([this.overlay, this.messageText, this.retryBtn])
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.container)
    this.container.destroy(true)
  }

  show(won: boolean) {
    const cellSize = computeCellSize()
    const bounds = boardBounds(cellSize)

    this.overlay.clear()
    this.overlay.fillStyle(
      won ? COLORS.winOverlay : COLORS.gameOverOverlay,
      0.45,
    )
    this.overlay.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)

    this.messageText.setPosition(bounds.centerX, bounds.centerY - s(20))
    this.messageText.setText(won ? t('youWin') : t('gameOver'))
    this.messageText.setColor(COLORS.brightText)

    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 600,
      delay: TRANSITION_SPEED * 8,
    })
  }

  hide() {
    this.container.setVisible(false)
    this.container.setAlpha(1)
  }
}
