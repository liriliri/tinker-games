import Phaser from 'phaser'
import { GAME_CONTAINER_MARGIN_BOTTOM, GRID_INSET } from '../game/constants'
import { getCurrentLevel } from '../game/levels'
import type { Position } from '../game/MinesweeperBoard'
import { GAME_CONTAINER_Y, FIELD_WIDTH } from '../layout'
import { s } from '../scale'

export function computeCellSize() {
  const { cols } = getCurrentLevel()
  const inner = s(FIELD_WIDTH - GRID_INSET * 2)
  return inner / cols
}

export function gridOrigin(cellSize: number) {
  return {
    x: s(GRID_INSET),
    y: s(GAME_CONTAINER_Y + GRID_INSET),
  }
}

export function cellPosition(position: Position, cellSize: number) {
  const origin = gridOrigin(cellSize)
  return {
    x: origin.x + position.col * cellSize,
    y: origin.y + position.row * cellSize,
  }
}

export function boardBounds(cellSize: number) {
  const { rows, cols } = getCurrentLevel()
  const origin = gridOrigin(cellSize)
  return new Phaser.Geom.Rectangle(
    origin.x,
    origin.y,
    cellSize * cols,
    cellSize * rows,
  )
}

export function boardFrameRect(cellSize: number) {
  const bounds = boardBounds(cellSize)
  const frameY = s(GAME_CONTAINER_Y)

  return {
    x: 0,
    y: frameY,
    width: s(FIELD_WIDTH),
    height: bounds.y - frameY + bounds.height + s(GRID_INSET),
  }
}

export function computeGamePixelHeight(cellSize: number) {
  const frame = boardFrameRect(cellSize)
  return frame.y + frame.height + s(GAME_CONTAINER_MARGIN_BOTTOM)
}

export function positionFromPoint(
  x: number,
  y: number,
  cellSize: number,
): Position | null {
  const { rows, cols } = getCurrentLevel()
  const origin = gridOrigin(cellSize)
  const col = Math.floor((x - origin.x) / cellSize)
  const row = Math.floor((y - origin.y) / cellSize)

  if (row < 0 || row >= rows || col < 0 || col >= cols) {
    return null
  }

  const cellX = origin.x + col * cellSize
  const cellY = origin.y + row * cellSize
  if (
    x < cellX ||
    x >= cellX + cellSize ||
    y < cellY ||
    y >= cellY + cellSize
  ) {
    return null
  }

  return { row, col }
}
