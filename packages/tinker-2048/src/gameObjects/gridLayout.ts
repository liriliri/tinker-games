import Phaser from 'phaser'
import { GRID_SPACING, GRID_SIZE } from '../game/constants'
import { GAME_CONTAINER_Y, FIELD_WIDTH } from '../layout'
import type { Position } from '../game/Tile'
import { s } from '../scale'

export function computeTileSize() {
  const spacing = s(GRID_SPACING)
  const field = s(FIELD_WIDTH)
  return Math.floor((field - spacing * (GRID_SIZE + 1)) / GRID_SIZE)
}

export function tilePosition(position: Position, tileSize: number) {
  return {
    x: s(GRID_SPACING) + position.x * (tileSize + s(GRID_SPACING)),
    y:
      s(GAME_CONTAINER_Y) +
      s(GRID_SPACING) +
      position.y * (tileSize + s(GRID_SPACING)),
  }
}

export function boardBounds() {
  return new Phaser.Geom.Rectangle(
    s(GRID_SPACING),
    s(GAME_CONTAINER_Y),
    s(FIELD_WIDTH),
    s(FIELD_WIDTH),
  )
}
