import Phaser from 'phaser'
import clamp from 'licia/clamp'
import type LocalStore from 'licia/LocalStore'
import {
  DEFAULT_LEVEL_ID,
  getCurrentLevel,
  initCurrentLevel,
  isLevelId,
  type LevelId,
} from './levels'
import { MinesweeperBoard, type GameResult } from './MinesweeperBoard'

export interface GameMetadata {
  elapsedSeconds: number
  minesRemaining: number
  face: 'idle' | 'ohh' | 'win' | 'lose'
  terminated: boolean
  won: boolean
  levelId: LevelId
}

export interface Actuator {
  actuate(board: MinesweeperBoard, metadata: GameMetadata): void
  updateStatus(metadata: GameMetadata): void
}

export class GameManager {
  board: MinesweeperBoard
  elapsedSeconds = 0
  private timerEvent?: Phaser.Time.TimerEvent
  private timerRunning = false
  private face: GameMetadata['face'] = 'idle'

  constructor(
    private store: LocalStore,
    private actuator: Actuator,
  ) {
    const storedLevel = store.get('level')
    const levelId = isLevelId(storedLevel) ? storedLevel : DEFAULT_LEVEL_ID
    initCurrentLevel(levelId)
    const level = getCurrentLevel()
    this.board = new MinesweeperBoard(level.rows, level.cols, level.mines)
  }

  getLevelId() {
    return getCurrentLevel().id
  }

  setLevel(levelId: LevelId) {
    if (levelId === getCurrentLevel().id) return false

    this.store.set('level', levelId)
    initCurrentLevel(levelId)
    this.stopTimer()
    this.elapsedSeconds = 0
    this.face = 'idle'
    const level = getCurrentLevel()
    this.board = new MinesweeperBoard(level.rows, level.cols, level.mines)
    return true
  }

  refresh() {
    this.actuator.actuate(this.board, this.metadata())
  }

  private refreshStatus() {
    this.actuator.updateStatus(this.metadata())
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

  preview(row: number, col: number, chord = false) {
    if (this.board.isTerminated()) return
    if (chord) this.board.openingCeils(row, col)
    else this.board.openingCeil(row, col)
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

  bindTimer(scene: Phaser.Scene) {
    this.stopTimer()
    this.timerEvent = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.timerRunning || this.board.isTerminated()) return
        this.elapsedSeconds = clamp(this.elapsedSeconds + 1, 0, 999)
        this.refreshStatus()
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
      face: this.face,
      terminated: this.board.isTerminated(),
      won: this.board.status === 'won',
      levelId: getCurrentLevel().id,
    }
  }
}
