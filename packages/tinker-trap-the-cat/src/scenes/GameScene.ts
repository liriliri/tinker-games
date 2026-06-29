import {
  CAT_ANIMATIONS,
  CAT_FRAME_RATE,
  CAT_TEXTURES,
  getCatTextureScale,
  queueCatTextures,
} from '../game/catAssets'
import {
  CELL_R,
  GRID_H,
  GRID_W,
  GRID_MARGIN_TOP,
  HEADER_HEIGHT,
  INITIAL_WALL_COUNT,
  HEX_CELL_SCALE,
  MEOW_SOUND_KEY,
  MEOW_SOUND_PATH,
  SCENE_GAME,
  VICTORY_SOUND_KEY,
  VICTORY_SOUND_PATH,
} from '../game/constants'
import {
  isFairRandomStart,
  MAX_RANDOM_WALL_ATTEMPTS,
} from '../game/playability'
import { t } from '../i18n'
import { Block } from '../gameObjects/Block'
import { Cat } from '../gameObjects/Cat'
import { HeaderBar } from '../gameObjects/HeaderBar'
import { applyRenderScale, RELAYOUT_EVENT, s } from '../scale'
import filter from 'licia/filter'
import map from 'licia/map'
import range from 'licia/range'
import shuffle from 'licia/shuffle'

type GridPosition = {
  x: number
  y: number
}

type RecordCoord = {
  cat: { i: number; j: number }[]
  wall: { i: number; j: number }[]
}

type SavedState = {
  walls: boolean[][]
  catI: number
  catJ: number
  catDirection: number
  recordCoord: RecordCoord
  state: GameState
  statusText: string
}

enum GameState {
  PLAYING = 'playing',
  WIN = 'win',
  LOSE = 'lose',
}

export class GameScene extends Phaser.Scene {
  readonly w = GRID_W
  readonly h = GRID_H
  readonly initialWallCount = INITIAL_WALL_COUNT

  blocks!: Block[][]
  cat!: Cat
  header!: HeaderBar

  private recordCoord: RecordCoord = { cat: [], wall: [] }
  private loadedTextureScale = 0
  private gameState = GameState.PLAYING

  constructor() {
    super(SCENE_GAME)
  }

  get r() {
    return s(CELL_R)
  }

  get dx() {
    return this.r * 2
  }

  get dy() {
    return this.r * Math.sqrt(3)
  }

  get blocksData(): boolean[][] {
    return map(this.blocks, (column) => map(column, (block) => block.isWall))
  }

  get state(): GameState {
    return this.gameState
  }

  set state(value: GameState) {
    switch (value) {
      case GameState.PLAYING:
        break
      case GameState.LOSE:
        this.setStatusText(t('statusLose'))
        break
      case GameState.WIN:
        this.setStatusText(t('statusWin'))
        this.sound.play(VICTORY_SOUND_KEY)
        break
      default:
        return
    }
    this.gameState = value
  }

