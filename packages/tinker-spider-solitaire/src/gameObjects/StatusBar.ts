import Phaser from 'phaser'
import {
  COLORS,
  FIELD_WIDTH,
  STATUS_BAR_BOTTOM_INSET,
  STATUS_BAR_HEIGHT,
  STATUS_BAR_RADIUS,
  STATUS_BAR_WIDTH,
} from '../game/constants'
import { GAME_HEIGHT } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { addSharpText } from '../ui/sharpText'

function statusBarOrigin() {
  return {
    x: (FIELD_WIDTH - STATUS_BAR_WIDTH) / 2,
    y: GAME_HEIGHT - STATUS_BAR_HEIGHT - STATUS_BAR_BOTTOM_INSET,
  }
}

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private scoreText!: Phaser.GameObjects.Text
  private movesText!: Phaser.GameObjects.Text

  constructor(
    private scene: Phaser.Scene,
    private onNewGame: () => void,
  ) {
    const origin = statusBarOrigin()
    this.container = scene.add.container(s(origin.x), s(origin.y)).setDepth(100)
    this.build()
  }

  rebuild() {
    const origin = statusBarOrigin()
    this.container.setPosition(s(origin.x), s(origin.y))
    this.container.removeAll(true)
    this.build()
  }

  update(score: number, moves: number) {
    this.scoreText.setText(`${t('score')}: ${score}`)
    this.movesText.setText(`${t('moves')}: ${moves}`)
  }

  destroy() {
    this.container.destroy(true)
  }

  private build() {
    const barWidth = s(STATUS_BAR_WIDTH)
    const barHeight = s(STATUS_BAR_HEIGHT)
    const radius = s(STATUS_BAR_RADIUS)

    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.statusBar, 1)
    bg.fillRoundedRect(0, 0, barWidth, barHeight, radius)

    this.scoreText = addSharpText(this.scene, s(18), barHeight / 2, '', 12, {
      color: COLORS.statusText,
    }).setOrigin(0, 0.5)

    this.movesText = addSharpText(this.scene, s(130), barHeight / 2, '', 12, {
      color: COLORS.statusText,
    }).setOrigin(0, 0.5)

    const newGameBtn = this.createButton(
      barWidth - s(92),
      s(7),
      s(84),
      s(28),
      t('newGame'),
      this.onNewGame,
    )

    this.container.add([bg, this.scoreText, this.movesText, newGameBtn])
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ) {
    const bg = this.scene.add.graphics()
    const drawNormal = () => {
      bg.clear()
      bg.fillStyle(COLORS.statusButton, 1)
      bg.fillRoundedRect(x, y, width, height, s(5))
    }
    drawNormal()

    const text = addSharpText(
      this.scene,
      x + width / 2,
      y + height / 2,
      label,
      11,
      { color: COLORS.statusButtonText, fontStyle: 'bold' },
    ).setOrigin(0.5)

    const hit = this.scene.add
      .zone(x + width / 2, y + height / 2, width, height)
      .setInteractive({ useHandCursor: true })

    hit.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.statusButtonHover, 1)
      bg.fillRoundedRect(x, y, width, height, s(5))
    })
    hit.on('pointerout', drawNormal)
    hit.on('pointerdown', () => {
      bg.clear()
      bg.fillStyle(COLORS.statusButtonActive, 1)
      bg.fillRoundedRect(x, y, width, height, s(5))
    })
    hit.on('pointerup', () => {
      drawNormal()
      onClick()
    })

    return this.scene.add.container(0, 0, [bg, text, hit])
  }
}
