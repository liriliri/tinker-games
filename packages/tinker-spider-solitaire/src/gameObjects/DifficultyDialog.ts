import Phaser from 'phaser'
import type { Difficulty } from '../game/SpiderBoard'
import { COLORS, FIELD_WIDTH } from '../game/constants'
import { GAME_HEIGHT } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { addSharpText } from '../ui/sharpText'

const OPTIONS: {
  difficulty: Difficulty
  key: 'difficulty_easy' | 'difficulty_medium' | 'difficulty_hard'
}[] = [
  { difficulty: 1, key: 'difficulty_easy' },
  { difficulty: 2, key: 'difficulty_medium' },
  { difficulty: 4, key: 'difficulty_hard' },
]

const PANEL_WIDTH = 400
const PANEL_HEIGHT = 320
const BUTTON_WIDTH = 300
const BUTTON_HEIGHT = 52
const BUTTON_GAP = 14

export class DifficultyDialog {
  private container: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private onSelect: (difficulty: Difficulty) => void,
  ) {
    this.container = scene.add.container(0, 0).setDepth(300).setVisible(false)
  }

  destroy() {
    this.container.destroy(true)
  }

  isVisible() {
    return this.container.visible
  }

  show() {
    this.build()
    this.container.setVisible(true)
  }

  hide() {
    this.container.setVisible(false)
  }

  rebuild() {
    if (!this.isVisible()) return
    this.build()
  }

  private build() {
    this.container.removeAll(true)

    const panelWidth = s(PANEL_WIDTH)
    const panelHeight = s(PANEL_HEIGHT)
    const centerX = s(FIELD_WIDTH / 2)
    const centerY = s(GAME_HEIGHT / 2)
    const left = centerX - panelWidth / 2
    const top = centerY - panelHeight / 2

    const panel = this.scene.add.graphics()
    panel.fillStyle(COLORS.dialogBg, 1)
    panel.fillRoundedRect(left, top, panelWidth, panelHeight, s(10))
    panel.lineStyle(s(2), COLORS.dialogBorderDark, 1)
    panel.strokeRoundedRect(
      left + 0.5,
      top + 0.5,
      panelWidth - 1,
      panelHeight - 1,
      s(10),
    )

    const title = addSharpText(
      this.scene,
      centerX,
      top + s(48),
      t('selectDifficulty'),
      20,
      { color: COLORS.dialogText, fontStyle: 'bold' },
    ).setOrigin(0.5)

    const nodes: Phaser.GameObjects.GameObject[] = [panel, title]

    const buttonWidth = s(BUTTON_WIDTH)
    const buttonHeight = s(BUTTON_HEIGHT)
    let buttonY = top + s(96)

    for (const option of OPTIONS) {
      nodes.push(
        this.createOption(
          centerX,
          buttonY,
          buttonWidth,
          buttonHeight,
          t(option.key),
          () => {
            this.onSelect(option.difficulty)
            this.hide()
          },
        ),
      )
      buttonY += buttonHeight + s(BUTTON_GAP)
    }

    this.container.add(nodes)
  }

  private createOption(
    centerX: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
  ) {
    const x = centerX - width / 2
    const bg = this.scene.add.graphics()
    const drawNormal = () => {
      bg.clear()
      bg.fillStyle(COLORS.dialogButton, 1)
      bg.fillRoundedRect(x, y, width, height, s(8))
    }
    drawNormal()

    const text = addSharpText(this.scene, centerX, y + height / 2, label, 16, {
      color: COLORS.dialogButtonText,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const hit = this.scene.add
      .zone(centerX, y + height / 2, width, height)
      .setInteractive({ useHandCursor: true })

    hit.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(COLORS.dialogButtonHover, 1)
      bg.fillRoundedRect(x, y, width, height, s(8))
    })
    hit.on('pointerout', drawNormal)
    hit.on('pointerup', () => {
      drawNormal()
      onClick()
    })

    return this.scene.add.container(0, 0, [bg, text, hit])
  }
}
