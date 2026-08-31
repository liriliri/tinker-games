import Phaser from 'phaser'
import { COLORS, GRID_FRAME_RADIUS, GRID_PADDING } from '../game/constants'
import type { CellState } from '../game/GameManager'
import type { Grid } from '../game/SudokuEngine'
import type { CellPos } from '../game/SudokuEngine'
import { GAME_CONTAINER_Y } from '../lib/layout'
import { s } from '../lib/scale'
import { fillSmoothRoundedRect } from '../ui/drawRoundedRect'
import { addCenteredDigitText } from '../ui/sharpText'
import {
  boardBounds,
  boardFrameRect,
  cellPosition,
  computeCellSize,
} from './gridLayout'

const CELL_TEXT_DEPTH = 2

export class SudokuBoard {
  readonly cellSize: number
  readonly bounds: Phaser.Geom.Rectangle
  private container: Phaser.GameObjects.Container
  private frameGfx: Phaser.GameObjects.Graphics
  private cellGfx: Phaser.GameObjects.Graphics
  private lineGfx: Phaser.GameObjects.Graphics
  private digitTexts: Phaser.GameObjects.Text[][] = []

  constructor(private scene: Phaser.Scene) {
    this.cellSize = computeCellSize()
    this.bounds = boardBounds(this.cellSize)
    this.container = scene.add.container(0, 0)
    this.frameGfx = scene.add.graphics()
    this.cellGfx = scene.add.graphics()
    this.lineGfx = scene.add.graphics().setDepth(1)
    this.container.add([this.frameGfx, this.cellGfx, this.lineGfx])
    this.drawFrame()
    this.initDigitTexts()
  }

  destroy() {
    this.container.destroy(true)
  }

  render(cells: CellState[][], selected: CellPos | null, initialPuzzle: Grid) {
    this.drawCells(cells, selected, initialPuzzle)
    this.drawLines()
    this.updateDigits(cells)
  }

  private drawFrame() {
    const frame = boardFrameRect(this.cellSize)
    const radius = s(GRID_FRAME_RADIUS)

    this.frameGfx.clear()
    this.frameGfx.fillStyle(0x1e3a5f, 0.07)
    this.frameGfx.fillRoundedRect(
      frame.x + s(1),
      frame.y + s(2),
      frame.width,
      frame.height,
      radius,
    )
    fillSmoothRoundedRect(
      this.frameGfx,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      radius,
      COLORS.gridPaper,
    )
    this.frameGfx.lineStyle(s(2), COLORS.gridFrame, 1)
    const border = s(1)
    this.frameGfx.strokeRoundedRect(
      frame.x + border,
      frame.y + border,
      frame.width - border * 2,
      frame.height - border * 2,
      radius,
    )
  }

  private drawCells(
    cells: CellState[][],
    selected: CellPos | null,
    initialPuzzle: Grid,
  ) {
    this.cellGfx.clear()
    const selectedValue =
      selected && cells[selected.row][selected.col].value > 0
        ? cells[selected.row][selected.col].value
        : null

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const pos = cellPosition(row, col, this.cellSize)
        const cell = cells[row][col]
        let fill: number | null = null

        if (selected && selected.row === row && selected.col === col) {
          fill = COLORS.selectedCell
        } else if (selected) {
          const sameRow = selected.row === row
          const sameCol = selected.col === col
          const sameBox =
            Math.floor(selected.row / 3) === Math.floor(row / 3) &&
            Math.floor(selected.col / 3) === Math.floor(col / 3)
          const sameDigit =
            selectedValue !== null &&
            cell.value === selectedValue &&
            cell.value > 0
          if (sameRow || sameCol || sameBox || sameDigit) {
            fill = COLORS.relatedCell
          }
        }

        if (initialPuzzle[row][col] > 0) {
          this.cellGfx.fillStyle(0x4a6fa5, 0.05)
          this.cellGfx.fillRect(pos.x, pos.y, this.cellSize, this.cellSize)
        }

        if (fill !== null) {
          this.cellGfx.fillStyle(fill, 1)
          this.cellGfx.fillRect(pos.x, pos.y, this.cellSize, this.cellSize)
        }
      }
    }
  }

  private drawLines() {
    this.lineGfx.clear()
    const origin = {
      x: s(GRID_PADDING),
      y: s(GAME_CONTAINER_Y + GRID_PADDING),
    }
    const gridSize = this.cellSize * 9

    this.lineGfx.lineStyle(s(1), COLORS.gridLine, 1)
    for (let i = 1; i < 9; i++) {
      if (i % 3 === 0) continue
      const offset = origin.x + i * this.cellSize
      this.lineGfx.beginPath()
      this.lineGfx.moveTo(offset, origin.y)
      this.lineGfx.lineTo(offset, origin.y + gridSize)
      this.lineGfx.strokePath()

      const yOffset = origin.y + i * this.cellSize
      this.lineGfx.beginPath()
      this.lineGfx.moveTo(origin.x, yOffset)
      this.lineGfx.lineTo(origin.x + gridSize, yOffset)
      this.lineGfx.strokePath()
    }

    this.lineGfx.lineStyle(s(2.5), COLORS.gridLineBold, 1)
    for (let i = 0; i <= 9; i += 3) {
      const offset = origin.x + i * this.cellSize
      this.lineGfx.beginPath()
      this.lineGfx.moveTo(offset, origin.y)
      this.lineGfx.lineTo(offset, origin.y + gridSize)
      this.lineGfx.strokePath()

      const yOffset = origin.y + i * this.cellSize
      this.lineGfx.beginPath()
      this.lineGfx.moveTo(origin.x, yOffset)
      this.lineGfx.lineTo(origin.x + gridSize, yOffset)
      this.lineGfx.strokePath()
    }
  }

  private initDigitTexts() {
    this.digitTexts = []
    const texts: Phaser.GameObjects.Text[] = []
    for (let row = 0; row < 9; row++) {
      const rowTexts: Phaser.GameObjects.Text[] = []
      for (let col = 0; col < 9; col++) {
        const pos = cellPosition(row, col, this.cellSize)
        const text = addCenteredDigitText(
          this.scene,
          pos.x + this.cellSize / 2,
          pos.y + this.cellSize / 2,
          '',
          30,
          { color: COLORS.givenDigit },
          this.cellSize,
          true,
        ).setDepth(CELL_TEXT_DEPTH)
        rowTexts.push(text)
        texts.push(text)
      }
      this.digitTexts.push(rowTexts)
    }
    this.container.add(texts)
  }

  private updateDigits(cells: CellState[][]) {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const cell = cells[row][col]
        const text = this.digitTexts[row][col]
        if (cell.value === 0) {
          text.setText('')
          continue
        }

        text.setText(String(cell.value))
        text.setColor(
          cell.kind === 'given' ? COLORS.givenDigit : COLORS.userDigit,
        )
      }
    }
  }
}
