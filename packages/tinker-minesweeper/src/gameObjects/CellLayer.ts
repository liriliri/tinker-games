import Phaser from 'phaser'
import {
  COLORS,
  CELL_COVER_BORDER,
  CELL_OPEN_BORDER,
  GRID_COLS,
  GRID_ROWS,
  getNumberColor,
} from '../game/constants'
import type { Cell, MinesweeperBoard } from '../game/MinesweeperBoard'
import { s } from '../scale'
import { drawCoverCell, drawOpenCell, drawPressedCell } from '../ui/drawCell'
import { addSharpText, sharpTextStyle } from '../ui/sharpText'
import { cellPosition } from './gridLayout'

interface CellVisual {
  bg: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  flag: Phaser.GameObjects.Text
  mine: Phaser.GameObjects.Text
}

export class CellLayer {
  private cells: CellVisual[][] = []

  constructor(
    private scene: Phaser.Scene,
    private cellSize: number,
  ) {
    for (let row = 0; row < GRID_ROWS; row++) {
      const rowCells: CellVisual[] = []
      for (let col = 0; col < GRID_COLS; col++) {
        rowCells.push(this.createCellVisual(row, col))
      }
      this.cells.push(rowCells)
    }
  }

  destroy() {
    for (const row of this.cells) {
      for (const cell of row) {
        cell.bg.destroy()
        cell.label.destroy()
        cell.flag.destroy()
        cell.mine.destroy()
      }
    }
    this.cells = []
  }

  render(board: MinesweeperBoard) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.renderCell(board.getCell(row, col), this.cells[row][col])
      }
    }
  }

  private createCellVisual(row: number, col: number): CellVisual {
    const pos = cellPosition({ row, col }, this.cellSize)
    const bg = this.scene.add.graphics()
    bg.setPosition(pos.x, pos.y)

    const label = addSharpText(
      this.scene,
      pos.x + this.cellSize / 2,
      pos.y + this.cellSize / 2 - s(1),
      '',
      22,
      { fontStyle: 'bold' },
    )
      .setOrigin(0.5)
      .setVisible(false)

    const flag = addSharpText(
      this.scene,
      pos.x + this.cellSize / 2,
      pos.y + this.cellSize / 2 - s(1),
      '🚩',
      16,
    )
      .setOrigin(0.5)
      .setVisible(false)

    const mine = addSharpText(
      this.scene,
      pos.x + this.cellSize / 2,
      pos.y + this.cellSize / 2 - s(1),
      '💣',
      16,
    )
      .setOrigin(0.5)
      .setVisible(false)

    return { bg, label, flag, mine }
  }

  private renderCell(cell: Cell, visual: CellVisual) {
    const size = this.cellSize

    visual.bg.clear()
    visual.label.setVisible(false)
    visual.flag.setVisible(false)
    visual.mine.setVisible(false)

    const pressed = cell.opening && ['cover', 'unknown'].includes(cell.state)
    const useOpenBg =
      pressed || !['cover', 'flag', 'unknown'].includes(cell.state)

    if (pressed) {
      this.drawPressedBg(visual.bg, size)
    } else if (useOpenBg) {
      this.drawOpenBg(visual.bg, size, cell.state === 'die')
    } else {
      this.drawCoverBg(visual.bg, size)
    }

    if (pressed) {
      if (cell.state === 'unknown') {
        visual.label.setText('?')
        visual.label.setStyle(sharpTextStyle(14, { color: COLORS.text }))
        visual.label.setVisible(true)
      }
      return
    }

    switch (cell.state) {
      case 'cover':
        break
      case 'flag':
        visual.flag.setVisible(true)
        break
      case 'unknown':
        visual.label.setText('?')
        visual.label.setStyle(sharpTextStyle(14, { color: COLORS.text }))
        visual.label.setVisible(true)
        break
      case 'open':
        if (cell.minesAround > 0) {
          visual.label.setText(String(cell.minesAround))
          visual.label.setStyle(
            sharpTextStyle(22, {
              color: getNumberColor(cell.minesAround),
              fontStyle: 'bold',
            }),
          )
          visual.label.setVisible(true)
        }
        break
      case 'mine':
      case 'die':
        visual.mine.setVisible(true)
        break
      case 'misflagged':
        visual.flag.setVisible(true)
        visual.label.setText('×')
        visual.label.setStyle(sharpTextStyle(16, { color: '#d32f2f' }))
        visual.label.setPosition(visual.flag.x + s(8), visual.flag.y - s(6))
        visual.label.setVisible(true)
        break
    }
  }

  private drawCoverBg(gfx: Phaser.GameObjects.Graphics, size: number) {
    drawCoverCell(
      gfx,
      0,
      0,
      size,
      COLORS.hiddenCell,
      COLORS.borderLight,
      COLORS.borderDark,
      s(CELL_COVER_BORDER),
    )
  }

  private drawPressedBg(gfx: Phaser.GameObjects.Graphics, size: number) {
    drawPressedCell(
      gfx,
      0,
      0,
      size,
      COLORS.hiddenCell,
      COLORS.borderDark,
      s(CELL_OPEN_BORDER),
    )
  }

  private drawOpenBg(
    gfx: Phaser.GameObjects.Graphics,
    size: number,
    exploded = false,
  ) {
    drawOpenCell(
      gfx,
      0,
      0,
      size,
      exploded ? 0xef5350 : COLORS.revealedCell,
      COLORS.borderDark,
      s(CELL_OPEN_BORDER),
    )
  }
}
