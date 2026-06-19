import Phaser from 'phaser'
import { COLORS, TRANSITION_SPEED } from '../game/constants'
import { FIELD_WIDTH, GAME_CONTAINER_Y } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { createButton } from '../ui/createButton'
import { addSharpText } from '../ui/sharpText'

export interface GameOverlayCallbacks {
  onKeepPlaying: () => void
  onRestart: () => void
}

export class GameOverlay {
  private container: Phaser.GameObjects.Container
  private overlay: Phaser.GameObjects.Graphics
  private messageText: Phaser.GameObjects.Text
  private keepPlayingBtn: Phaser.GameObjects.Container
  private retryBtn: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private callbacks: GameOverlayCallbacks,
  ) {
    this.container = scene.add.container(0, s(GAME_CONTAINER_Y))
    this.container.setVisible(false)
    this.container.setDepth(100)

    this.overlay = scene.add.graphics()
    this.overlay.setName('overlay')

    this.messageText = addSharpText(scene, s(FIELD_WIDTH / 2), s(222), '', 60, {
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.keepPlayingBtn = createButton(
      scene,
      t('keepGoing'),
      FIELD_WIDTH / 2 - 70,
      340,
      130,
      40,
    )
    this.keepPlayingBtn.setVisible(false)
    this.keepPlayingBtn.on('pointerup', () => this.callbacks.onKeepPlaying())

    this.retryBtn = createButton(
      scene,
      t('tryAgain'),
      FIELD_WIDTH / 2 + 70,
      340,
      110,
      40,
    )
    this.retryBtn.on('pointerup', () => this.callbacks.onRestart())

    this.container.add([
      this.overlay,
      this.messageText,
      this.keepPlayingBtn,
      this.retryBtn,
    ])
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.container)
    this.container.destroy(true)
  }

  show(won: boolean) {
    this.overlay.clear()
    this.overlay.fillStyle(
      won ? COLORS.winOverlay : COLORS.gameOverOverlay,
      0.5,
    )
    this.overlay.fillRect(0, 0, s(FIELD_WIDTH), s(FIELD_WIDTH))

    this.messageText.setText(won ? t('youWin') : t('gameOver'))
    this.messageText.setColor(won ? COLORS.brightText : COLORS.text)
    this.keepPlayingBtn.setVisible(won)

    if (won) {
      this.retryBtn.setPosition(s(FIELD_WIDTH / 2 + 70), s(340))
    } else {
      this.retryBtn.setPosition(s(FIELD_WIDTH / 2), s(340))
    }

    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 800,
      delay: TRANSITION_SPEED * 12,
    })
  }

  hide() {
    this.container.setVisible(false)
    this.container.setAlpha(1)
  }
}
