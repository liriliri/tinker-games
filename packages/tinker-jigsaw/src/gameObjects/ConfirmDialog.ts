import Phaser from 'phaser'
import max from 'licia/max'
import { COLORS } from '../game/constants'
import { t } from '../lib/i18n'
import { FIELD_WIDTH, GAME_HEIGHT } from '../lib/layout'
import { s } from '../lib/scale'
import { createTextButton } from '../ui/createTextButton'
import { addSharpText } from '../ui/sharpText'

const PANEL_WIDTH = 260
const PANEL_HEIGHT = 104
const BUTTON_WIDTH = 78
const BUTTON_HEIGHT = 22
const DIALOG_DEPTH = 100000

export class ConfirmDialog {
  private readonly nodes: Phaser.GameObjects.GameObject[]

  constructor(
    scene: Phaser.Scene,
    message: string,
    onConfirm: () => void,
    onCancel: () => void,
    labels?: { confirm?: string; cancel?: string },
  ) {
    const fieldW = s(FIELD_WIDTH)
    const fieldH = s(GAME_HEIGHT)
    const panelX = (FIELD_WIDTH - PANEL_WIDTH) / 2
    const panelY = (GAME_HEIGHT - PANEL_HEIGHT) / 2
    const veil = scene.add.graphics().setDepth(DIALOG_DEPTH)
    veil.fillStyle(0x000000, 0.5)
    veil.fillRect(0, 0, fieldW, fieldH)
    veil.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, fieldW, fieldH),
      Phaser.Geom.Rectangle.Contains,
    )
    let veilPressed = false
    veil.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        veilPressed = true
        event.stopPropagation()
      },
    )
    veil.on(
      'pointerup',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
        if (!veilPressed) return
        veilPressed = false
        onCancel()
      },
    )

    const panel = scene.add.graphics().setDepth(DIALOG_DEPTH + 1)
    panel.fillStyle(0x221f1c, 0.98)
    panel.fillRoundedRect(
      s(panelX),
      s(panelY),
      s(PANEL_WIDTH),
      s(PANEL_HEIGHT),
      s(3),
    )
    panel.lineStyle(max(1, s(1)), COLORS.brass, 0.5)
    panel.strokeRoundedRect(
      s(panelX),
      s(panelY),
      s(PANEL_WIDTH),
      s(PANEL_HEIGHT),
      s(3),
    )
    panel.setInteractive(
      new Phaser.Geom.Rectangle(
        s(panelX),
        s(panelY),
        s(PANEL_WIDTH),
        s(PANEL_HEIGHT),
      ),
      Phaser.Geom.Rectangle.Contains,
    )
    panel.on(
      'pointerdown',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        veilPressed = false
        event.stopPropagation()
      },
    )
    panel.on(
      'pointerup',
      (
        _pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation()
      },
    )

    const label = addSharpText(
      scene,
      s(FIELD_WIDTH / 2),
      s(panelY + 34),
      message,
      14,
      { color: COLORS.paper },
    )
      .setOrigin(0.5)
      .setDepth(DIALOG_DEPTH + 2)

    const buttonY = panelY + 74
    const cancel = createTextButton(
      scene,
      labels?.cancel ?? t('cancel'),
      FIELD_WIDTH / 2 - BUTTON_WIDTH / 2 - 6,
      buttonY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      onCancel,
      { fontSize: 12 },
    ).setDepth(DIALOG_DEPTH + 3)
    const confirm = createTextButton(
      scene,
      labels?.confirm ?? t('confirm'),
      FIELD_WIDTH / 2 + BUTTON_WIDTH / 2 + 6,
      buttonY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      onConfirm,
      { brass: true, fontSize: 12 },
    ).setDepth(DIALOG_DEPTH + 3)

    this.nodes = [veil, panel, label, cancel, confirm]
  }

  destroy() {
    for (const node of this.nodes) node.destroy()
  }
}
