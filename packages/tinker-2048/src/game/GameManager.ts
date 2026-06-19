import range from 'licia/range'
import type LocalStore from 'licia/LocalStore'
import { Grid, type SerializedGrid } from './Grid'
import { Tile, type Position } from './Tile'
import { GRID_SIZE } from './constants'

export type Direction = 0 | 1 | 2 | 3 // up, right, down, left

export interface SerializedGameState {
  grid: SerializedGrid
  score: number
  over: boolean
  won: boolean
  keepPlaying: boolean
  gameGeneration?: number
}

export interface GameMetadata {
  score: number
  over: boolean
  won: boolean
  bestScore: number
  terminated: boolean
  moved: boolean
  merged: boolean
}

export interface Actuator {
  actuate(grid: Grid, metadata: GameMetadata): void
  continueGame(): void
}

export class GameManager {
  grid!: Grid
  score = 0
  over = false
  won = false
  keepPlaying = false
  private startTiles = 2

  constructor(
    private store: LocalStore,
    private actuator: Actuator,
  ) {
    this.setup()
  }

  move(direction: Direction) {
    if (this.isGameTerminated()) return

    const vector = this.getVector(direction)
    const traversals = this.buildTraversals(vector)
    let moved = false
    let merged = false

    this.prepareTiles()

    for (const x of traversals.x) {
      for (const y of traversals.y) {
        const cell: Position = { x, y }
        const tile = this.grid.cellContent(cell)

        if (tile) {
          const positions = this.findFarthestPosition(cell, vector)
          const next = this.grid.cellContent(positions.next)

          if (next && next.value === tile.value && !next.mergedFrom) {
            merged = true
            const mergedTile = new Tile(positions.next, tile.value * 2)
            mergedTile.mergedFrom = [tile, next]

            this.grid.insertTile(mergedTile)
            this.grid.removeTile(tile)
            tile.updatePosition(positions.next)

            this.score += mergedTile.value
            if (mergedTile.value === 2048) this.won = true
          } else {
            this.moveTile(tile, positions.farthest)
          }

          if (!this.positionsEqual(cell, tile)) {
            moved = true
          }
        }
      }
    }

    if (moved) {
      this.addRandomTile()
      if (!this.movesAvailable()) {
        this.over = true
      }
      this.sync({ moved: true, merged })
    }
  }

  restart() {
    this.store.remove('gameState')
    this.actuator.continueGame()
    this.setup()
  }

  continuePlaying() {
    this.keepPlaying = true
    this.actuator.continueGame()
  }

  refresh() {
    this.sync()
  }

  isGameTerminated(): boolean {
    return this.over || (this.won && !this.keepPlaying)
  }

  // Session helpers (persisted in LocalStore)

  markInSession() {
    this.store.set('inSession', true)
  }

  isInSession(): boolean {
    return this.store.get('inSession') === true
  }

  getGameGeneration(): number {
    return this.store.get('gameGeneration') ?? 0
  }

  bumpGameGeneration(): number {
    const next = this.getGameGeneration() + 1
    this.store.set('gameGeneration', next)
    return next
  }

  hasResumableGame(): boolean {
    const state = this.getGameState()
    if (!state) return false
    if (!this.isInSession()) return true
    return (state.gameGeneration ?? 0) === this.getGameGeneration()
  }

  // Storage helpers

  getBestScore(): number {
    return this.store.get('bestScore') ?? 0
  }

  setBestScore(score: number) {
    this.store.set('bestScore', score)
  }

  getGameState(): SerializedGameState | null {
    return this.store.get('gameState') ?? null
  }

  setGameState(state: SerializedGameState) {
    this.store.set('gameState', state)
  }

  clearGameState() {
    this.store.remove('gameState')
  }

  getSoundEnabled(): boolean {
    return this.store.get('soundEnabled') ?? true
  }

  setSoundEnabled(enabled: boolean) {
    this.store.set('soundEnabled', enabled)
  }

  private setup() {
    const previousState = this.getGameState()

    if (previousState) {
      this.grid = new Grid(previousState.grid.size, previousState.grid)
      this.score = previousState.score
      this.over = previousState.over
      this.won = previousState.won
      this.keepPlaying = previousState.keepPlaying
    } else {
      this.grid = new Grid(GRID_SIZE)
      this.score = 0
      this.over = false
      this.won = false
      this.keepPlaying = false
      this.addStartTiles()
    }

    this.sync()
  }

  private addStartTiles() {
    for (let i = 0; i < this.startTiles; i++) {
      this.addRandomTile()
    }
  }

  private addRandomTile() {
    if (this.grid.cellsAvailable()) {
      const cell = this.grid.randomAvailableCell()!
      const value = Math.random() < 0.9 ? 2 : 4
      const tile = new Tile(cell, value)
      this.grid.insertTile(tile)
    }
  }

  private sync(action?: { moved: boolean; merged: boolean }) {
    if (this.getBestScore() < this.score) {
      this.setBestScore(this.score)
    }

    if (this.over) {
      this.clearGameState()
    } else {
      this.setGameState(this.serialize())
    }

    this.actuator.actuate(this.grid, {
      score: this.score,
      over: this.over,
      won: this.won,
      bestScore: this.getBestScore(),
      terminated: this.isGameTerminated(),
      moved: action?.moved ?? false,
      merged: action?.merged ?? false,
    })
  }

  private serialize() {
    return {
      grid: this.grid.serialize(),
      score: this.score,
      over: this.over,
      won: this.won,
      keepPlaying: this.keepPlaying,
      gameGeneration: this.getGameGeneration(),
    }
  }

  private prepareTiles() {
    this.grid.eachCell((_x, _y, tile) => {
      if (tile) {
        tile.mergedFrom = null
        tile.savePosition()
      }
    })
  }

  private moveTile(tile: Tile, cell: Position) {
    this.grid.cells[tile.x][tile.y] = null
    this.grid.cells[cell.x][cell.y] = tile
    tile.updatePosition(cell)
  }

  private getVector(direction: Direction): Position {
    const map: Record<Direction, Position> = {
      0: { x: 0, y: -1 },
      1: { x: 1, y: 0 },
      2: { x: 0, y: 1 },
      3: { x: -1, y: 0 },
    }
    return map[direction]
  }

  private buildTraversals(vector: Position) {
    const traversals = {
      x: range(GRID_SIZE),
      y: range(GRID_SIZE),
    }
    if (vector.x === 1) traversals.x.reverse()
    if (vector.y === 1) traversals.y.reverse()
    return traversals
  }

  private findFarthestPosition(cell: Position, vector: Position) {
    let previous = cell
    let current = { x: previous.x + vector.x, y: previous.y + vector.y }

    while (this.grid.withinBounds(current) && !this.grid.cellContent(current)) {
      previous = current
      current = { x: previous.x + vector.x, y: previous.y + vector.y }
    }

    return { farthest: previous, next: current }
  }

  private movesAvailable(): boolean {
    return this.grid.cellsAvailable() || this.tileMatchesAvailable()
  }

  private tileMatchesAvailable(): boolean {
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const tile = this.grid.cellContent({ x, y })
        if (tile) {
          for (let direction = 0; direction < 4; direction++) {
            const vector = this.getVector(direction as Direction)
            const cell = { x: x + vector.x, y: y + vector.y }
            const other = this.grid.cellContent(cell)
            if (other && other.value === tile.value) return true
          }
        }
      }
    }
    return false
  }

  private positionsEqual(first: Position, second: Tile): boolean {
    return first.x === second.x && first.y === second.y
  }
}
