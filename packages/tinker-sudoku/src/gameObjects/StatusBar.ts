import Phaser from 'phaser'
import lpad from 'licia/lpad'
import { COLORS } from '../game/constants'
import type { LevelId } from '../game/levels'
import { FIELD_WIDTH, STATUS_BAR_CENTER_Y } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { createButton } from '../ui/createButton'
import { addSharpText } from '../ui/sharpText'

export function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${lpad(String(secs), 2, '0')}`
}

export interface StatusBarCallbacks {
  onLevelClick: () => void
  onHint: () => void
  onReset: () => void
  onNewGame: () => void
}

const ACTION_BUTTON_WIDTH = 52
const ACTION_BUTTON_GAP = 8

export class StatusBar {
  private container: Phaser.GameObjects.Container
  private levelLabel: Phaser.GameObjects.Text
  private levelHit: Phaser.GameObjects.Zone
  private timerLabel: Phaser.GameObjects.Text
  private hintBtn: Phaser.GameObjects.Container
  private resetBtn: Phaser.GameObjects.Container
  private newGameBtn: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private callbacks: StatusBarCallbacks,
  ) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(20)

    this.levelLabel = addSharpText(
      scene,
      s(16),
      s(STATUS_BAR_CENTER_Y),
      '',
      14,
      { color: COLORS.accent, fontStyle: 'bold' },
    ).setOrigin(0, 0.5)

    this.levelHit = scene.add
      .zone(s(16), s(STATUS_BAR_CENTER_Y), s(80), s(28))
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
    this.levelHit.on('pointerup', () => this.callbacks.onLevelClick())

    const centerX = FIELD_WIDTH / 2
    const actionSpan = ACTION_BUTTON_WIDTH * 3 + ACTION_BUTTON_GAP * 2
    const newGameX = centerX - actionSpan / 2 + ACTION_BUTTON_WIDTH / 2
    const resetX = newGameX + ACTION_BUTTON_WIDTH + ACTION_BUTTON_GAP
    const hintX = resetX + ACTION_BUTTON_WIDTH + ACTION_BUTTON_GAP

    this.hintBtn = createButton(
      scene,
      t('hint'),
      hintX,
      STATUS_BAR_CENTER_Y,
      ACTION_BUTTON_WIDTH,
      28,
      12,
    )
    this.hintBtn.on('pointerup', () => this.callbacks.onHint())

    this.resetBtn = createButton(
      scene,
      t('reset'),
      resetX,
      STATUS_BAR_CENTER_Y,
      ACTION_BUTTON_WIDTH,
      28,
      12,
    )
    this.resetBtn.on('pointerup', () => this.callbacks.onReset())

    this.newGameBtn = createButton(
      scene,
      t('newGame'),
      newGameX,
      STATUS_BAR_CENTER_Y,
      ACTION_BUTTON_WIDTH,
      28,
      12,
      true,
    )
    this.newGameBtn.on('pointerup', () => this.callbacks.onNewGame())

    this.timerLabel = addSharpText(
      scene,
      s(FIELD_WIDTH - 16),
      s(STATUS_BAR_CENTER_Y),
      formatElapsed(0),
      14,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(1, 0.5)

    this.container.add([
      this.levelLabel,
      this.levelHit,
      this.newGameBtn,
      this.resetBtn,
      this.hintBtn,
      this.timerLabel,
    ])
  }

  destroy() {
    this.container.destroy(true)
  }

  update(
    levelId: LevelId,
    elapsedSeconds: number,
    canReset: boolean,
    canHint: boolean,
  ) {
    this.levelLabel.setText(t(`level_${levelId}`))
    this.timerLabel.setText(formatElapsed(elapsedSeconds))

    const labelWidth = Math.max(this.levelLabel.width, s(48))
    this.levelHit.setSize(labelWidth + s(12), s(28))

    this.setButtonEnabled(this.hintBtn, canHint)
    this.setButtonEnabled(this.resetBtn, canReset)
  }

  private setButtonEnabled(
    button: Phaser.GameObjects.Container,
    enabled: boolean,
  ) {
    button.setAlpha(enabled ? 1 : 0.35)
    if (enabled) {
      button.setInteractive()
    } else {
      button.disableInteractive()
    }
  }
}
