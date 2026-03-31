import Phaser from 'phaser'

const GRID_SIZE = 4
const CELL_SIZE = 106
const CELL_GAP = 12
const GRID_PADDING = 14
const GRID_OFFSET_Y = 120
const ROUND_RADIUS = 6

const TILE_COLORS: Record<number, { bg: number; text: string; fontSize: number }> = {
  2:    { bg: 0xeee4da, text: '#776e65', fontSize: 55 },
  4:    { bg: 0xede0c8, text: '#776e65', fontSize: 55 },
  8:    { bg: 0xf2b179, text: '#f9f6f2', fontSize: 55 },
  16:   { bg: 0xf59563, text: '#f9f6f2', fontSize: 55 },
  32:   { bg: 0xf67c5f, text: '#f9f6f2', fontSize: 55 },
  64:   { bg: 0xf65e3b, text: '#f9f6f2', fontSize: 55 },
  128:  { bg: 0xedcf72, text: '#f9f6f2', fontSize: 45 },
  256:  { bg: 0xedcc61, text: '#f9f6f2', fontSize: 45 },
  512:  { bg: 0xedc850, text: '#f9f6f2', fontSize: 45 },
  1024: { bg: 0xedc53f, text: '#f9f6f2', fontSize: 35 },
  2048: { bg: 0xedc22e, text: '#f9f6f2', fontSize: 35 },
}

const DEFAULT_TILE = { bg: 0x3c3a32, text: '#f9f6f2', fontSize: 30 }

type Direction = 'left' | 'right' | 'up' | 'down'

interface TileData {
  value: number
  row: number
  col: number
  container?: Phaser.GameObjects.Container
}

export class GameScene extends Phaser.Scene {
  private grid: (TileData | null)[][] = []
  private score = 0
  private bestScore = 0
  private scoreText!: Phaser.GameObjects.Text
  private bestScoreText!: Phaser.GameObjects.Text
  private isMoving = false
  private gridOriginX = 0
  private gridOriginY = 0

  constructor() {
    super('Game')
  }

  create() {
    const saved = localStorage.getItem('2048-best')
    if (saved) this.bestScore = parseInt(saved, 10)

    this.gridOriginX = (500 - (CELL_SIZE * GRID_SIZE + CELL_GAP * (GRID_SIZE + 1))) / 2 + GRID_PADDING
    this.gridOriginY = GRID_OFFSET_Y + GRID_PADDING

    this.drawHeader()
    this.drawGridBackground()
    this.initGrid()
    this.addRandomTile()
    this.addRandomTile()
    this.renderAllTiles()
    this.setupInput()
  }

