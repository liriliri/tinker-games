import Phaser from 'phaser'
import { COLORS, FRAME_BEVEL_SIZE } from '../game/constants'
import { LEVELS, type LevelConfig, type LevelId } from '../game/levels'
import { t } from '../i18n'
import { s } from '../scale'
import { drawRaisedRect, drawSunkenRect } from '../ui/drawRoundedRect'
import { addSharpText } from '../ui/sharpText'
import { boardBounds, computeCellSize } from './gridLayout'

const PANEL_WIDTH = 280
const PANEL_PADDING = 8
const HEADER_HEIGHT = 32
const HEADER_GAP = 6
const CLOSE_SIZE = 24
const CONTENT_PADDING = 10
const BUTTON_HEIGHT = 38
const BUTTON_GAP = 6
const OPTION_LABEL_GAP = 12
const BEVEL = FRAME_BEVEL_SIZE

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

    this.backdrop = scene.add.graphics()
    this.backdrop.on('pointerup', () => this.hide())

    this.panel = scene.add.container(0, 0)
    this.container.add([this.backdrop, this.panel])
  }

  destroy() {
    this.container.destroy(true)
  }

  show() {
    this.buildPanel()

    const cellSize = computeCellSize()
    const bounds = boardBounds(cellSize)

    this.backdrop.clear()
    this.backdrop.fillStyle(COLORS.statusBar, 0.55)
    this.backdrop.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
      ),
      Phaser.Geom.Rectangle.Contains,
    )

    this.panel.setPosition(bounds.centerX, bounds.centerY)
    this.container.setVisible(true)
  }

  hide() {
    this.container.setVisible(false)
  }

  private buildPanel() {
    this.panel.removeAll(true)

    const options = Object.values(LEVELS)
    const panelWidth = s(PANEL_WIDTH)
    const contentWidth = panelWidth - s(PANEL_PADDING) * 2
    const buttonWidth = contentWidth - s(BEVEL) * 2 - s(CONTENT_PADDING) * 2
    const buttonX = -buttonWidth / 2
    const contentHeight =
      s(CONTENT_PADDING) * 2 +
      options.length * s(BUTTON_HEIGHT) +
      (options.length - 1) * s(BUTTON_GAP)
    const panelHeight =
      s(PANEL_PADDING) * 2 +
      s(HEADER_HEIGHT) +
      s(HEADER_GAP) +
      contentHeight +
      s(BEVEL) * 2

    const left = -panelWidth / 2
    const top = -panelHeight / 2

    const outerBg = this.scene.add.graphics()
    drawRaisedRect(
      outerBg,
      left,
      top,
      panelWidth,
      panelHeight,
      COLORS.statusBar,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )

    const headerY = top + s(PANEL_PADDING)
    const closeRect = {
      x: left + s(PANEL_PADDING),
      y: headerY + (s(HEADER_HEIGHT) - s(CLOSE_SIZE)) / 2,
      size: s(CLOSE_SIZE),
    }
    const closeBg = this.scene.add.graphics()
    this.drawRaisedButton(
      closeBg,
      closeRect.x,
      closeRect.y,
      closeRect.size,
      closeRect.size,
    )

    const closeCenterX = closeRect.x + closeRect.size / 2
    const closeCenterY = closeRect.y + closeRect.size / 2 - s(2)

    const closeLabel = addSharpText(
      this.scene,
      closeCenterX,
      closeCenterY,
      '×',
      16,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(0.5, 0.5)

    const closeHit = this.scene.add
      .zone(
        closeCenterX,
        closeRect.y + closeRect.size / 2,
        closeRect.size,
        closeRect.size,
      )
      .setInteractive({ useHandCursor: true })
    closeHit.on('pointerdown', () => {
      this.drawPressedButton(
        closeBg,
        closeRect.x,
        closeRect.y,
        closeRect.size,
        closeRect.size,
      )
    })
    closeHit.on('pointerup', () => {
      this.drawRaisedButton(
        closeBg,
        closeRect.x,
        closeRect.y,
        closeRect.size,
        closeRect.size,
      )
      this.hide()
    })
    closeHit.on('pointerout', () => {
      this.drawRaisedButton(
        closeBg,
        closeRect.x,
        closeRect.y,
        closeRect.size,
        closeRect.size,
      )
    })

    const title = addSharpText(
      this.scene,
      0,
      headerY + s(HEADER_HEIGHT) / 2,
      t('selectLevel'),
      14,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(0.5, 0.5)

    const contentX = left + s(PANEL_PADDING)
    const contentY = headerY + s(HEADER_HEIGHT) + s(HEADER_GAP)

    const contentBg = this.scene.add.graphics()
    drawSunkenRect(
      contentBg,
      contentX,
      contentY,
      contentWidth,
      contentHeight,
      COLORS.statusBar,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )

    const nodes: Phaser.GameObjects.GameObject[] = [
      outerBg,
      contentBg,
      closeBg,
      closeLabel,
      closeHit,
      title,
    ]

    let buttonY = contentY + s(CONTENT_PADDING)
    for (const level of options) {
      nodes.push(
        this.createOption(
          level,
          buttonX,
          buttonY,
          buttonWidth,
          s(BUTTON_HEIGHT),
        ),
      )
      buttonY += s(BUTTON_HEIGHT + BUTTON_GAP)
    }

    this.panel.add(nodes)
  }

  private createOption(
    level: LevelConfig,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const bg = this.scene.add.graphics()
    this.drawRaisedButton(bg, x, y, width, height)

    const centerX = x + width / 2
    const centerY = y + height / 2
    const gap = s(OPTION_LABEL_GAP)

    const label = addSharpText(
      this.scene,
      centerX - gap / 2,
      centerY,
      t(`level_${level.id}`),
      13,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(1, 0.5)

    const sizeText = addSharpText(
      this.scene,
      centerX + gap / 2,
      centerY,
      `${level.cols}×${level.rows}`,
      13,
      { color: COLORS.text, fontStyle: 'bold' },
    ).setOrigin(0, 0.5)

    const hit = this.scene.add
      .zone(centerX, centerY, width, height)
      .setInteractive({ useHandCursor: true })

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      this.onSelect(level.id)
    })

    return this.scene.add.container(0, 0, [bg, label, sizeText, hit])
  }

  private drawRaisedButton(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    drawRaisedRect(
      gfx,
      x,
      y,
      width,
      height,
      COLORS.hiddenCell,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )
  }

  private drawPressedButton(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    drawSunkenRect(
      gfx,
      x,
      y,
      width,
      height,
      COLORS.hiddenCell,
      COLORS.borderLight,
      COLORS.borderDark,
      s(BEVEL),
    )
  }
}
