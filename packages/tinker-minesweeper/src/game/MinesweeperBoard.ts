export type GameStatus = 'new' | 'started' | 'died' | 'won'

export type CellState =
  | 'cover'
  | 'flag'
  | 'unknown'
  | 'open'
  | 'mine'
  | 'die'
  | 'misflagged'

export interface Position {
  row: number
  col: number
}

export interface Cell {
  minesAround: number
  state: CellState
  opening: boolean
}

export type GameResult = 'continue' | 'win' | 'lose'

export class MinesweeperBoard {
  readonly rows: number
  readonly cols: number
  readonly mineCount: number
  status: GameStatus = 'new'
  marks = true
  cells: Cell[][]

  constructor(rows: number, cols: number, mineCount: number) {
    this.rows = rows
    this.cols = cols
    this.mineCount = mineCount
    this.cells = this.createEmptyCells()
  }

  reset() {
    this.status = 'new'
    this.marks = true
    this.cells = this.createEmptyCells()
  }

  toggleMarks() {
    this.marks = !this.marks
  }

  inBounds(row: number, col: number) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols
  }

  getCell(row: number, col: number) {
    return this.cells[row][col]
  }

  isTerminated() {
    return this.status === 'died' || this.status === 'won'
  }

  minesRemaining() {
    const flagged = this.cells
      .flat()
      .filter(
        (cell) => cell.state === 'flag' || cell.state === 'misflagged',
      ).length
    return this.mineCount - flagged
  }

  clearOpening() {
    for (const row of this.cells) {
      for (const cell of row) {
        cell.opening = false
      }
    }
  }

  openingCeil(row: number, col: number) {
    if (this.isTerminated() || !this.inBounds(row, col)) return
    this.clearOpening()
    this.cells[row][col].opening = true
  }

  openingCeils(row: number, col: number) {
    if (this.isTerminated() || !this.inBounds(row, col)) return
    this.clearOpening()
    this.cells[row][col].opening = true
    for (const pos of this.neighbors(row, col)) {
      this.cells[pos.row][pos.col].opening = true
    }
  }

  changeCeilState(row: number, col: number): boolean {
    if (this.isTerminated() || !this.inBounds(row, col)) return false

    const cell = this.cells[row][col]
    if (cell.state === 'open') return false

    switch (cell.state) {
      case 'cover':
        cell.state = 'flag'
        break
      case 'flag':
        cell.state = this.marks ? 'unknown' : 'cover'
        break
      case 'unknown':
        cell.state = 'cover'
        break
      default:
        return false
    }
    return true
  }

  openCeil(row: number, col: number): GameResult {
    if (this.isTerminated() || !this.inBounds(row, col)) {
      return 'continue'
    }

    this.clearOpening()

    if (this.status === 'new') {
      this.placeMines(row, col)
      this.status = 'started'
    }

    if (this.status !== 'started') {
      return 'continue'
    }

    const cell = this.cells[row][col]
    if (cell.state === 'flag' || cell.state === 'open') {
      return 'continue'
    }

    if (cell.minesAround < 0) {
      this.applyGameOver(row, col)
      return 'lose'
    }

    this.openIndexes(this.autoCeils(row, col))
    return this.checkWin()
  }

  openCeils(row: number, col: number): GameResult {
    if (this.isTerminated() || !this.inBounds(row, col)) {
      return 'continue'
    }

    this.clearOpening()

    if (this.status !== 'started') {
      return 'continue'
    }

    const cell = this.cells[row][col]
    if (cell.state !== 'open' || cell.minesAround <= 0) {
      return 'continue'
    }

    const neighbors = this.neighbors(row, col)
    const flaggedNeighbors = neighbors.filter(
      (pos) => this.cells[pos.row][pos.col].state === 'flag',
    ).length

    if (flaggedNeighbors !== cell.minesAround) {
      return 'continue'
    }

    const minePos = neighbors.find(
      (pos) =>
        this.cells[pos.row][pos.col].minesAround < 0 &&
        this.cells[pos.row][pos.col].state !== 'flag',
    )

    if (minePos) {
      this.applyGameOver(minePos.row, minePos.col)
      return 'lose'
    }

    for (const pos of neighbors) {
      this.openIndexes(this.autoCeils(pos.row, pos.col))
    }

    return this.checkWin()
  }

  private createEmptyCells(): Cell[][] {
    return Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => ({
        minesAround: 0,
        state: 'cover' as CellState,
        opening: false,
      })),
    )
  }

  private placeMines(excludeRow: number, excludeCol: number) {
    const positions: Position[] = []
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (row === excludeRow && col === excludeCol) continue
        positions.push({ row, col })
      }
    }

    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[positions[i], positions[j]] = [positions[j], positions[i]]
    }

    for (let i = 0; i < this.mineCount; i++) {
      const { row, col } = positions[i]
      this.cells[row][col].minesAround = -10
      for (const pos of this.neighbors(row, col)) {
        const neighbor = this.cells[pos.row][pos.col]
        if (neighbor.minesAround >= 0) {
          neighbor.minesAround++
        }
      }
    }
  }

  private autoCeils(row: number, col: number): Position[] {
    const walked = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => false),
    )

    return this.walkCeils(row, col, walked)
  }

  private walkCeils(row: number, col: number, walked: boolean[][]): Position[] {
    const cell = this.cells[row][col]
    if (walked[row][col] || cell.minesAround < 0 || cell.state === 'flag') {
      return []
    }

    walked[row][col] = true

    if (cell.minesAround > 0) {
      return [{ row, col }]
    }

    return [
      { row, col },
      ...this.neighbors(row, col).flatMap((pos) =>
        this.walkCeils(pos.row, pos.col, walked),
      ),
    ]
  }

  private openIndexes(positions: Position[]) {
    for (const { row, col } of positions) {
      const cell = this.cells[row][col]
      cell.state = 'open'
      cell.opening = false
    }
  }

  private applyGameOver(dieRow: number, dieCol: number) {
    this.status = 'died'
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col]
        cell.opening = false

        if (row === dieRow && col === dieCol) {
          cell.state = 'die'
        } else if (cell.minesAround < 0 && cell.state !== 'flag') {
          cell.state = 'mine'
        } else if (cell.state === 'flag' && cell.minesAround >= 0) {
          cell.state = 'misflagged'
        }
      }
    }
  }

  private applyWin() {
    this.status = 'won'
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col]
        cell.opening = false
        if (cell.minesAround >= 0) {
          cell.state = 'open'
        } else {
          cell.state = 'flag'
        }
      }
    }
  }

  private checkWin(): GameResult {
    const remains = this.cells
      .flat()
      .filter((cell) => cell.state !== 'open' && cell.minesAround >= 0).length

    if (this.status === 'started' && remains === 0) {
      this.applyWin()
      return 'win'
    }
    return 'continue'
  }

  private neighbors(row: number, col: number) {
    const result: Position[] = []
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue
        const nr = row + dr
        const nc = col + dc
        if (this.inBounds(nr, nc)) {
          result.push({ row: nr, col: nc })
        }
      }
    }
    return result
  }
}
