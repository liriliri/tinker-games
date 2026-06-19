export const FIELD_WIDTH = 500
export const GRID_SPACING = 15
export const GRID_SIZE = 4
export const TILE_BORDER_RADIUS = 6
export const GAME_CONTAINER_BORDER_RADIUS = 12
export const GAME_CONTAINER_MARGIN_TOP = 20
export const GAME_CONTAINER_MARGIN_BOTTOM = 40
export const TRANSITION_SPEED = 100

export const COLORS = {
  text: '#776e65',
  brightText: '#f9f6f2',
  gameContainer: 0xbbada0,
  cell: 0xcdc1b4,
  scoreLabel: '#eee4da',
  button: 0xbbada0,
  buttonHover: 0xc8bdb0,
  buttonActive: 0xaea092,
  buttonText: '#776e65',
  winOverlay: 0xedc22e,
  gameOverOverlay: 0xeee4da,
}

export interface TileStyle {
  bg: number
  text: string
  fontSize: number
  glow?: number
}

export const TILE_STYLES: Record<number, TileStyle> = {
  2: { bg: 0xeee4da, text: '#776e65', fontSize: 55 },
  4: { bg: 0xede0c8, text: '#776e65', fontSize: 55 },
  8: { bg: 0xf2b179, text: '#f9f6f2', fontSize: 55 },
  16: { bg: 0xf59563, text: '#f9f6f2', fontSize: 55 },
  32: { bg: 0xf67c5f, text: '#f9f6f2', fontSize: 55 },
  64: { bg: 0xf65e3b, text: '#f9f6f2', fontSize: 55 },
  128: { bg: 0xedcf72, text: '#f9f6f2', fontSize: 45, glow: 0.24 },
  256: { bg: 0xedcc61, text: '#f9f6f2', fontSize: 45, glow: 0.32 },
  512: { bg: 0xedc850, text: '#f9f6f2', fontSize: 45, glow: 0.4 },
  1024: { bg: 0xedc53f, text: '#f9f6f2', fontSize: 35, glow: 0.48 },
  2048: { bg: 0xedc22e, text: '#f9f6f2', fontSize: 35, glow: 0.56 },
}

export const SUPER_TILE_STYLE: TileStyle = {
  bg: 0x3c3a32,
  text: '#f9f6f2',
  fontSize: 30,
}

export function getTileStyle(value: number): TileStyle {
  return TILE_STYLES[value] ?? SUPER_TILE_STYLE
}
