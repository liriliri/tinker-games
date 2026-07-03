import Phaser from 'phaser'
import {
  GameManager,
  type Actuator,
  type CellState,
  type GameMetadata,
} from '../game/GameManager'
import type { LevelId } from '../game/levels'
import type { Grid } from '../game/SudokuEngine'
import { SCENE_GAME } from '../game/constants'
import { getStore, initRegistry } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT } from '../scale'
import { DigitPad } from '../gameObjects/DigitPad'
import { LevelDialog } from '../gameObjects/LevelDialog'
import { StatusBar } from '../gameObjects/StatusBar'
import { SudokuBoard } from '../gameObjects/SudokuBoard'
import { WinOverlay } from '../gameObjects/WinOverlay'
import { positionFromPoint } from '../gameObjects/gridLayout'

export class GameScene extends Phaser.Scene implements Actuator {
  private gameManager!: GameManager
  private board!: SudokuBoard
  private statusBar!: StatusBar
  private digitPad!: DigitPad
  private overlay!: WinOverlay
  private levelDialog!: LevelDialog
  private inputZone!: Phaser.GameObjects.Zone
  private backgroundZone!: Phaser.GameObjects.Zone
  private inputBound = false

  constructor() {
    super(SCENE_GAME)
  }

  create() {
    initRegistry(this.game)
    this.gameManager = new GameManager(getStore(this), this)
    applyRenderScale(this.game)

    this.levelDialog = new LevelDialog(this, (levelId) =>
      this.handleLevelSelect(levelId),
    )

    this.buildView()
    this.bindInput()
    this.gameManager.bindTimer(this)
    this.gameManager.startInitialPuzzle()

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  actuate(cells: CellState[][], metadata: GameMetadata, initialPuzzle: Grid) {
    if (!this.board || !this.statusBar || !this.digitPad || !this.overlay)
      return

    this.board.render(cells, metadata.selected, initialPuzzle)
    this.statusBar.update(
      metadata.levelId,
      metadata.elapsedSeconds,
      metadata.canReset,
      metadata.canHint,
    )
    if (metadata.completed) {
      this.overlay.show()
    } else {
      this.overlay.hide()
    }
  }

  updateStatus(metadata: GameMetadata) {
    this.statusBar?.update(
      metadata.levelId,
      metadata.elapsedSeconds,
      metadata.canReset,
      metadata.canHint,
    )
  }

  private buildView() {
    this.destroyView()

    this.board = new SudokuBoard(this)
    this.statusBar = new StatusBar(this, {
      onLevelClick: () => this.levelDialog.show(),
      onHint: () => this.gameManager.hint(),
      onReset: () => this.gameManager.reset(),
      onNewGame: () =>
        this.gameManager.requestNewPuzzle(this.gameManager.getLevelId()),
    })
    this.digitPad = new DigitPad(this, {
      onDigit: (digit) => this.gameManager.setDigit(digit),
    })
    this.overlay = new WinOverlay(this)

    this.inputZone = this.add
      .zone(
        this.board.bounds.x,
        this.board.bounds.y,
        this.board.bounds.width,
        this.board.bounds.height,
      )
      .setOrigin(0)
      .setInteractive()

    this.inputZone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const pos = positionFromPoint(pointer.x, pointer.y, this.board.cellSize)
      if (pos) {
        this.gameManager.selectCell(pos.row, pos.col)
      }
    })

    this.backgroundZone = this.add
      .zone(0, 0, this.scale.width, this.scale.height)
      .setOrigin(0)
      .setInteractive()
      .setDepth(-1)

    this.backgroundZone.on('pointerup', () => {
      this.gameManager.clearSelection()
    })
  }

  private bindInput() {
    if (this.inputBound) return

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key >= '1' && event.key <= '9') {
        this.gameManager.setDigit(Number(event.key))
        return
      }

      if (
        event.key === '0' ||
        event.key === 'Backspace' ||
        event.key === 'Delete'
      ) {
        this.gameManager.clearCell()
        return
      }

      switch (event.key) {
        case 'ArrowUp':
          this.gameManager.moveSelection(-1, 0)
          break
        case 'ArrowDown':
          this.gameManager.moveSelection(1, 0)
          break
        case 'ArrowLeft':
          this.gameManager.moveSelection(0, -1)
          break
        case 'ArrowRight':
          this.gameManager.moveSelection(0, 1)
          break
      }
    })

    this.inputBound = true
  }

  private handleLevelSelect(levelId: LevelId) {
    this.levelDialog.hide()
    this.overlay.hide()

    if (levelId === this.gameManager.getLevelId()) return

    this.gameManager.setLevel(levelId)
  }

  private destroyView() {
    this.board?.destroy()
    this.statusBar?.destroy()
    this.digitPad?.destroy()
    this.overlay?.destroy()
    this.inputZone?.destroy()
    this.backgroundZone?.destroy()
  }

  private relayout() {
    this.buildView()
    this.gameManager.refresh()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.gameManager.unbindTimer()
    this.levelDialog?.destroy()
    this.destroyView()
    this.tweens.killAll()
  }
}
