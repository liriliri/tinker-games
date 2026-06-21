import Phaser from 'phaser'
import contain from 'licia/contain'
import lpad from 'licia/lpad'
import { COLORS, FRAME_BEVEL_SIZE, STATUS_BAR_HEIGHT } from '../game/constants'
import type { GameMetadata } from '../game/GameManager'
import type { LevelId } from '../game/levels'
import { FIELD_WIDTH } from '../layout'
import { getStore } from '../registry'
import { t } from '../i18n'
import { s } from '../scale'
import { drawRaisedRect, drawSunkenRect } from '../ui/drawRoundedRect'
import { SevenSegmentDisplay } from '../ui/sevenSegmentDisplay'
import { addSharpText } from '../ui/sharpText'

const BEVEL = FRAME_BEVEL_SIZE
const FACE_SIZE = 36
const FACE_ICON_SCALE = 0.78
const LEVEL_BUTTON_WIDTH = 84
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

export interface StatusBarCallbacks {
  onReset: () => void
  onLevelClick: () => void
}

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private minesDisplay: SevenSegmentDisplay
  private timerDisplay: SevenSegmentDisplay
  private faceBg: Phaser.GameObjects.Graphics
  private faceIcon: Phaser.GameObjects.Image
  private levelBg: Phaser.GameObjects.Graphics
  private levelText: Phaser.GameObjects.Text
  private soundBg: Phaser.GameObjects.Graphics
  private soundIcon: Phaser.GameObjects.Image
  private soundEnabled: boolean

  private readonly faceRect = {
    x: FIELD_WIDTH / 2 - FACE_SIZE / 2,
    y: BAR_CENTER_Y - FACE_SIZE / 2,
  }
  private readonly levelRect = {
    x: 0,
    y: BAR_CENTER_Y - FACE_SIZE / 2,
    width: LEVEL_BUTTON_WIDTH,
    height: FACE_SIZE,
  }
  private readonly soundRect = {
    x: FIELD_WIDTH - FACE_SIZE,
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
    private callbacks: StatusBarCallbacks,
    initialLevelId: LevelId,
  ) {
    this.soundEnabled = getStore(scene).get('soundEnabled') ?? true
    scene.sound.mute = !this.soundEnabled
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
    this.minesDisplay.setText('0000')

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
    this.levelBg = scene.add.graphics()
    this.levelText = addSharpText(
      scene,
      0,
      0,
      t(`level_${initialLevelId}`),
      10,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(0.5)
    this.soundBg = scene.add.graphics()
    this.soundIcon = scene.add.image(
      0,
      0,
      this.soundEnabled ? 'soundon' : 'soundoff',
    )

    const faceHit = this.scene.add
      .zone(s(FIELD_WIDTH / 2), s(BAR_CENTER_Y), s(FACE_SIZE), s(FACE_SIZE))
      .setInteractive({ useHandCursor: true })
    faceHit.on('pointerup', () => this.callbacks.onReset())

    const levelHit = this.scene.add
      .zone(
        s(this.levelRect.x + this.levelRect.width / 2),
        s(BAR_CENTER_Y),
        s(this.levelRect.width),
        s(this.levelRect.height),
      )
      .setInteractive({ useHandCursor: true })
    levelHit.on('pointerup', () => this.callbacks.onLevelClick())

    const soundHit = this.scene.add
      .zone(
        s(this.soundRect.x + FACE_SIZE / 2),
        s(BAR_CENTER_Y),
        s(FACE_SIZE),
        s(FACE_SIZE),
      )
      .setInteractive({ useHandCursor: true })
    soundHit.on('pointerup', () => {
      this.soundEnabled = !this.soundEnabled
      getStore(this.scene).set('soundEnabled', this.soundEnabled)
      this.scene.sound.mute = !this.soundEnabled
      this.updateSoundButton()
    })

    const minesCounterBg = this.createCounterBg(
      this.minesCounter.x,
      this.minesCounter.y,
    )
    const timerCounterBg = this.createCounterBg(
      this.timerCounter.x,
      this.timerCounter.y,
    )
    this.updateFace('idle')
    this.updateLevelButton(initialLevelId)
    this.updateSoundButton()

    this.container.add([
      barBg,
      minesCounterBg,
      timerCounterBg,
      this.minesDisplay.display,
      this.timerDisplay.display,
      this.levelBg,
      this.levelText,
      this.faceBg,
      this.faceIcon,
      this.soundBg,
      this.soundIcon,
      levelHit,
      faceHit,
      soundHit,
    ])
  }

  destroy() {
    this.container.destroy(true)
  }

  update(metadata: GameMetadata) {
    this.minesDisplay.setText(this.formatCounter(metadata.minesRemaining))
    this.timerDisplay.setText(
      lpad(String(Math.min(9999, metadata.elapsedSeconds)), 4, '0'),
    )
    this.updateFace(metadata.face)
    this.updateLevelButton(metadata.levelId)
  }

  private formatCounter(value: number) {
    if (value < 0) {
      const abs = Math.abs(value) % 100
      return `-${lpad(String(abs), 2, '0')}`
    }
    return lpad(String(Math.min(9999, value)), 4, '0')
  }

  private updateLevelButton(levelId: LevelId) {
    this.levelText.setText(t(`level_${levelId}`))
    this.drawBevelTextButton(
      this.levelBg,
      this.levelRect,
      false,
      this.levelText,
    )
  }

  private updateSoundButton() {
    this.drawBevelButton(this.soundBg, this.soundRect, false, this.soundIcon, {
      texture: this.soundEnabled ? 'soundon' : 'soundoff',
    })
  }

  private updateFace(face: GameMetadata['face']) {
    const pressed = face === 'ohh'
    this.drawBevelButton(this.faceBg, this.faceRect, pressed, this.faceIcon, {
      texture: FACE_TEXTURES[face],
    })
  }

  private drawBevelRect(
    bg: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    pressed: boolean,
  ) {
    bg.clear()
    const draw = pressed ? drawSunkenRect : drawRaisedRect
    draw(
      bg,
      x,
      y,
      width,
      height,
      COLORS.statusBar,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )
  }

  private drawBevelTextButton(
    bg: Phaser.GameObjects.Graphics,
    rect: { x: number; y: number; width: number; height: number },
    pressed: boolean,
    text: Phaser.GameObjects.Text,
  ) {
    const offset = pressed ? s(1) : 0
    const x = s(rect.x) + offset
    const y = s(rect.y) + offset
    const width = s(rect.width)
    const height = s(rect.height)

    this.drawBevelRect(bg, x, y, width, height, pressed)
    text.setOrigin(0.5, 0.5)
    text.setPosition(x + width / 2, y + height / 2)
  }

  private drawBevelButton(
    bg: Phaser.GameObjects.Graphics,
    rect: { x: number; y: number },
    pressed: boolean,
    icon: Phaser.GameObjects.Image,
    options: { texture: string },
  ) {
    const offset = pressed ? s(1) : 0
    const x = s(rect.x) + offset
    const y = s(rect.y) + offset
    const size = s(FACE_SIZE)

    this.drawBevelRect(bg, x, y, size, size, pressed)

    const inner = size - s(BEVEL) * 2
    const iconSize = inner * FACE_ICON_SCALE
    icon.setTexture(options.texture)
    icon.setPosition(x + size / 2, y + size / 2)
    icon.setDisplaySize(iconSize, iconSize)
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
}
