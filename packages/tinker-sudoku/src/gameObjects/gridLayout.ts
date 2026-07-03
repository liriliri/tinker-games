import Phaser from 'phaser'
import { GRID_PADDING, GRID_SIZE } from '../game/constants'
import { GAME_CONTAINER_Y, FIELD_WIDTH } from '../layout'
import { s } from '../scale'

export function computeCellSize() {
  return (s(FIELD_WIDTH) - s(GRID_PADDING) * 2) / GRID_SIZE
}

export function gridOrigin(cellSize: number) {
  return {
    x: s(GRID_PADDING),
    y: s(GAME_CONTAINER_Y + GRID_PADDING),
  }
}

export function cellPosition(row: number, col: number, cellSize: number) {
  const origin = gridOrigin(cellSize)
  return {
    x: origin.x + col * cellSize,
    y: origin.y + row * cellSize,
  }
}

export function boardBounds(cellSize: number) {
  const origin = gridOrigin(cellSize)
  return new Phaser.Geom.Rectangle(
    origin.x,
    origin.y,
    cellSize * 9,
    cellSize * 9,
  )
}

export function boardFrameRect(cellSize: number) {
  const bounds = boardBounds(cellSize)
  const frameY = s(GAME_CONTAINER_Y)

  return {
    x: 0,
    y: frameY,
    width: s(FIELD_WIDTH),
    height: bounds.y - frameY + bounds.height + s(GRID_PADDING),
  }
}

export function positionFromPoint(
  x: number,
  y: number,
  cellSize: number,
): { row: number; col: number } | null {
  const origin = gridOrigin(cellSize)
  const col = Math.floor((x - origin.x) / cellSize)
  const row = Math.floor((y - origin.y) / cellSize)

  if (row < 0 || row >= 9 || col < 0 || col >= 9) {
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
