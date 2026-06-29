import {
  CELL_R,
  GRID_H,
  GRID_W,
  GRID_MARGIN_TOP,
  HEADER_HEIGHT,
} from './game/constants'

export const GAME_WIDTH = Math.floor((6.5 + 2 * GRID_W) * CELL_R)
export const GRID_HEIGHT = Math.floor((6 + Math.sqrt(3) * GRID_H) * CELL_R)
export const GAME_HEIGHT = GRID_HEIGHT + HEADER_HEIGHT + GRID_MARGIN_TOP
