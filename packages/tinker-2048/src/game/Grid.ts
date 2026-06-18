import { Tile, type Position, type SerializedTile } from './Tile'

export interface SerializedGrid {
  size: number
  cells: (SerializedTile | null)[][]
}

export class Grid {
  size: number
  cells: (Tile | null)[][]

  constructor(size: number, previousState?: SerializedGrid) {
    this.size = size
    this.cells = previousState ? this.fromState(previousState) : this.empty()
  }

  private empty(): (Tile | null)[][] {
    const cells: (Tile | null)[][] = []
    for (let x = 0; x < this.size; x++) {
      const row: (Tile | null)[] = []
      for (let y = 0; y < this.size; y++) {
        row.push(null)
      }
      cells[x] = row
    }
    return cells
  }

  private fromState(state: SerializedGrid): (Tile | null)[][] {
    const cells: (Tile | null)[][] = []
    for (let x = 0; x < this.size; x++) {
      const row: (Tile | null)[] = []
      for (let y = 0; y < this.size; y++) {
        const tile = state.cells[x][y]
        row.push(tile ? new Tile(tile.position, tile.value) : null)
      }
      cells[x] = row
    }
    return cells
  }

  randomAvailableCell(): Position | undefined {
    const cells = this.availableCells()
    if (cells.length) {
      return cells[Math.floor(Math.random() * cells.length)]
    }
  }

  availableCells(): Position[] {
    const cells: Position[] = []
    this.eachCell((x, y, tile) => {
      if (!tile) cells.push({ x, y })
    })
    return cells
  }

  eachCell(callback: (x: number, y: number, tile: Tile | null) => void) {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        callback(x, y, this.cells[x][y])
      }
    }
  }

  cellsAvailable(): boolean {
    return this.availableCells().length > 0
  }

  cellContent(cell: Position): Tile | null {
    if (this.withinBounds(cell)) {
      return this.cells[cell.x][cell.y]
    }
    return null
  }

  insertTile(tile: Tile) {
    this.cells[tile.x][tile.y] = tile
  }

  removeTile(tile: Tile) {
    this.cells[tile.x][tile.y] = null
  }

  withinBounds(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < this.size &&
      position.y >= 0 &&
      position.y < this.size
    )
  }

  serialize(): SerializedGrid {
    const cellState: (SerializedTile | null)[][] = []
    for (let x = 0; x < this.size; x++) {
      const row: (SerializedTile | null)[] = []
      for (let y = 0; y < this.size; y++) {
        const tile = this.cells[x][y]
        row.push(tile ? tile.serialize() : null)
      }
      cellState[x] = row
    }
    return { size: this.size, cells: cellState }
  }
}
