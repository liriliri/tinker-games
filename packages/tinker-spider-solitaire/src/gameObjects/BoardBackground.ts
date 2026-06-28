import Phaser from 'phaser'
import {
  CARD_CLOSED_OVERLAP,
  CARD_HEIGHT,
  CARD_OVERLAP,
  COLORS,
  FOUNDATION_START_COL,
  NUM_COLUMNS,
  NUM_FOUNDATIONS,
  SLOT_HEIGHT,
  SLOT_WIDTH,
  SLOT_Y,
  slotX,
  TABLEAU_SLOT_Y,
} from '../game/constants'
import { s } from '../scale'

const SLOT_RADIUS = 4

export class BoardBackground {
  private container: Phaser.GameObjects.Container

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(-10)
    this.build()
  }

  destroy() {
    this.container.destroy(true)
  }

  rebuild() {
    this.container.destroy(true)
    this.container = this.scene.add.container(0, 0).setDepth(-10)
    this.build()
  }

  private build() {
    for (let i = 0; i < NUM_FOUNDATIONS; i++) {
      this.container.add(
        this.drawSlot(s(slotX(FOUNDATION_START_COL + i)), s(SLOT_Y)),
      )
    }

    for (let col = 0; col < NUM_COLUMNS; col++) {
      this.container.add(this.drawSlot(s(slotX(col)), s(TABLEAU_SLOT_Y)))
    }
  }

  private drawSlot(x: number, y: number) {
    const w = s(SLOT_WIDTH)
    const h = s(SLOT_HEIGHT)
    const radius = s(SLOT_RADIUS)
    const g = this.scene.add.graphics()

    g.fillStyle(COLORS.slotFill, 0.18)
    g.fillRoundedRect(x, y, w, h, radius)
    g.lineStyle(s(1), COLORS.slotStroke, 0.22)
    g.strokeRoundedRect(x, y, w, h, radius)

    return g
  }
}

export function tableauCardY(
  column: { faceUp: boolean }[],
  row: number,
): number {
  const firstFaceUp = column.findIndex((c) => c.faceUp)
  const closedStep = CARD_CLOSED_OVERLAP

  if (firstFaceUp === -1) {
    return CARD_HEIGHT / 2 + row * closedStep
  }

  if (row < firstFaceUp) {
    return CARD_HEIGHT / 2 + row * closedStep
  }

  const faceUpBase = CARD_HEIGHT / 2 + firstFaceUp * closedStep
  return faceUpBase + (row - firstFaceUp) * CARD_OVERLAP
}
