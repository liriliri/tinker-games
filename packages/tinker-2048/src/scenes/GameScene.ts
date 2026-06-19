import Phaser from 'phaser'
import {
  GameManager,
  type Actuator,
  type GameMetadata,
} from '../game/GameManager'
import type { Grid } from '../game/Grid'
import {
  bindGamepad,
  bindKeyboard,
  bindSwipe,
  type GamepadBinding,
  type SwipeBinding,
} from '../game/input'
import { getStore } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT } from '../scale'
import { Board } from '../gameObjects/Board'
import { GameOverlay } from '../gameObjects/GameOverlay'
import { ScorePanel } from '../gameObjects/ScorePanel'
import { TileLayer } from '../gameObjects/TileLayer'
import { SCENE_GAME, SCENE_MENU } from './keys'

export class GameScene extends Phaser.Scene implements Actuator {
  private gameManager!: GameManager
  private board!: Board
  private tileLayer!: TileLayer
  private scorePanel!: ScorePanel
  private overlay!: GameOverlay
  private swipeBounds = new Phaser.Geom.Rectangle()
  private swipeBinding?: SwipeBinding
  private gamepadBinding?: GamepadBinding
  private inputBound = false
  private gameOverSoundPlayed = false

  constructor() {
    super(SCENE_GAME)
  }

  init() {
    const store = getStore(this)
    store.set('inSession', true)
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
    try {
      this.tileLayer.render(grid)
      this.scorePanel.updateScore(metadata.score)
      this.scorePanel.updateBestScore(metadata.bestScore)
      if (metadata.moved) {
        this.sound.play(metadata.merged ? 'merge' : 'move')
      }
      if (metadata.terminated) {
        if (metadata.over) {
          this.overlay.show(false)
          if (!this.gameOverSoundPlayed) {
            this.gameOverSoundPlayed = true
            this.sound.play('gameover')
          }
        } else if (metadata.won) {
          this.overlay.show(true)
        }
      }
    } catch (e) {
      console.warn('Actuate failed:', e)
    }
  }

  continueGame() {
    this.overlay.hide()
    this.gameOverSoundPlayed = false
  }

  private startGame() {
    this.gameManager = new GameManager(getStore(this), this)
  }

  private buildView() {
    this.destroyView()

    const store = getStore(this)
    const currentScore = this.gameManager?.score ?? 0

    this.board = new Board(this)
    this.tileLayer = new TileLayer(this, this.board.tileSize)
    this.scorePanel = new ScorePanel(
      this,
      store.get('bestScore') ?? 0,
      currentScore,
    )
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
    this.swipeBinding = bindSwipe(this, this.swipeBounds, (direction) =>
      this.gameManager.move(direction),
    )
    this.gamepadBinding = bindGamepad(
      this,
      (direction) => this.gameManager.move(direction),
      () => {
        this.gameManager.refresh()
        this.scene.start(SCENE_MENU)
      },
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
    this.swipeBinding?.updateBounds(this.swipeBounds)
  }

  private relayout() {
    this.buildView()
    this.gameManager.refresh()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.swipeBinding?.destroy()
    this.swipeBinding = undefined
    this.gamepadBinding?.destroy()
    this.gamepadBinding = undefined
    this.inputBound = false
    this.destroyView()
    this.tweens.killAll()
  }
}
