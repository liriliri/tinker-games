import type LocalStore from 'licia/LocalStore'
import Phaser from 'phaser'
import clamp from 'licia/clamp'
import {
  DEFAULT_LEVEL_ID,
  getCurrentLevel,
  initCurrentLevel,
  isLevelId,
  LEVELS,
  type LevelId,
} from './levels'
import {
  buildEditableMask,
  cloneGrid,
  createEmptyGrid,
  generateSudoku,
  isGridComplete,
  type CellPos,
  type Grid,
} from './SudokuEngine'

export type CellKind = 'given' | 'user'

export interface CellState {
  value: number
  kind: CellKind
}

export interface GameMetadata {
  levelId: LevelId
  selected: CellPos | null
  completed: boolean
  elapsedSeconds: number
  canReset: boolean
  canHint: boolean
}

export interface Actuator {
  actuate(
    cells: CellState[][],
    metadata: GameMetadata,
    initialPuzzle: Grid,
  ): void
  updateStatus(metadata: GameMetadata): void
}

export class GameManager {
  private puzzle: Grid = createEmptyGrid()
  private solution: Grid = createEmptyGrid()
  private grid: Grid = createEmptyGrid()
  private editable: boolean[][] = createEmptyGrid().map((row) =>
    row.map(() => false),
  )
  private cellKinds: CellKind[][] = createEmptyGrid().map((row) =>
    row.map(() => 'given' as CellKind),
  )
  private selected: CellPos | null = null
  private completed = false
  private elapsedSeconds = 0
  private timerEvent?: Phaser.Time.TimerEvent
  private timerRunning = false

  constructor(
    private store: LocalStore,
    private actuator: Actuator,
  ) {
    const storedLevel = store.get('level')
    const levelId = isLevelId(storedLevel) ? storedLevel : DEFAULT_LEVEL_ID
    initCurrentLevel(levelId)
  }

  startInitialPuzzle() {
    this.startNewPuzzle(getCurrentLevel().id)
  }

  getLevelId() {
    return getCurrentLevel().id
  }

  setLevel(levelId: LevelId) {
    this.store.set('level', levelId)
    initCurrentLevel(levelId)
    this.startNewPuzzle(levelId)
  }

  refresh() {
    this.actuator.actuate(this.buildCellStates(), this.metadata(), this.puzzle)
  }

  bindTimer(scene: Phaser.Scene) {
    this.unbindTimer()
    this.timerEvent = scene.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (!this.timerRunning || this.completed) return
        this.elapsedSeconds = clamp(this.elapsedSeconds + 1, 0, 35999)
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

  private refreshStatus() {
    this.actuator.updateStatus(this.metadata())
  }

  private resetTimer() {
    this.stopTimer()
    this.elapsedSeconds = 0
  }

  private startTimer() {
    this.timerRunning = true
  }

  private stopTimer() {
    this.timerRunning = false
  }

  requestNewPuzzle(levelId: LevelId) {
    this.store.set('level', levelId)
    initCurrentLevel(levelId)
    this.startNewPuzzle(levelId)
  }

  reset() {
    if (!this.hasUserEntries() && !this.completed) return

    this.grid = cloneGrid(this.puzzle)
    this.cellKinds = this.puzzle.map((row) =>
      row.map((value) => (value === 0 ? 'user' : 'given')),
    )
    this.completed = false
    this.startTimer()
    this.refresh()
  }

  selectCell(row: number, col: number) {
    if (!this.editable[row][col] || this.completed) {
      this.selected = null
      this.refresh()
      return
    }

    this.selected = { row, col }
    this.refresh()
  }

  clearSelection() {
    this.selected = null
    this.refresh()
  }

  setDigit(digit: number) {
    if (!this.selected || this.completed) return

    const { row, col } = this.selected
    if (!this.editable[row][col]) return
    if (this.grid[row][col] === digit) return

    this.grid[row][col] = digit
    this.cellKinds[row][col] = 'user'

    this.checkCompletion()
    this.refresh()
  }

  clearCell() {
    this.setDigit(0)
  }

  hint() {
    if (this.completed) return

    const candidates = this.getHintCandidates()
    if (candidates.length === 0) return

    const { row, col } =
      candidates[Math.floor(Math.random() * candidates.length)]
    this.grid[row][col] = this.solution[row][col]
    this.cellKinds[row][col] = 'user'
    this.selected = { row, col }
    this.checkCompletion()
    this.refresh()
  }

  moveSelection(deltaRow: number, deltaCol: number) {
    if (this.completed) return

    const startRow = this.selected?.row ?? 0
    const startCol = this.selected?.col ?? 0
    let row = startRow
    let col = startCol

    for (let step = 0; step < 81; step++) {
      row = (row + deltaRow + 9) % 9
      col = (col + deltaCol + 9) % 9
      if (this.editable[row][col]) {
        this.selected = { row, col }
        this.refresh()
        return
      }
    }
  }

  private checkCompletion() {
    if (!isGridComplete(this.grid, this.solution)) return
    this.completed = true
    this.stopTimer()
  }

  private hasUserEntries() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (
          this.editable[row][col] &&
          this.grid[row][col] !== this.puzzle[row][col]
        ) {
          return true
        }
      }
    }
    return false
  }

  private getHintCandidates(): CellPos[] {
    const empty: CellPos[] = []
    const wrong: CellPos[] = []

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (!this.editable[row][col]) continue

        const value = this.grid[row][col]
        if (value === 0) {
          empty.push({ row, col })
        } else if (value !== this.solution[row][col]) {
          wrong.push({ row, col })
        }
      }
    }

    return empty.length > 0 ? empty : wrong
  }

  private metadata(): GameMetadata {
    return {
      levelId: getCurrentLevel().id,
      selected: this.selected,
      completed: this.completed,
      elapsedSeconds: this.elapsedSeconds,
      canReset: this.hasUserEntries() || this.completed,
      canHint: !this.completed && this.getHintCandidates().length > 0,
    }
  }

  private buildCellStates(): CellState[][] {
    return this.grid.map((row, rowIndex) =>
      row.map((value, colIndex) => ({
        value,
        kind: this.cellKinds[rowIndex][colIndex],
      })),
    )
  }

  private startNewPuzzle(levelId: LevelId) {
    initCurrentLevel(levelId)
    this.resetTimer()
    this.selected = null
    this.completed = false

    const removalSteps = LEVELS[levelId].removalSteps
    const { puzzle, solution } = generateSudoku(removalSteps)
    this.puzzle = puzzle
    this.solution = solution
    this.grid = cloneGrid(puzzle)
    this.editable = buildEditableMask(puzzle)
    this.cellKinds = puzzle.map((row) =>
      row.map((value) => (value === 0 ? 'user' : 'given')),
    )
    this.startTimer()
    this.refresh()
  }
}
