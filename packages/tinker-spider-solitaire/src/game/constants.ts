export const FIELD_WIDTH = 880
export const SCENE_GAME = 'Game'

export const NUM_COLUMNS = 10
export const NUM_DECKS = 8
export const CARDS_PER_SUIT = 13
export const TABLEAU_CARDS = 54

export const RANK_2 = 0
export const RANK_Q = 10
export const RANK_K = 11
export const RANK_A = 12

export const NUM_FOUNDATIONS = 8
export const FOUNDATION_START_COL = 2

export const CARD_WIDTH = 71
export const CARD_HEIGHT = 96
export const CARD_OVERLAP = 20
export const CARD_CLOSED_OVERLAP = 7
export const COLUMN_SPACING = 86

export const SLOT_X = 16
export const SLOT_Y = 9
export const SLOT_WIDTH = 70
export const SLOT_HEIGHT = 96

/** Vertical center of stock / foundation cards on the top row. */
export const TOP_ROW_CENTER_Y = SLOT_Y + CARD_HEIGHT / 2

/** Gap between the top row and tableau slots. */
export const TABLEAU_TOP_GAP = 12
export const TABLEAU_SLOT_Y = SLOT_Y + CARD_HEIGHT + TABLEAU_TOP_GAP

/** Base Y passed to tableauCardY (row 0 center = TABLEAU_SLOT_Y + CARD_HEIGHT / 2). */
export const TABLEAU_Y = TABLEAU_SLOT_Y

export const TABLEAU_X = 52

export const STATUS_BAR_HEIGHT = 42
export const STATUS_BAR_WIDTH = 440
export const STATUS_BAR_RADIUS = 10
export const STATUS_BAR_BOTTOM_INSET = 6

/** Stock pile — top-left, column 0 (reference spider stock x=0 y=0). */
export const STOCK_X = TABLEAU_X
export const STOCK_Y = TOP_ROW_CENTER_Y
export const STOCK_X_DELTA = 3
export const STOCK_Y_DELTA = 2

/** Foundation piles — top row columns 2–9 (reference x=2..9 y=0). */
export const FOUNDATION_Y = TOP_ROW_CENTER_Y

export const COMPLETION_CARD_DURATION = 180
export const COMPLETION_CARD_STAGGER = 35

export const DEAL_CARD_DURATION = 150
export const DEAL_CARD_STAGGER = 100

export const COLORS = {
  statusBar: 0x0a3d22,
  statusText: '#e8f5e9',
  statusButton: 0x1b5e34,
  statusButtonHover: 0x237a44,
  statusButtonActive: 0x0f4528,
  statusButtonText: '#ffffff',
  scoreText: '#ffffff',
  dialogBg: 0xf5f5f5,
  dialogBorderDark: 0x7b7b7b,
  dialogText: '#1a1a1a',
  dialogButton: 0x1b5e34,
  dialogButtonHover: 0x237a44,
  dialogButtonText: '#ffffff',
  slotFill: 0x000000,
  slotStroke: 0xffffff,
}

export function slotX(col: number) {
  return SLOT_X + col * COLUMN_SPACING
}

export function columnCenterX(col: number) {
  return TABLEAU_X + col * COLUMN_SPACING
}

export function foundationCenterX(index: number) {
  return columnCenterX(FOUNDATION_START_COL + index)
}
