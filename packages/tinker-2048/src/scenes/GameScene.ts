import Phaser from 'phaser'
import {
  GameManager,
  type Actuator,
  type GameMetadata,
} from '../game/GameManager'
import type { Grid } from '../game/Grid'
import { bindKeyboard, bindSwipe } from '../game/input'
import { getSession, getStorage } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT } from '../scale'
import { Board } from '../gameObjects/Board'
import { GameOverlay } from '../gameObjects/GameOverlay'
import { ScorePanel } from '../gameObjects/ScorePanel'
import { TileLayer } from '../gameObjects/TileLayer'
import { SCENE_GAME } from './keys'

export class GameScene extends Phaser.Scene implements Actuator {
  private gameManager!: GameManager
  private board!: Board
  private tileLayer!: TileLayer
  private scorePanel!: ScorePanel
  private overlay!: GameOverlay
  private swipeBounds = new Phaser.Geom.Rectangle()
  private inputBound = false

  constructor() {
    super(SCENE_GAME)
  }

  init() {
    getSession(this).markInSession()
  }

  create() {
    applyRenderScale(this.game)
    this.buildView()
    this.startGame()
    this.bindInput()

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  actuate(grid: Grid, metadata: GameMetadata) {
    this.tileLayer.render(grid)
    this.scorePanel.updateScore(metadata.score)
    this.scorePanel.updateBestScore(metadata.bestScore)
    if (metadata.terminated) {
      if (metadata.over) {
        this.overlay.show(false)
      } else if (metadata.won) {
        this.overlay.show(true)
      }
    }
  }

  continueGame() {
    this.overlay.hide()
  }

  private startGame() {
    this.gameManager = new GameManager(getStorage(this), getSession(this), this)
  }

  private buildView() {
    this.destroyView()

    const storage = getStorage(this)
    const currentScore = this.gameManager?.score ?? 0

    this.board = new Board(this)
    this.tileLayer = new TileLayer(this, this.board.tileSize)
    this.scorePanel = new ScorePanel(this, storage.getBestScore(), currentScore)
    this.overlay = new GameOverlay(this, {
      onKeepPlaying: () => this.gameManager.continuePlaying(),
      onRestart: () => this.gameManager.restart(),
    })
    this.syncSwipeBounds()
  }

  private destroyView() {
    this.board?.destroy()
    this.tileLayer?.destroy()
    this.scorePanel?.destroy()
    this.overlay?.destroy()
  }

  private bindInput() {
    if (this.inputBound) return

    bindKeyboard(
      this,
      (direction) => this.gameManager.move(direction),
      () => this.gameManager.restart(),
    )
    bindSwipe(this, this.swipeBounds, (direction) =>
      this.gameManager.move(direction),
    )
    this.inputBound = true
  }

  private syncSwipeBounds() {
    this.swipeBounds.setTo(
      this.board.bounds.x,
      this.board.bounds.y,
      this.board.bounds.width,
      this.board.bounds.height,
    )
  }

  private relayout() {
    this.buildView()
    this.gameManager.refresh()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.gameManager?.refresh()
    this.inputBound = false
    this.destroyView()
    this.tweens.killAll()
  }
}
