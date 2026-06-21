import Phaser from 'phaser'
import contain from 'licia/contain'
import range from 'licia/range'
import {
  COLORS,
  getNumberColor,
} from '../game/constants'
import {
  scaledCellCoverBorder,
  scaledCellFontSize,
  scaledCellOpenBorder,
  scaledLabelOffsetY,
} from '../game/cellMetrics'
import { getCurrentLevel } from '../game/levels'
import type { Cell, CellState, MinesweeperBoard } from '../game/MinesweeperBoard'
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

const COVERED_STATES: CellState[] = ['cover', 'flag', 'unknown']

function isRevealed(cell: Cell) {
  if (cell.opening && contain(['cover', 'unknown'], cell.state)) {
    return true
  }
  return !contain(COVERED_STATES, cell.state)
}

export class CellLayer {
  private cells: CellVisual[][] = []
  private readonly coverBorder: number
  private readonly openBorder: number
  private readonly fontSize: number
  private readonly iconScale: number
  private readonly labelOffsetY: number
  private readonly iconOffsetY: number

  constructor(
    private scene: Phaser.Scene,
    private cellSize: number,
  ) {
    this.coverBorder = scaledCellCoverBorder(cellSize)
    this.openBorder = scaledCellOpenBorder(cellSize)
    this.fontSize = scaledCellFontSize()
    this.iconScale = Math.min(0.82, Math.max(0.62, cellSize / s(54) * 0.82))
    this.iconOffsetY = -s(1)
    this.labelOffsetY = scaledLabelOffsetY(cellSize)

    const { rows, cols } = getCurrentLevel()
    for (const row of range(rows)) {
      const rowCells: CellVisual[] = []
      for (const col of range(cols)) {
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
    const { rows, cols } = getCurrentLevel()
    for (const row of range(rows)) {
      for (const col of range(cols)) {
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

    const centerX = pos.x + this.cellSize / 2
    const labelY = pos.y + this.cellSize / 2 + this.labelOffsetY
    const iconY = pos.y + this.cellSize / 2 + this.iconOffsetY

    const label = addSharpText(
      this.scene,
      centerX,
      labelY,
      '',
      this.fontSize,
      { fontStyle: 'bold' },
    )
      .setOrigin(0.5, 0.5)
      .setVisible(false)

    const iconSize = Math.round(this.cellSize * this.iconScale)
    const flag = this.scene.add
      .image(centerX, iconY, 'flag')
      .setDisplaySize(iconSize, iconSize)
      .setOrigin(0.5)
      .setVisible(false)

    const mine = this.scene.add
      .image(centerX, iconY, 'mine')
      .setDisplaySize(iconSize, iconSize)
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
    visual.label.setPosition(visual.flag.x, visual.flag.y + this.labelOffsetY - this.iconOffsetY)

    if (isRevealed(cell)) {
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
        visual.label.setStyle(
          sharpTextStyle(this.fontSize, { color: COLORS.text }),
        )
        visual.label.setVisible(true)
        break
      case 'open':
        if (cell.minesAround > 0) {
          visual.label.setText(String(cell.minesAround))
          visual.label.setStyle(
            sharpTextStyle(this.fontSize, {
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
        visual.label.setStyle(
          sharpTextStyle(Math.max(8, this.fontSize - 1), { color: '#d32f2f' }),
        )
        visual.label.setPosition(
          visual.flag.x + this.fontSize * 0.35,
          visual.flag.y - this.fontSize * 0.35,
        )
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
      this.coverBorder,
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
      this.openBorder,
      {
        top: row > 0 && isRevealed(board.getCell(row - 1, col)),
        left: col > 0 && isRevealed(board.getCell(row, col - 1)),
      },
    )
  }
}
