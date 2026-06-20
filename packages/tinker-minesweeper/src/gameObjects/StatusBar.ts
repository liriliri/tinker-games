import Phaser from 'phaser'
import { COLORS, FRAME_BEVEL_SIZE, STATUS_BAR_HEIGHT } from '../game/constants'
import type { GameMetadata } from '../game/GameManager'
import { FIELD_WIDTH } from '../layout'
import { s } from '../scale'
import { drawRaisedRect, drawSunkenRect } from '../ui/drawRoundedRect'
import { addSharpText } from '../ui/sharpText'

const BEVEL = FRAME_BEVEL_SIZE
const FACE_SIZE = 36
const COUNTER_WIDTH = 54
const COUNTER_HEIGHT = 30
const COUNTER_FONT_SIZE = 15
const COUNTER_FACE_GAP = 10
const BAR_CENTER_Y = STATUS_BAR_HEIGHT / 2
const COUNTER_COLOR = '#ff0000'
const COUNTER_BG = 0x000000

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private minesText: Phaser.GameObjects.Text
  private timerText: Phaser.GameObjects.Text
  private faceBg: Phaser.GameObjects.Graphics
  private onReset: () => void

  private readonly faceRect = {
    x: FIELD_WIDTH / 2 - FACE_SIZE / 2,
    y: BAR_CENTER_Y - FACE_SIZE / 2,
  }
  private readonly minesCounter = {
    x: this.faceRect.x - COUNTER_FACE_GAP - COUNTER_WIDTH,
    y: BAR_CENTER_Y - COUNTER_HEIGHT / 2,
  }
  private readonly timerCounter = {
    x: this.faceRect.x + FACE_SIZE + COUNTER_FACE_GAP,
    y: BAR_CENTER_Y - COUNTER_HEIGHT / 2,
  }

  constructor(
    private scene: Phaser.Scene,
    onReset: () => void,
  ) {
    this.onReset = onReset
    this.container = scene.add.container(0, 0)
    this.container.setDepth(10)

    const barBg = scene.add.graphics()
    barBg.fillStyle(COLORS.statusBar, 1)
    barBg.fillRect(0, 0, s(FIELD_WIDTH), s(STATUS_BAR_HEIGHT))

    this.minesText = addSharpText(
      scene,
      s(this.minesCounter.x + COUNTER_WIDTH / 2),
      s(BAR_CENTER_Y),
      '0010',
      COUNTER_FONT_SIZE,
      {
        color: COUNTER_COLOR,
        fontStyle: 'bold',
        fontFamily: '"Lucida Console", "Courier New", monospace',
      },
    ).setOrigin(0.5)

    this.timerText = addSharpText(
      scene,
      s(this.timerCounter.x + COUNTER_WIDTH / 2),
      s(BAR_CENTER_Y),
      '0000',
      COUNTER_FONT_SIZE,
      {
        color: COUNTER_COLOR,
        fontStyle: 'bold',
        fontFamily: '"Lucida Console", "Courier New", monospace',
      },
    ).setOrigin(0.5)

    this.faceBg = scene.add.graphics()

    const faceHit = this.scene.add
      .zone(s(FIELD_WIDTH / 2), s(BAR_CENTER_Y), s(FACE_SIZE), s(FACE_SIZE))
      .setInteractive({ useHandCursor: true })
    faceHit.on('pointerup', () => this.onReset())

    const minesCounterBg = this.createCounterBg(
      this.minesCounter.x,
      this.minesCounter.y,
    )
    const timerCounterBg = this.createCounterBg(
      this.timerCounter.x,
      this.timerCounter.y,
    )
    this.updateFace('idle')

    this.container.add([
      barBg,
      minesCounterBg,
      timerCounterBg,
      this.minesText,
      this.timerText,
      this.faceBg,
      faceHit,
    ])
  }

  destroy() {
    this.container.destroy(true)
  }

  update(metadata: GameMetadata) {
    this.minesText.setText(this.formatCounter(metadata.minesRemaining))
    this.timerText.setText(this.pad(Math.min(9999, metadata.elapsedSeconds), 4))
    this.updateFace(metadata.face)
  }

  private formatCounter(value: number) {
    if (value < 0) {
      const abs = Math.abs(value) % 100
      return `-${this.pad(abs, 2)}`
    }
    return this.pad(Math.min(9999, value), 4)
  }

  private updateFace(face: GameMetadata['face']) {
    const pressed = face === 'ohh'
    const offset = pressed ? s(1) : 0
    const x = s(this.faceRect.x) + offset
    const y = s(this.faceRect.y) + offset
    const size = s(FACE_SIZE)
    const cx = x + size / 2
    const cy = y + size / 2

    this.faceBg.clear()

    if (pressed) {
      drawSunkenRect(
        this.faceBg,
        x,
        y,
        size,
        size,
        COLORS.statusBar,
        COLORS.borderLight,
        COLORS.borderDark,
        s(BEVEL),
      )
    } else {
      drawRaisedRect(
        this.faceBg,
        x,
        y,
        size,
        size,
        COLORS.statusBar,
        COLORS.borderLight,
        COLORS.borderDark,
        s(BEVEL),
      )
    }

    this.drawFaceIcon(this.faceBg, cx, cy, size, face)
  }

  private drawFaceIcon(
    gfx: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    faceSize: number,
    face: GameMetadata['face'],
  ) {
    const bevel = s(BEVEL)
    const inner = faceSize - bevel * 2
    const radius = inner * 0.36
    const eyeOffsetX = radius * 0.4
    const eyeY = cy - radius * 0.16
    const eyeRadius = Math.max(1, inner * 0.05)

    gfx.lineStyle(Math.max(1, inner * 0.04), 0x000000, 1)
    gfx.fillStyle(0xffff00, 1)
    gfx.fillCircle(cx, cy, radius)
    gfx.strokeCircle(cx, cy, radius)

    if (face === 'lose') {
      const mark = eyeRadius * 1.6
      gfx.lineStyle(Math.max(1.2, inner * 0.05), 0x000000, 1)
      gfx.lineBetween(
        cx - eyeOffsetX - mark,
        eyeY - mark,
        cx - eyeOffsetX + mark,
        eyeY + mark,
      )
      gfx.lineBetween(
        cx - eyeOffsetX - mark,
        eyeY + mark,
        cx - eyeOffsetX + mark,
        eyeY - mark,
      )
      gfx.lineBetween(
        cx + eyeOffsetX - mark,
        eyeY - mark,
        cx + eyeOffsetX + mark,
        eyeY + mark,
      )
      gfx.lineBetween(
        cx + eyeOffsetX - mark,
        eyeY + mark,
        cx + eyeOffsetX + mark,
        eyeY - mark,
      )

      const mouthY = cy + radius * 0.38
      gfx.lineStyle(Math.max(1.2, inner * 0.05), 0x000000, 1)
      gfx.beginPath()
      gfx.arc(cx, mouthY, radius * 0.34, 0.15, Math.PI - 0.15, true)
      gfx.strokePath()
      return
    }

    if (face === 'win') {
      const glassW = eyeRadius * 4.8
      const glassH = eyeRadius * 2.4
      gfx.fillStyle(0x000000, 1)
      gfx.fillRect(
        cx - eyeOffsetX - glassW / 2,
        eyeY - glassH / 2,
        glassW,
        glassH,
      )
      gfx.fillRect(
        cx + eyeOffsetX - glassW / 2,
        eyeY - glassH / 2,
        glassW,
        glassH,
      )
      gfx.fillRect(cx - glassW / 2, eyeY - eyeRadius * 0.5, glassW, eyeRadius)

      const mouthY = cy + radius * 0.26
      gfx.lineStyle(Math.max(1.2, inner * 0.05), 0x000000, 1)
      gfx.beginPath()
      gfx.arc(cx, mouthY, radius * 0.34, 0.2, Math.PI - 0.2, false)
      gfx.strokePath()
      return
    }

    gfx.fillStyle(0x000000, 1)
    gfx.fillCircle(cx - eyeOffsetX, eyeY, eyeRadius)
    gfx.fillCircle(cx + eyeOffsetX, eyeY, eyeRadius)

    if (face === 'ohh') {
      gfx.lineStyle(Math.max(1, inner * 0.04), 0x000000, 1)
      gfx.strokeCircle(cx, cy + radius * 0.34, radius * 0.15)
      return
    }

    const mouthY = cy + radius * 0.24
    gfx.lineStyle(Math.max(1.2, inner * 0.05), 0x000000, 1)
    gfx.beginPath()
    gfx.arc(cx, mouthY, radius * 0.34, 0.2, Math.PI - 0.2, false)
    gfx.strokePath()
  }

  private createCounterBg(x: number, y: number) {
    const bg = this.scene.add.graphics()
    drawSunkenRect(
      bg,
      s(x),
      s(y),
      s(COUNTER_WIDTH),
      s(COUNTER_HEIGHT),
      COUNTER_BG,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )
    return bg
  }

  private pad(value: number, width: number) {
    return String(value).padStart(width, '0')
  }
}
