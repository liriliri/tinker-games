import { FIELD_WIDTH, GRID_PADDING, GRID_SIZE } from '../game/constants'

export function designCellSize() {
  return (FIELD_WIDTH - GRID_PADDING * 2) / GRID_SIZE
}

export function computeGridPixelSize() {
  return designCellSize() * GRID_SIZE
}
