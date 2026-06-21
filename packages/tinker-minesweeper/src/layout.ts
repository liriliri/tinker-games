import {
  FIELD_WIDTH,
  GAME_CONTAINER_MARGIN_BOTTOM,
  GAME_CONTAINER_MARGIN_TOP,
  GRID_INSET,
  STATUS_BAR_HEIGHT,
  computeGridHeight,
  designCellSize,
} from './game/constants'

export const GAME_CONTAINER_Y = STATUS_BAR_HEIGHT + GAME_CONTAINER_MARGIN_TOP

export const GAME_HEIGHT =
  GAME_CONTAINER_Y + computeGridHeight() + GAME_CONTAINER_MARGIN_BOTTOM

/** Tallest layout (beginner 9×9) — keeps render scale stable across levels. */
export function getReferenceGameHeight() {
  const beginnerGridHeight = GRID_INSET * 2 + designCellSize(9)
  return GAME_CONTAINER_Y + beginnerGridHeight + GAME_CONTAINER_MARGIN_BOTTOM
}

export { FIELD_WIDTH }
