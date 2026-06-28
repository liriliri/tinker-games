import {
  CARDS_PER_SUIT,
  NUM_COLUMNS,
  NUM_DECKS,
  NUM_FOUNDATIONS,
  RANK_2,
  RANK_A,
  RANK_K,
  RANK_Q,
  TABLEAU_CARDS,
} from './constants'

export type Difficulty = 1 | 2 | 4

interface FoundationSlot {
  suit: number
}

export interface Card {
  id: number
  suit: number
  rank: number
  faceUp: boolean
}

export interface DealCardInfo {
  card: Card
  col: number
}

export interface CompletedStackInfo {
  col: number
  startIndex: number
  suit: number
  foundationSlot: number
}

export type MoveResult =
  | { ok: true; completions: CompletedStackInfo[] }
  | { ok: false; reason: 'invalid' }

function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function isCardIdxFollowing(
  lowerRank: number,
  upperRank: number,
  respectSuit: boolean,
  lowerSuit?: number,
  upperSuit?: number,
): boolean {
  if (
    respectSuit &&
    lowerSuit !== undefined &&
    upperSuit !== undefined &&
    lowerSuit !== upperSuit
  ) {
    return false
  }
  if (upperRank <= RANK_Q && lowerRank === upperRank + 1) return true
  if (upperRank === RANK_A && lowerRank === RANK_2) return true
  return false
}

function isSameSuitDescending(cards: Card[]): boolean {
  if (cards.length <= 1) return true
  for (let i = 0; i < cards.length - 1; i++) {
    const lower = cards[i]
    const upper = cards[i + 1]
    if (
      !isCardIdxFollowing(lower.rank, upper.rank, true, lower.suit, upper.suit)
    ) {
      return false
    }
  }
  return true
}

export class SpiderBoard {
  tableau: Card[][]
  stock: Card[]
  foundations: Array<FoundationSlot | null>
  foundationCount = 0
  score = 500
  moves = 0
  difficulty: Difficulty

  constructor(difficulty: Difficulty = 1) {
    this.difficulty = difficulty
    this.tableau = Array.from({ length: NUM_COLUMNS }, () => [])
    this.stock = []
    this.foundations = Array.from({ length: NUM_FOUNDATIONS }, () => null)
    this.dealNewGame()
  }

  dealNewGame() {
    this.foundationCount = 0
    this.foundations = Array.from({ length: NUM_FOUNDATIONS }, () => null)
    this.score = 500
    this.moves = 0
    this.tableau = Array.from({ length: NUM_COLUMNS }, () => [])
    this.stock = []

    const cards = this.createDeck()
    const shuffled = shuffle(cards)

    for (let i = 0; i < TABLEAU_CARDS; i++) {
      const col = i % NUM_COLUMNS
      const card = shuffled[i]
      card.faceUp = false
      this.tableau[col].push(card)
    }

    for (let col = 0; col < NUM_COLUMNS; col++) {
      const column = this.tableau[col]
      if (column.length > 0) {
        column[column.length - 1].faceUp = true
      }
    }

    this.stock = shuffled.slice(TABLEAU_CARDS)
  }

  private createDeck(): Card[] {
    const cards: Card[] = []
    let id = 0
    for (let deck = 0; deck < NUM_DECKS; deck++) {
      const suit = deck % this.difficulty
      for (let rank = 0; rank < CARDS_PER_SUIT; rank++) {
        cards.push({ id: id++, suit, rank, faceUp: false })
      }
    }
    return cards
  }

  isWon() {
    return this.foundationCount >= NUM_FOUNDATIONS
  }

  canDealFromStock() {
    if (this.stock.length === 0) return false
    return this.tableau.every((col) => col.length > 0)
  }

  dealFromStock(): DealCardInfo[] | null {
    if (!this.canDealFromStock()) return null

    const dealt: DealCardInfo[] = []
    for (let col = 0; col < NUM_COLUMNS; col++) {
      const card = this.stock.pop()
      if (!card) break
      card.faceUp = true
      dealt.push({ card, col })
    }

    this.score = Math.max(0, this.score - 1)
    this.moves++
    return dealt
  }

