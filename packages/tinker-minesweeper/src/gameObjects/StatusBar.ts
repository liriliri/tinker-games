import Phaser from 'phaser'
import { COLORS, FRAME_BEVEL_SIZE, STATUS_BAR_HEIGHT } from '../game/constants'
import type { GameMetadata } from '../game/GameManager'
import { FIELD_WIDTH } from '../layout'
import { s } from '../scale'
import { drawRaisedRect, drawSunkenRect } from '../ui/drawRoundedRect'
import { SevenSegmentDisplay } from '../ui/sevenSegmentDisplay'

const BEVEL = FRAME_BEVEL_SIZE
const FACE_SIZE = 36
const FACE_ICON_SCALE = 0.78
const COUNTER_WIDTH = 54
const COUNTER_HEIGHT = 30
const COUNTER_FACE_GAP = 10
const BAR_CENTER_Y = STATUS_BAR_HEIGHT / 2
const COUNTER_BG = 0x000000
const COUNTER_INSET = 4

const FACE_TEXTURES = {
  idle: 'faceidle',
  ohh: 'faceohh',
  win: 'facewin',
  lose: 'facelose',
} as const

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private minesDisplay: SevenSegmentDisplay
  private timerDisplay: SevenSegmentDisplay
  private faceBg: Phaser.GameObjects.Graphics
  private faceIcon: Phaser.GameObjects.Image
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

    this.minesDisplay = new SevenSegmentDisplay(
      scene,
      s(this.minesCounter.x),
      s(this.minesCounter.y),
      s(COUNTER_WIDTH),
      s(COUNTER_HEIGHT),
      { padding: s(COUNTER_INSET) },
    )
    this.minesDisplay.setText('0010')

    this.timerDisplay = new SevenSegmentDisplay(
      scene,
      s(this.timerCounter.x),
      s(this.timerCounter.y),
      s(COUNTER_WIDTH),
      s(COUNTER_HEIGHT),
      { padding: s(COUNTER_INSET) },
    )
    this.timerDisplay.setText('0000')

    this.faceBg = scene.add.graphics()
    this.faceIcon = scene.add.image(0, 0, FACE_TEXTURES.idle)

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
      this.minesDisplay.display,
      this.timerDisplay.display,
      this.faceBg,
      this.faceIcon,
      faceHit,
    ])
  }

  destroy() {
    this.container.destroy(true)
  }

  update(metadata: GameMetadata) {
    this.minesDisplay.setText(this.formatCounter(metadata.minesRemaining))
    this.timerDisplay.setText(
      this.pad(Math.min(9999, metadata.elapsedSeconds), 4),
    )
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

    const inner = size - s(BEVEL) * 2
    const iconSize = inner * FACE_ICON_SCALE
    this.faceIcon.setTexture(FACE_TEXTURES[face])
    this.faceIcon.setPosition(cx, cy)
    this.faceIcon.setDisplaySize(iconSize, iconSize)
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
