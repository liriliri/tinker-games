import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import type { GameMetadata } from '../game/GameManager'
import { FIELD_WIDTH } from '../layout'
import { s } from '../scale'
import { drawRaisedRect, drawSunkenRect } from '../ui/drawRoundedRect'
import { addSharpText } from '../ui/sharpText'

const FACE_SIZE = 36
const COUNTER_WIDTH = 56
const COUNTER_HEIGHT = 28

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private minesText: Phaser.GameObjects.Text
  private timerText: Phaser.GameObjects.Text
  private faceBg: Phaser.GameObjects.Graphics
  private faceText: Phaser.GameObjects.Text
  private onReset: () => void

  constructor(
    private scene: Phaser.Scene,
    onReset: () => void,
  ) {
    this.onReset = onReset
    this.container = scene.add.container(0, 0)
    this.container.setDepth(10)

    const barBg = scene.add.graphics()
    drawRaisedRect(
      barBg,
      s(12),
      s(8),
      s(FIELD_WIDTH - 24),
      s(40),
      COLORS.statusBar,
      COLORS.borderLight,
      COLORS.borderDark,
    )

    this.minesText = addSharpText(scene, s(28), s(22), '010', 18, {
      color: '#d32f2f',
      fontStyle: 'bold',
      fontFamily: '"Courier New", monospace',
    }).setOrigin(0, 0.5)

    this.timerText = addSharpText(
      scene,
      s(FIELD_WIDTH - 84),
      s(22),
      '000',
      18,
      {
        color: '#d32f2f',
        fontStyle: 'bold',
        fontFamily: '"Courier New", monospace',
      },
    ).setOrigin(0, 0.5)

    this.faceBg = scene.add.graphics()
    this.faceText = addSharpText(
      scene,
      s(FIELD_WIDTH / 2),
      s(22),
      '🙂',
      20,
    ).setOrigin(0.5)

    const faceHit = this.scene.add
      .zone(s(FIELD_WIDTH / 2), s(22), s(FACE_SIZE), s(FACE_SIZE))
      .setInteractive({ useHandCursor: true })
    faceHit.on('pointerup', () => this.onReset())

    this.drawCounter(this.minesText, '010')
    this.drawCounter(this.timerText, '000')
    this.updateFace('idle')

    this.container.add([
      barBg,
      this.minesText,
      this.timerText,
      this.faceBg,
      this.faceText,
      faceHit,
    ])
  }

  destroy() {
    this.container.destroy(true)
  }

  update(metadata: GameMetadata) {
    this.minesText.setText(this.formatCounter(metadata.minesRemaining))
    this.timerText.setText(this.pad(metadata.elapsedSeconds, 3))
    this.updateFace(metadata.face)
  }

  private formatCounter(value: number) {
    if (value < 0) {
      const abs = Math.abs(value) % 100
      return `-${this.pad(abs, 2)}`
    }
    return this.pad(Math.min(999, value), 3)
  }

  private updateFace(face: GameMetadata['face']) {
    const x = s(FIELD_WIDTH / 2 - FACE_SIZE / 2)
    const y = s(22 - FACE_SIZE / 2)
    this.faceBg.clear()
    drawRaisedRect(
      this.faceBg,
      x,
      y,
      s(FACE_SIZE),
      s(FACE_SIZE),
      COLORS.hiddenCell,
      COLORS.borderLight,
      COLORS.borderDark,
    )

    const emoji = {
      idle: '🙂',
      ohh: '😮',
      win: '😎',
      lose: '😵',
    }[face]
    this.faceText.setText(emoji)
  }

  private drawCounter(text: Phaser.GameObjects.Text, value: string) {
    const bg = this.scene.add.graphics()
    drawSunkenRect(
      bg,
      text.x - s(6),
      text.y - s(COUNTER_HEIGHT / 2),
      s(COUNTER_WIDTH),
      s(COUNTER_HEIGHT),
      0x212121,
      COLORS.borderLight,
      COLORS.borderDark,
    )
    text.setText(value)
    this.container.addAt(bg, 1)
  }

  private pad(value: number, width: number) {
    return String(value).padStart(width, '0')
  }
}