  applyDeal(dealt: DealCardInfo[]) {
    for (const { card, col } of dealt) {
      this.tableau[col].push(card)
    }
  }

  detectCompletedStacks(): CompletedStackInfo[] {
    const result: CompletedStackInfo[] = []
    const reservedSlots = [...this.foundations]

    for (let col = 0; col < NUM_COLUMNS; col++) {
      const completed = this.findCompletedStack(col)
      if (!completed) continue

      const slotIndex = reservedSlots.findIndex((slot) => slot === null)
      if (slotIndex < 0) continue

      const slice = this.tableau[col].slice(
        completed.startIndex,
        completed.startIndex + CARDS_PER_SUIT,
      )
      reservedSlots[slotIndex] = { suit: slice[0].suit }
      result.push({
        col,
        startIndex: completed.startIndex,
        suit: slice[0].suit,
        foundationSlot: slotIndex,
      })
    }

    return result
  }

  applyCompletedStacks(infos: CompletedStackInfo[]) {
    for (const info of infos) {
      this.tableau[info.col].splice(info.startIndex, CARDS_PER_SUIT)
      this.foundations[info.foundationSlot] = { suit: info.suit }
      this.foundationCount++
      this.score += 100

      const column = this.tableau[info.col]
      if (column.length > 0) {
        const top = column[column.length - 1]
        if (!top.faceUp) top.faceUp = true
      }
    }
  }

  isValidMoveStack(col: number, startIndex: number): boolean {
    const column = this.tableau[col]
    if (startIndex < 0 || startIndex >= column.length) return false

    const card = column[startIndex]
    if (!card.faceUp) return false

    const above = column[startIndex + 1]
    if (!above) return true

    if (above.suit !== card.suit) return false
    if (
      !isCardIdxFollowing(card.rank, above.rank, true, card.suit, above.suit)
    ) {
      return false
    }
    return this.isValidMoveStack(col, startIndex + 1)
  }

  canPlaceStack(
    sourceCol: number,
    startIndex: number,
    targetCol: number,
  ): boolean {
    if (sourceCol === targetCol) return false
    if (!this.isValidMoveStack(sourceCol, startIndex)) return false

    const stack = this.tableau[sourceCol].slice(startIndex)
    const targetColumn = this.tableau[targetCol]
    const targetTop =
      targetColumn.length > 0 ? targetColumn[targetColumn.length - 1] : null

    if (!targetTop) return true
    if (!targetTop.faceUp) return false
    if (targetTop.rank === RANK_A) return false

    const movingBottom = stack[0]
    if (movingBottom.rank === RANK_A && targetTop.rank === RANK_2) return true
    return movingBottom.rank + 1 === targetTop.rank
  }

  moveStack(
    sourceCol: number,
    startIndex: number,
    targetCol: number,
  ): MoveResult {
    if (!this.canPlaceStack(sourceCol, startIndex, targetCol)) {
      return { ok: false, reason: 'invalid' }
    }

    const sourceColumn = this.tableau[sourceCol]
    const stack = sourceColumn.splice(startIndex)
    this.tableau[targetCol].push(...stack)

    const sourceAfter = this.tableau[sourceCol]
    if (sourceAfter.length > 0) {
      const top = sourceAfter[sourceAfter.length - 1]
      if (!top.faceUp) top.faceUp = true
    }

    this.score = Math.max(0, this.score - 1)
    this.moves++
    return { ok: true, completions: this.detectCompletedStacks() }
  }

  private findCompletedStack(col: number): { startIndex: number } | null {
    const column = this.tableau[col]
    for (let i = 0; i <= column.length - CARDS_PER_SUIT; i++) {
      const slice = column.slice(i, i + CARDS_PER_SUIT)
      if (slice.length !== CARDS_PER_SUIT) continue
      if (!slice.every((c) => c.faceUp)) continue
      if (slice[0].rank !== RANK_K) continue
      if (!isSameSuitDescending(slice)) continue
      if (slice[12].rank !== RANK_A) continue
      return { startIndex: i }
    }
    return null
  }
}