  private drawHeader() {
    this.add.text(20, 15, '2048', {
      fontSize: '60px',
      color: '#776e65',
      fontStyle: 'bold',
    })

    const scoreBox = this.add.rectangle(310, 30, 80, 50, 0xbbada0, 1).setOrigin(0.5)
    this.roundRect(scoreBox)
    this.add.text(310, 18, 'SCORE', {
      fontSize: '11px', color: '#eee4da', fontStyle: 'bold',
    }).setOrigin(0.5)
    this.scoreText = this.add.text(310, 40, '0', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5)

    const bestBox = this.add.rectangle(410, 30, 80, 50, 0xbbada0, 1).setOrigin(0.5)
    this.roundRect(bestBox)
    this.add.text(410, 18, 'BEST', {
      fontSize: '11px', color: '#eee4da', fontStyle: 'bold',
    }).setOrigin(0.5)
    this.bestScoreText = this.add.text(410, 40, String(this.bestScore), {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5)

    const newGameBtn = this.add.rectangle(380, 85, 120, 35, 0x8f7a66, 1).setOrigin(0.5).setInteractive()
    this.roundRect(newGameBtn)
    this.add.text(380, 85, 'New Game', {
      fontSize: '16px', color: '#f9f6f2', fontStyle: 'bold',
    }).setOrigin(0.5)
    newGameBtn.on('pointerup', () => this.restartGame())
  }

  private roundRect(_rect: Phaser.GameObjects.Rectangle) {
    // Phaser rectangles don't natively support rounded corners,
    // visual approximation is fine for this game
  }

  private drawGridBackground() {
    const totalSize = CELL_SIZE * GRID_SIZE + CELL_GAP * (GRID_SIZE + 1)
    const gfx = this.add.graphics()
    gfx.fillStyle(0xbbada0, 1)
    gfx.fillRoundedRect(
      this.gridOriginX - GRID_PADDING,
      this.gridOriginY - GRID_PADDING,
      totalSize + GRID_PADDING * 2 - CELL_GAP * 2 + CELL_GAP,
      totalSize + GRID_PADDING * 2 - CELL_GAP * 2 + CELL_GAP,
      ROUND_RADIUS,
    )

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, y } = this.cellPosition(r, c)
        gfx.fillStyle(0xcdc1b4, 1)
        gfx.fillRoundedRect(x, y, CELL_SIZE, CELL_SIZE, ROUND_RADIUS)
      }
    }
  }

  private cellPosition(row: number, col: number) {
    return {
      x: this.gridOriginX + col * (CELL_SIZE + CELL_GAP),
      y: this.gridOriginY + row * (CELL_SIZE + CELL_GAP),
    }
  }

  private initGrid() {
    this.grid = []
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = []
      for (let c = 0; c < GRID_SIZE; c++) {
        this.grid[r][c] = null
      }
    }
  }

  private addRandomTile(): TileData | null {
    const empty: { r: number; c: number }[] = []
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!this.grid[r][c]) empty.push({ r, c })
      }
    }
    if (empty.length === 0) return null

    const { r, c } = empty[Math.floor(Math.random() * empty.length)]
    const value = Math.random() < 0.9 ? 2 : 4
    const tile: TileData = { value, row: r, col: c }
    this.grid[r][c] = tile
    return tile
  }

  private createTileContainer(tile: TileData): Phaser.GameObjects.Container {
    const { x, y } = this.cellPosition(tile.row, tile.col)
    const style = TILE_COLORS[tile.value] || DEFAULT_TILE

    const gfx = this.add.graphics()
    gfx.fillStyle(style.bg, 1)
    gfx.fillRoundedRect(0, 0, CELL_SIZE, CELL_SIZE, ROUND_RADIUS)

    const text = this.add.text(CELL_SIZE / 2, CELL_SIZE / 2, String(tile.value), {
      fontSize: `${style.fontSize}px`,
      color: style.text,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const container = this.add.container(x, y, [gfx, text])
    tile.container = container
    return container
  }

  private renderAllTiles() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = this.grid[r][c]
        if (tile) {
          this.createTileContainer(tile)
          // Pop-in animation
          tile.container!.setScale(0)
          this.tweens.add({
            targets: tile.container,
            scaleX: 1,
            scaleY: 1,
            duration: 150,
            ease: 'Back.easeOut',
          })
        }
      }
    }
  }

  private setupInput() {
    if (!this.input.keyboard) return
    this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
      if (this.isMoving) return
      switch (event.key) {
        case 'ArrowLeft':  this.move('left'); break
        case 'ArrowRight': this.move('right'); break
        case 'ArrowUp':    this.move('up'); break
        case 'ArrowDown':  this.move('down'); break
      }
    })

    // Swipe support
    let startX = 0
    let startY = 0
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      startX = pointer.x
      startY = pointer.y
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return
      const dx = pointer.x - startX
      const dy = pointer.y - startY
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (Math.max(absDx, absDy) < 30) return
      if (absDx > absDy) {
        this.move(dx > 0 ? 'right' : 'left')
      } else {
        this.move(dy > 0 ? 'down' : 'up')
      }
    })
  }

  private move(direction: Direction) {
    this.isMoving = true
    let moved = false
    const mergedPositions = new Set<string>()
    const tweens: Promise<void>[] = []

    const traversal = this.buildTraversal(direction)

    for (const { r, c } of traversal) {
      const tile = this.grid[r][c]
      if (!tile) continue

      const { row: newRow, col: newCol, merged } = this.findFarthest(tile, direction, mergedPositions)

      if (newRow === r && newCol === c) continue
      moved = true

      // Remove from old position
      this.grid[r][c] = null

      if (merged) {
        // Merge
        const target = this.grid[newRow][newCol]!
        const newValue = tile.value * 2
        this.score += newValue

        const { x, y } = this.cellPosition(newRow, newCol)
        tweens.push(new Promise<void>((resolve) => {
          this.tweens.add({
            targets: tile.container,
            x, y,
            duration: 120,
            ease: 'Cubic.easeInOut',
            onComplete: () => {
              tile.container?.destroy()
              target.container?.destroy()

              target.value = newValue
              this.createTileContainer(target)
              // Merge pop
              this.tweens.add({
                targets: target.container,
                scaleX: 1.15,
                scaleY: 1.15,
                duration: 80,
                yoyo: true,
                ease: 'Cubic.easeOut',
                onComplete: () => resolve(),
              })
            },
          })
        }))
        mergedPositions.add(`${newRow},${newCol}`)
      } else {
        // Move
        this.grid[newRow][newCol] = tile
        tile.row = newRow
        tile.col = newCol

        const { x, y } = this.cellPosition(newRow, newCol)
        tweens.push(new Promise<void>((resolve) => {
          this.tweens.add({
            targets: tile.container,
            x, y,
            duration: 120,
            ease: 'Cubic.easeInOut',
            onComplete: () => resolve(),
          })
        }))
      }
    }

    if (!moved) {
      this.isMoving = false
      return
    }

    Promise.all(tweens).then(() => {
      const newTile = this.addRandomTile()
      if (newTile) {
        this.createTileContainer(newTile)
        newTile.container!.setScale(0)
        this.tweens.add({
          targets: newTile.container,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: 'Back.easeOut',
        })
      }

      this.updateScore()
      this.isMoving = false

      if (this.isGameOver()) {
        this.showGameOver()
      }
    })
  }

  private buildTraversal(direction: Direction): { r: number; c: number }[] {
    const cells: { r: number; c: number }[] = []
    const rows = Array.from({ length: GRID_SIZE }, (_, i) => i)
    const cols = Array.from({ length: GRID_SIZE }, (_, i) => i)

    if (direction === 'right') cols.reverse()
    if (direction === 'down') rows.reverse()

    for (const r of rows) {
      for (const c of cols) {
        cells.push({ r, c })
      }
    }
    return cells
  }

  private findFarthest(
    tile: TileData, direction: Direction, merged: Set<string>,
  ): { row: number; col: number; merged: boolean } {
    const delta = { left: [0, -1], right: [0, 1], up: [-1, 0], down: [1, 0] }[direction]
    let r = tile.row
    let c = tile.col

    while (true) {
      const nr = r + delta[0]
      const nc = c + delta[1]
      if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE) break

      const next = this.grid[nr][nc]
      if (!next) {
        r = nr
        c = nc
      } else if (next.value === tile.value && !merged.has(`${nr},${nc}`)) {
        return { row: nr, col: nc, merged: true }
      } else {
        break
      }
    }

    return { row: r, col: c, merged: false }
  }

  private updateScore() {
    this.scoreText.setText(String(this.score))
    if (this.score > this.bestScore) {
      this.bestScore = this.score
      this.bestScoreText.setText(String(this.bestScore))
      localStorage.setItem('2048-best', String(this.bestScore))
    }
  }

  private isGameOver(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (!this.grid[r][c]) return false
        const val = this.grid[r][c]!.value
        // Check right neighbor
        if (c < GRID_SIZE - 1 && this.grid[r][c + 1]?.value === val) return false
        // Check bottom neighbor
        if (r < GRID_SIZE - 1 && this.grid[r + 1]?.[c]?.value === val) return false
      }
    }
    return true
  }

  private showGameOver() {
    const overlay = this.add.rectangle(250, 300, 500, 600, 0xfaf8ef, 0.6)
    const text = this.add.text(250, 280, 'Game Over!', {
      fontSize: '50px', color: '#776e65', fontStyle: 'bold',
    }).setOrigin(0.5)

    const btn = this.add.rectangle(250, 350, 160, 45, 0x8f7a66, 1).setOrigin(0.5).setInteractive()
    const btnText = this.add.text(250, 350, 'Try Again', {
      fontSize: '20px', color: '#f9f6f2', fontStyle: 'bold',
    }).setOrigin(0.5)

    // Fade in
    for (const obj of [overlay, text, btn, btnText]) {
      obj.setAlpha(0)
      this.tweens.add({ targets: obj, alpha: 1, duration: 400 })
    }

    btn.on('pointerup', () => this.restartGame())
  }

  private restartGame() {
    // Destroy all tile containers
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        this.grid[r][c]?.container?.destroy()
      }
    }
    this.score = 0
    this.scene.restart()
  }
}
