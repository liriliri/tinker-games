import clamp from 'licia/clamp'
import { s } from '../scale'
import {
  CELL_COVER_BORDER,
  CELL_OPEN_BORDER,
  designCellSize,
} from './constants'

const REF_CELL_SIZE = designCellSize(9)

export function scaledCellCoverBorder(cellSize: number) {
  const ref = s(REF_CELL_SIZE)
  return Math.max(1, Math.round((cellSize / ref) * s(CELL_COVER_BORDER)))
}

export function scaledCellOpenBorder(cellSize: number) {
  const ref = s(REF_CELL_SIZE)
  return Math.max(1, Math.round((cellSize / ref) * s(CELL_OPEN_BORDER)))
}

export function scaledCellFontSize() {
  const size = designCellSize()
  const ratio = size < 20 ? 0.34 : size < 35 ? 0.42 : 0.5
  const minSize = size < 20 ? 6 : 8
  return clamp(Math.round(size * ratio), minSize, 22)
}

export function scaledLabelOffsetY(cellSize: number) {
  const size = designCellSize()
  if (size < 20) return Math.max(1, Math.round(cellSize * 0.06))
  if (size < 35) return 0
  return -s(1)
}
