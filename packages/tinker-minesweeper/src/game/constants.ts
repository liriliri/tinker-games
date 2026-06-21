import { getCurrentLevel } from './levels'

export const FIELD_WIDTH = 500
export const SCENE_GAME = 'Game'
export const GRID_INSET = 4
export const CELL_COVER_BORDER = 4
export const CELL_OPEN_BORDER = 2
export const FRAME_BEVEL_SIZE = 4

export const STATUS_BAR_HEIGHT = 48
export const GAME_CONTAINER_MARGIN_TOP = 8
export const GAME_CONTAINER_MARGIN_BOTTOM = 24
export const TRANSITION_SPEED = 100

export const COLORS = {
  text: '#1a1a1a',
  brightText: '#ffffff',
  pageBackground: '#bdbdbd',
  gameContainer: 0x9e9e9e,
  statusBar: 0xbdbdbd,
  hiddenCell: 0xc0c0c0,
  revealedCell: 0xbdbdbd,
  borderLight: 0xffffff,
  borderDark: 0x7b7b7b,
  button: 0x9e9e9e,
  buttonHover: 0xaaaaaa,
  buttonActive: 0x888888,
  buttonText: '#1a1a1a',
  winOverlay: 0x66bb6a,
  gameOverOverlay: 0xef5350,
}

export const NUMBER_COLORS: Record<number, string> = {
  1: '#1565c0',
  2: '#2e7d32',
  3: '#c62828',
  4: '#283593',
  5: '#4e342e',
  6: '#00838f',
  7: '#212121',
  8: '#616161',
}

export function getNumberColor(value: number): string {
  return NUMBER_COLORS[value] ?? COLORS.text
}

export function designCellSize(cols = getCurrentLevel().cols) {
  return (FIELD_WIDTH - GRID_INSET * 2) / cols
}

export function computeGridHeight() {
  const { rows, cols } = getCurrentLevel()
  return GRID_INSET * 2 + designCellSize(cols) * rows
}
