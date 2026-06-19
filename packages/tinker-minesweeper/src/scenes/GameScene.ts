import Phaser from 'phaser'
import {
  GameManager,
  type Actuator,
  type GameMetadata,
} from '../game/GameManager'
import type { MinesweeperBoard } from '../game/MinesweeperBoard'
import { getStorage } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT } from '../scale'
import { BoardFrame } from '../gameObjects/BoardFrame'
import { CellLayer } from '../gameObjects/CellLayer'
import { GameOverlay } from '../gameObjects/GameOverlay'
import { StatusBar } from '../gameObjects/StatusBar'
import { positionFromPoint } from '../gameObjects/gridLayout'
import { SCENE_GAME } from './keys'

type PendingAction = 'single' | 'multi' | ''

export class GameScene extends Phaser.Scene implements Actuator {
  private gameManager!: GameManager
  private boardFrame!: BoardFrame
  private cellLayer!: CellLayer
  private statusBar!: StatusBar
  private overlay!: GameOverlay
  private inputZone!: Phaser.GameObjects.Zone
  private pendingAction: PendingAction = ''
  private pendingPos: { row: number; col: number } | null = null
  private touchStartTime = 0
  private touchStartPos: { row: number; col: number } | null = null
  private touchMoved = false

  constructor() {
    super(SCENE_GAME)
  }

  create() {
    applyRenderScale(this.game)
    this.gameManager = new GameManager(getStorage(this), this)
    this.buildView()
    this.bindInput()
    this.gameManager.bindTimer(this)
    this.gameManager.refresh()

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  actuate(board: MinesweeperBoard, metadata: GameMetadata) {
    this.cellLayer.render(board)
    this.statusBar.update(metadata)
    if (metadata.terminated) {
      this.overlay.show(metadata.won)
    } else {
      this.overlay.hide()
    }
  }

  private buildView() {
    this.destroyView()

    this.boardFrame = new BoardFrame(this)
    this.cellLayer = new CellLayer(this, this.boardFrame.cellSize)
    this.statusBar = new StatusBar(this, () => this.gameManager.restart())
    this.overlay = new GameOverlay(this, {
      onRestart: () => this.gameManager.restart(),
    })

    this.inputZone = this.add
      .zone(
        this.boardFrame.bounds.x,
        this.boardFrame.bounds.y,
        this.boardFrame.bounds.width,
        this.boardFrame.bounds.height,
      )
      .setOrigin(0)
      .setInteractive()

    this.inputZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handlePointerDown(pointer)
    })

    this.input.mouse?.disableContextMenu()
  }

  private bindInput() {
    this.input.on('pointerup', () => {
      this.handlePointerUp()
    })

    this.input.on('pointermove', () => {
      if (this.touchStartPos) {
        this.touchMoved = true
      }
    })
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer) {
    const pos = positionFromPoint(
      pointer.x,
      pointer.y,
      this.boardFrame.cellSize,
    )
    if (!pos) return

    if (this.isTouchPointer(pointer)) {
      this.touchStartTime = Date.now()
      this.touchStartPos = pos
      this.touchMoved = false
      return
    }

    const chordIntent = this.isChordIntent(pointer)

    if (pointer.rightButtonDown() && !pointer.leftButtonDown()) {
      this.gameManager.changeCeilState(pos.row, pos.col)
      return
    }

    if (chordIntent) {
      this.pendingAction = 'multi'
      this.pendingPos = pos
      this.gameManager.previewCeils(pos.row, pos.col)
      return
    }

    if (!pointer.leftButtonDown()) return

    this.pendingAction = 'single'
    this.pendingPos = pos
    this.gameManager.previewOpen(pos.row, pos.col)
  }

  private handlePointerUp() {
    if (this.touchStartPos && !this.touchMoved) {
      const elapsed = Date.now() - this.touchStartTime
      const pos = this.touchStartPos
      this.touchStartPos = null

      if (elapsed >= 150) {
        this.gameManager.changeCeilState(pos.row, pos.col)
        this.resetPending()
        return
      }

      const cell = this.gameManager.board.getCell(pos.row, pos.col)
      if (cell.state === 'open' && cell.minesAround > 0) {
        this.gameManager.openCeils(pos.row, pos.col)
      } else {
        this.gameManager.openCeil(pos.row, pos.col)
      }
      this.resetPending()
      return
    }

    this.touchStartPos = null

    if (!this.pendingPos) {
      this.gameManager.clearPreview()
      return
    }

    const { row, col } = this.pendingPos
    if (this.pendingAction === 'single') {
      this.gameManager.openCeil(row, col)
    } else if (this.pendingAction === 'multi') {
      this.gameManager.openCeils(row, col)
    }

    this.resetPending()
  }

  private isTouchPointer(pointer: Phaser.Input.Pointer) {
    return pointer.event instanceof TouchEvent
  }

  private isChordIntent(pointer: Phaser.Input.Pointer) {
    const mouseEvent = pointer.event as MouseEvent | undefined
    return (
      pointer.middleButtonDown() ||
      (pointer.leftButtonDown() && pointer.rightButtonDown()) ||
      Boolean(
        mouseEvent?.ctrlKey ||
        mouseEvent?.altKey ||
        mouseEvent?.shiftKey ||
        mouseEvent?.metaKey,
      )
    )
  }

  private resetPending() {
    this.pendingAction = ''
    this.pendingPos = null
    this.gameManager.clearPreview()
  }

  private destroyView() {
    this.boardFrame?.destroy()
    this.cellLayer?.destroy()
    this.statusBar?.destroy()
    this.overlay?.destroy()
    this.inputZone?.destroy()
  }

  private relayout() {
    this.buildView()
    this.gameManager.refresh()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.gameManager.unbindTimer()
    this.destroyView()
    this.tweens.killAll()
  }
}
