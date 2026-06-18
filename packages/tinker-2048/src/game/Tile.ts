export interface Position {
  x: number
  y: number
}

export interface SerializedTile {
  position: Position
  value: number
}

export class Tile {
  x: number
  y: number
  value: number
  previousPosition: Position | null = null
  mergedFrom: Tile[] | null = null

  constructor(position: Position, value = 2) {
    this.x = position.x
    this.y = position.y
    this.value = value
  }

  savePosition() {
    this.previousPosition = { x: this.x, y: this.y }
  }

  updatePosition(position: Position) {
    this.x = position.x
    this.y = position.y
  }

  serialize(): SerializedTile {
    return {
      position: { x: this.x, y: this.y },
      value: this.value,
    }
  }
}
