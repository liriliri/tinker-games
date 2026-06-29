import {
  COLORS,
  HEADER_HEIGHT,
  HEADER_PADDING_X,
  STATUS_FONT_SIZE,
} from '../game/constants'
import { t } from '../i18n'
import { GameScene } from '../scenes/GameScene'
import { s } from '../scale'
import { createActionButton } from '../ui/createActionButton'
import { sharpTextStyle } from '../ui/sharpText'

export class HeaderBar extends Phaser.GameObjects.Container {
  declare scene: GameScene
  private statusText: Phaser.GameObjects.Text
  private resetButton: Phaser.GameObjects.Container
  private undoButton: Phaser.GameObjects.Container
  private headerBg: Phaser.GameObjects.Graphics
  private readonly barHeight: number
  private readonly barWidth: number

  constructor(scene: GameScene) {
    super(scene, 0, 0)
    this.barWidth = scene.game.canvas.width
    this.barHeight = s(HEADER_HEIGHT)

    this.headerBg = scene.add.graphics()
    this.drawBackground()

    const centerY = this.barHeight / 2
    const reset = createActionButton(scene, t('reset'), 0, centerY)
    const undo = createActionButton(scene, t('undo'), 0, centerY)

    const resetX = s(HEADER_PADDING_X) + reset.width / 2
    const undoX = this.barWidth - s(HEADER_PADDING_X) - undo.width / 2
    reset.container.setPosition(resetX, centerY)
    undo.container.setPosition(undoX, centerY)
    this.resetButton = reset.container
    this.undoButton = undo.container

    const sideReserve =
      Math.max(
        s(HEADER_PADDING_X) + reset.width / 2,
        s(HEADER_PADDING_X) + undo.width / 2,
      ) + s(8)
    const statusWidth = Math.max(s(80), this.barWidth - sideReserve * 2)

    this.statusText = scene.add
      .text(
        this.barWidth / 2,
        centerY,
        '',
        sharpTextStyle(STATUS_FONT_SIZE, {
          color: COLORS.statusText,
          align: 'center',
        }),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(statusWidth)

    this.add([
      this.headerBg,
      this.resetButton,
      this.statusText,
      this.undoButton,
    ])
    this.setDepth(10)
  }

  setStatusText(message: string) {
    this.statusText.setText(message)
  }

  getStatusText() {
    return this.statusText.text
  }

  onReset(callback: () => void) {
    this.resetButton.on('pointerup', callback)
  }

  onUndo(callback: () => void) {
    this.undoButton.on('pointerup', callback)
  }

  private drawBackground() {
    this.headerBg.clear()
    this.headerBg.fillStyle(COLORS.headerBackground, 1)
    this.headerBg.fillRect(0, 0, this.barWidth, this.barHeight)
    this.headerBg.lineStyle(s(1), COLORS.headerBorder, 1)
    this.headerBg.lineBetween(0, this.barHeight, this.barWidth, this.barHeight)
  }
}
