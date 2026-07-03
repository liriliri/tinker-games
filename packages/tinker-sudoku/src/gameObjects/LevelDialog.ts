import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { LEVELS, type LevelConfig, type LevelId } from '../game/levels'
import { t } from '../i18n'
import { FIELD_WIDTH, GAME_HEIGHT } from '../layout'
import { s } from '../scale'
import { createButton } from '../ui/createButton'
import { drawElevatedPanel } from '../ui/drawRoundedRect'
import { addSharpText } from '../ui/sharpText'
import {
  createDialogBackdrop,
  hideDialogBackdrop,
  showDialogBackdrop,
} from './dialogBackdrop'

const PANEL_WIDTH = 300
const PANEL_PADDING = 20
const TITLE_HEIGHT = 36
const TITLE_GAP = 16
const BUTTON_HEIGHT = 44
const BUTTON_GAP = 10

export class LevelDialog {
  private container: Phaser.GameObjects.Container
  private backdrop: Phaser.GameObjects.Graphics
  private panel: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private onSelect: (id: LevelId) => void,
  ) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(200)
    this.container.setVisible(false)

    this.backdrop = createDialogBackdrop(scene, () => this.hide())
    this.panel = scene.add.container(0, 0)
    this.container.add([this.backdrop, this.panel])
  }

  destroy() {
    hideDialogBackdrop(this.backdrop)
    this.container.destroy(true)
  }

  show() {
    this.buildPanel()
    showDialogBackdrop(this.backdrop, () => this.hide())
    this.panel.setPosition(s(FIELD_WIDTH / 2), s(GAME_HEIGHT / 2))
    this.container.setVisible(true)
  }

  hide() {
    hideDialogBackdrop(this.backdrop)
    this.container.setVisible(false)
  }

  private buildPanel() {
    this.panel.removeAll(true)

    const options = Object.values(LEVELS)
    const contentHeight =
      options.length * BUTTON_HEIGHT + (options.length - 1) * BUTTON_GAP
    const panelHeight =
      PANEL_PADDING * 2 + TITLE_HEIGHT + TITLE_GAP + contentHeight

    const left = -PANEL_WIDTH / 2
    const top = -panelHeight / 2

    const outerBg = this.scene.add.graphics()
    drawElevatedPanel(
      outerBg,
      s(left),
      s(top),
      s(PANEL_WIDTH),
      s(panelHeight),
      s(16),
      COLORS.gridPaper,
      COLORS.dialogBorder,
      s(1.5),
    )

    const title = addSharpText(
      this.scene,
      s(0),
      s(top + PANEL_PADDING + TITLE_HEIGHT / 2),
      t('selectLevel'),
      18,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(0.5, 0.5)

    const nodes: Phaser.GameObjects.GameObject[] = [outerBg, title]
    let buttonY =
      top + PANEL_PADDING + TITLE_HEIGHT + TITLE_GAP + BUTTON_HEIGHT / 2

    for (const level of options) {
      nodes.push(this.createOption(level, buttonY))
      buttonY += BUTTON_HEIGHT + BUTTON_GAP
    }

    this.panel.add(nodes)
  }

  private createOption(level: LevelConfig, y: number) {
    const button = createButton(
      this.scene,
      t(`level_${level.id}`),
      0,
      y,
      PANEL_WIDTH - PANEL_PADDING * 2,
      BUTTON_HEIGHT,
      15,
      false,
    )
    button.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      this.onSelect(level.id)
    })
    return button
  }
}
