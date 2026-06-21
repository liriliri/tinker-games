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
import { drawCoverCell, drawOpenCell } from '../ui/drawCell'
import { addSharpText, sharpTextStyle } from '../ui/sharpText'
import { cellPosition } from './gridLayout'

interface CellVisual {
  bg: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
  flag: Phaser.GameObjects.Image
  mine: Phaser.GameObjects.Image
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
        this.renderCell(
          board.getCell(row, col),
          this.cells[row][col],
          row,
          col,
          board,
        )
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

    const flagSize = Math.round(this.cellSize * 0.82)
    const flag = this.scene.add
      .image(
        pos.x + this.cellSize / 2,
        pos.y + this.cellSize / 2 - s(1),
        'flag',
      )
      .setDisplaySize(flagSize, flagSize)
      .setOrigin(0.5)
      .setVisible(false)

    const mineSize = Math.round(this.cellSize * 0.82)
    const mine = this.scene.add
      .image(
        pos.x + this.cellSize / 2,
        pos.y + this.cellSize / 2 - s(1),
        'mine',
      )
      .setDisplaySize(mineSize, mineSize)
      .setOrigin(0.5)
      .setVisible(false)

    return { bg, label, flag, mine }
  }

  private renderCell(
    cell: Cell,
    visual: CellVisual,
    row: number,
    col: number,
    board: MinesweeperBoard,
  ) {
    const size = this.cellSize

    visual.bg.clear()
    visual.label.setVisible(false)
    visual.flag.setVisible(false)
    visual.mine.setVisible(false)

    const previewOpen =
      cell.opening && ['cover', 'unknown'].includes(cell.state)
    const useOpenBg =
      previewOpen || !['cover', 'flag', 'unknown'].includes(cell.state)

    if (useOpenBg) {
      this.drawOpenBg(visual.bg, size, row, col, board)
    } else {
      this.drawCoverBg(visual.bg, size)
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
        visual.mine.setTexture('mine')
        visual.mine.setVisible(true)
        break
      case 'die':
        visual.mine.setTexture('explode')
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

  private drawOpenBg(
    gfx: Phaser.GameObjects.Graphics,
    size: number,
    row: number,
    col: number,
    board: MinesweeperBoard,
  ) {
    drawOpenCell(
      gfx,
      0,
      0,
      size,
      COLORS.revealedCell,
      COLORS.borderDark,
      s(CELL_OPEN_BORDER),
      {
        top: row > 0 && this.isRevealed(board.getCell(row - 1, col)),
        left: col > 0 && this.isRevealed(board.getCell(row, col - 1)),
      },
    )
  }

  private isRevealed(cell: Cell) {
    if (cell.opening && ['cover', 'unknown'].includes(cell.state)) {
      return true
    }
    return !['cover', 'flag', 'unknown'].includes(cell.state)
  }
}
