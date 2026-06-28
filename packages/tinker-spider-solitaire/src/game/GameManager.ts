import type {
  CompletedStackInfo,
  DealCardInfo,
  Difficulty,
} from './SpiderBoard'
import { SpiderBoard } from './SpiderBoard'

export interface GameMetadata {
  score: number
  moves: number
  stockRemaining: number
  foundationCount: number
  won: boolean
  difficulty: Difficulty
}

export interface Actuator {
  actuate(board: SpiderBoard, metadata: GameMetadata): void
  showDealError(): void
  animateDeal(
    board: SpiderBoard,
    dealt: DealCardInfo[],
    onComplete: () => void,
  ): void
  animateCompletions(
    board: SpiderBoard,
    completions: CompletedStackInfo[],
    onComplete: () => void,
  ): void
}

export class GameManager {
  board: SpiderBoard
  private animating = false

  constructor(private actuator: Actuator) {
    this.board = new SpiderBoard(1)
  }

  startGame(difficulty: Difficulty) {
    this.board = new SpiderBoard(difficulty)
    this.refresh()
  }

  refresh() {
    this.actuator.actuate(this.board, this.metadata())
  }

  metadata(): GameMetadata {
    return {
      score: this.board.score,
      moves: this.board.moves,
      stockRemaining: this.board.stock.length,
      foundationCount: this.board.foundationCount,
      won: this.board.isWon(),
      difficulty: this.board.difficulty,
    }
  }

  dealFromStock(): boolean {
    if (this.animating) return false
    if (!this.board.canDealFromStock()) {
      if (this.board.stock.length > 0) {
        this.actuator.showDealError()
      }
      return false
    }

    const dealt = this.board.dealFromStock()
    if (!dealt) return false

    this.animating = true
    this.refresh()
    this.actuator.animateDeal(this.board, dealt, () => {
      this.runPostAction(this.board.detectCompletedStacks(), true)
    })
    return true
  }

  moveStack(sourceCol: number, startIndex: number, targetCol: number): boolean {
    if (this.animating) return false
    const result = this.board.moveStack(sourceCol, startIndex, targetCol)
    if (!result.ok) return false
    this.finishAction(result.completions)
    return true
  }

  private finishAction(completions: CompletedStackInfo[]) {
    this.refresh()
    this.runPostAction(completions)
  }

  private runPostAction(
    completions: CompletedStackInfo[],
    cardsAlreadyVisible = false,
  ) {
    if (completions.length === 0) {
      this.animating = false
      if (!cardsAlreadyVisible) this.refresh()
      return
    }

    this.actuator.animateCompletions(this.board, completions, () => {
      this.board.applyCompletedStacks(completions)
      this.animating = false
      this.refresh()
    })
  }
}