  create(): void {
    applyRenderScale(this.game)
    void this.bootView()
    this.events.on(RELAYOUT_EVENT, () => void this.relayout(), this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  get gridOffsetY() {
    return s(HEADER_HEIGHT + GRID_MARGIN_TOP)
  }

  getPosition(i: number, j: number): GridPosition {
    const r = this.r
    const dx = this.dx
    const dy = this.dy
    return {
      x: r * 3 + ((j & 1) === 0 ? r : dx) + i * dx,
      y: r * 3 + r + j * dy + this.gridOffsetY,
    }
  }

  getBlock(i: number, j: number): Block | null {
    if (!(i >= 0 && i < this.w && j >= 0 && j < this.h)) {
      return null
    }
    return this.blocks[i][j]
  }

  playerClick(i: number, j: number): boolean {
    if (this.cat.anims.isPlaying) {
      this.cat.anims.stop()
    }
    if (this.state !== GameState.PLAYING) {
      this.setStatusText(t('statusGameOverReset'))
      this.reset()
      return false
    }
    const block = this.getBlock(i, j)
    if (!block) {
      this.setStatusText(t('statusInvalidCell'))
      return false
    }
    if (block.isWall) {
      this.setStatusText(t('statusAlreadyWall'))
      return false
    }
    if (this.cat.i === i && this.cat.j === j) {
      this.setStatusText(t('statusCatPosition'))
      return false
    }

    block.isWall = true
    if (this.cat.isCaught()) {
      this.setStatusText(t('statusWin'))
      this.state = GameState.WIN
      return false
    }

    this.recordCoord.cat.push({ i: this.cat.i, j: this.cat.j })
    this.recordCoord.wall.push({ i, j })

    this.setStatusText(`${t('statusClicked')} (${i}, ${j})`)
    const result = this.cat.step()
    if (!result) {
      this.setStatusText(t('statusCatSurrender'))
      this.state = GameState.WIN
    }
    return true
  }

  reset() {
    this.cat.reset()
    this.resetBlocks()
    this.randomWall()
    this.recordCoord = { cat: [], wall: [] }
    this.state = GameState.PLAYING
    this.setStatusText(t('statusHint'))
  }

  undo() {
    if (this.recordCoord.cat.length) {
      if (this.state !== GameState.PLAYING) {
        this.setStatusText(t('statusGameOverReset'))
        this.reset()
      } else {
        const catCoord = this.recordCoord.cat.pop()!
        const { i, j } = this.recordCoord.wall.pop()!
        this.cat.undo(catCoord.i, catCoord.j)
        this.getBlock(i, j)!.isWall = false
      }
    } else {
      this.setStatusText(t('statusNoUndo'))
    }
  }

  private async bootView(saved: SavedState | null = null) {
    await this.loadAssets()
    this.createAnimations()
    this.buildView()
    if (saved) {
      this.restoreState(saved)
    } else {
      this.reset()
    }
  }

  private async relayout() {
    const saved = this.captureState()
    applyRenderScale(this.game)
    this.destroyView()
    await this.bootView(saved)
  }

  private loadAssets(): Promise<void> {
    const textureScale = getCatTextureScale()
    const needsTextures = this.loadedTextureScale !== textureScale
    const needsMeow = !this.cache.audio.exists(MEOW_SOUND_KEY)
    const needsVictory = !this.cache.audio.exists(VICTORY_SOUND_KEY)

    if (!needsTextures && !needsMeow && !needsVictory) {
      return Promise.resolve()
    }

    if (needsTextures) {
      for (const key of Object.keys(CAT_TEXTURES)) {
        if (this.textures.exists(key)) {
          this.textures.remove(key)
        }
      }
    }

    return new Promise((resolve) => {
      if (needsTextures) {
        queueCatTextures(this, textureScale)
      }
      if (needsMeow) {
        this.load.audio(MEOW_SOUND_KEY, MEOW_SOUND_PATH)
      }
      if (needsVictory) {
        this.load.audio(VICTORY_SOUND_KEY, VICTORY_SOUND_PATH)
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        if (needsTextures) {
          this.loadedTextureScale = textureScale
        }
        resolve()
      })
      this.load.start()
    })
  }

  private captureState(): SavedState | null {
    if (!this.blocks || !this.cat || !this.header) {
      return null
    }

    return {
      walls: this.blocksData,
      catI: this.cat.i,
      catJ: this.cat.j,
      catDirection: this.cat.direction,
      recordCoord: {
        cat: [...this.recordCoord.cat],
        wall: [...this.recordCoord.wall],
      },
      state: this.state,
      statusText: this.header.getStatusText(),
    }
  }

  private restoreState(saved: SavedState) {
    this.recordCoord = saved.recordCoord
    // Skip the state setter so restored statusText is not overwritten.
    this.gameState = saved.state

    for (let i = 0; i < this.w; i++) {
      for (let j = 0; j < this.h; j++) {
        this.getBlock(i, j)!.isWall = saved.walls[i][j]
      }
    }

    this.cat.anims.stop()
    this.cat.direction = saved.catDirection
    this.cat.undo(saved.catI, saved.catJ)
    this.header.setStatusText(saved.statusText)
  }

  private setStatusText(message: string) {
    this.header.setStatusText(message)
  }

  private createAnimations(): void {
    CAT_ANIMATIONS.forEach((animation) => {
      if (this.anims.exists(animation.name)) {
        this.anims.remove(animation.name)
      }
      this.anims.create({
        key: animation.name,
        frames: map(animation.textures, (texture) => ({
          key: texture,
          frame: 0,
        })),
        frameRate: CAT_FRAME_RATE,
        repeat: animation.repeat,
      })
    })
  }

  private buildView() {
    this.createHeader()
    this.createBlocks()
    this.createCat()
  }

  private destroyView() {
    this.blocks?.forEach((column) => {
      column.forEach((block) => block.destroy())
    })
    this.cat?.destroy()
    this.header?.destroy()
  }

  private createBlocks(): void {
    const blocks: Block[][] = []
    for (let i = 0; i < this.w; i++) {
      blocks[i] = []
      for (let j = 0; j < this.h; j++) {
        const block = new Block(this, i, j, this.r * HEX_CELL_SCALE)
        blocks[i][j] = block
        this.add.existing(block)
        block.on('player_click', this.playerClick, this)
      }
    }
    this.blocks = blocks
  }

  private createCat(): void {
    this.cat = new Cat(this)
    this.cat.on('escaped', () => {
      this.state = GameState.LOSE
      this.sound.play(MEOW_SOUND_KEY)
    })
    this.cat.on('win', () => {
      this.state = GameState.WIN
    })
    this.add.existing(this.cat)
  }

  private createHeader(): void {
    this.header = new HeaderBar(this)
    this.header.onReset(() => {
      this.reset()
    })
    this.header.onUndo(() => {
      this.undo()
    })
    this.add.existing(this.header)
  }

  private resetBlocks() {
    this.blocks.forEach((column) => {
      column.forEach((block) => {
        block.isWall = false
      })
    })
  }

  private randomWall() {
    if (this.initialWallCount <= 0) {
      return
    }

    for (let attempt = 0; attempt < MAX_RANDOM_WALL_ATTEMPTS; attempt++) {
      this.resetBlocks()

      const candidates = shuffle(
        filter(range(this.w * this.h), (index) => {
          const i = index % this.w
          const j = Math.floor(index / this.w)
          return i !== this.cat.i || j !== this.cat.j
        }),
      )

      for (let n = 0; n < this.initialWallCount; n++) {
        const index = candidates[n]
        const i = index % this.w
        const j = Math.floor(index / this.w)
        this.getBlock(i, j)!.isWall = true
      }

      if (isFairRandomStart(this.blocksData, this.cat.i, this.cat.j)) {
        return
      }
    }
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT)
    this.destroyView()
    this.tweens.killAll()
  }
}
