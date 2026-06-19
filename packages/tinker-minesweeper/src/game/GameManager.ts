import Phaser from 'phaser'
import { GRID_COLS, GRID_ROWS, MINE_COUNT } from './constants'
import { LocalStorageManager } from './LocalStorageManager'
import { MinesweeperBoard, type GameResult } from './MinesweeperBoard'

export interface GameMetadata {
  elapsedSeconds: number
  minesRemaining: number
  bestTime: number | null
  face: 'idle' | 'ohh' | 'win' | 'lose'
  terminated: boolean
  won: boolean
  over: boolean
}

export interface Actuator {
  actuate(board: MinesweeperBoard, metadata: GameMetadata): void
}

export class GameManager {
  board: MinesweeperBoard
  elapsedSeconds = 0
  private timerEvent?: Phaser.Time.TimerEvent
  private timerRunning = false
  private face: GameMetadata['face'] = 'idle'

  constructor(
    private storage: LocalStorageManager,
    private actuator: Actuator,
  ) {
    this.board = new MinesweeperBoard(GRID_ROWS, GRID_COLS, MINE_COUNT)
  }

  refresh() {
    this.actuator.actuate(this.board, this.metadata())
  }

  restart() {
    this.stopTimer()
    this.elapsedSeconds = 0
    this.face = 'idle'
    this.board.reset()
    this.refresh()
  }

  openCeil(row: number, col: number): GameResult {
    if (this.board.isTerminated()) return 'continue'

    const wasNew = this.board.status === 'new'
    const result = this.board.openCeil(row, col)

    if (wasNew && this.board.status === 'started') {
      this.startTimer()
    }

    this.updateFace(result)
    this.refresh()
    return result
  }

  openCeils(row: number, col: number): GameResult {
    if (this.board.isTerminated()) return 'continue'

    const result = this.board.openCeils(row, col)
    this.updateFace(result)
    this.refresh()
    return result
  }

  changeCeilState(row: number, col: number) {
    if (this.board.isTerminated()) return
    if (this.board.changeCeilState(row, col)) {
      this.refresh()
    }
  }

  previewOpen(row: number, col: number) {
    if (this.board.isTerminated()) return
    this.board.openingCeil(row, col)
    this.face = 'ohh'
    this.refresh()
  }

  previewCeils(row: number, col: number) {
    if (this.board.isTerminated()) return
    this.board.openingCeils(row, col)
    this.face = 'ohh'
    this.refresh()
  }

  clearPreview() {
    if (this.board.isTerminated()) return
    this.board.clearOpening()
    if (this.face === 'ohh') {
      this.face = 'idle'
      this.refresh()
    }
  }

  toggleMarks() {
    this.board.toggleMarks()
    this.refresh()
  }

  bindTimer(scene: Phaser.Scene) {
    this.stopTimer()
    this.timerEvent = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.timerRunning || this.board.isTerminated()) return
        this.elapsedSeconds = Math.min(999, this.elapsedSeconds + 1)
        this.refresh()
      },
    })
  }

  unbindTimer() {
    this.stopTimer()
    if (this.timerEvent) {
      this.timerEvent.remove()
      this.timerEvent = undefined
    }
  }

  private updateFace(result: GameResult) {
    if (result === 'lose') {
      this.face = 'lose'
      this.stopTimer()
    } else if (result === 'win') {
      this.face = 'win'
      this.stopTimer()
      this.storage.setBestTime(this.elapsedSeconds)
    } else {
      this.face = 'idle'
    }
  }

  private startTimer() {
    this.timerRunning = true
  }

  private stopTimer() {
    this.timerRunning = false
  }

  private metadata(): GameMetadata {
    return {
      elapsedSeconds: this.elapsedSeconds,
      minesRemaining: this.board.minesRemaining(),
      bestTime: this.storage.getBestTime(),
      face: this.face,
      terminated: this.board.isTerminated(),
      won: this.board.status === 'won',
      over: this.board.status === 'died',
    }
  }
}
