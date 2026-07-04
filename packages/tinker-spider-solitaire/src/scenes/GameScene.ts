import Phaser from 'phaser'
import { preloadGameAssets } from '../game/cardAssets'
import { SCENE_GAME } from '../game/constants'
import {
  GameManager,
  type Actuator,
  type GameMetadata,
} from '../game/GameManager'
import type {
  SpiderBoard,
  CompletedStackInfo,
  DealCardInfo,
} from '../game/SpiderBoard'
import { BoardBackground } from '../gameObjects/BoardBackground'
import { DifficultyDialog } from '../gameObjects/DifficultyDialog'
import { GameOverlay, Toast } from '../gameObjects/GameOverlay'
import { StatusBar } from '../gameObjects/StatusBar'
import { TableLayer } from '../gameObjects/TableLayer'
import { t } from '../i18n'
import { getStore, initRegistry } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT } from '../scale'

export class GameScene extends Phaser.Scene implements Actuator {
  private gameManager!: GameManager
  private boardBackground!: BoardBackground
  private tableLayer!: TableLayer
  private statusBar!: StatusBar
  private overlay!: GameOverlay
  private toast!: Toast
  private difficultyDialog!: DifficultyDialog
  private victorySoundPlayed = false

  constructor() {
    super(SCENE_GAME)
  }

  preload() {
    preloadGameAssets(this)
  }

  create() {
    initRegistry(this.game)
    this.gameManager = new GameManager(getStore(this), this)
    applyRenderScale(this.game)
    this.buildView()
    this.gameManager.startGame(this.gameManager.board.difficulty)

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  actuate(board: SpiderBoard, metadata: GameMetadata) {
    this.tableLayer.render(board)
    this.statusBar.update(metadata.score, metadata.moves, metadata.difficulty)

    if (metadata.won) {
      this.overlay.show()
      if (!this.victorySoundPlayed) {
        this.victorySoundPlayed = true
        this.sound.play('victory')
      }
    } else {
      this.overlay.hide()
      this.victorySoundPlayed = false
    }
  }

  showDealError() {
    this.toast.show(t('emptyColumn'))
  }

  animateDeal(
    board: SpiderBoard,
    dealt: DealCardInfo[],
    onComplete: () => void,
  ) {
    if (dealt.length > 0) {
      this.sound.play('deal')
    }
    this.tableLayer.animateDeal(board, dealt, onComplete)
  }

  animateCompletions(
    board: SpiderBoard,
    completions: CompletedStackInfo[],
    onComplete: () => void,
  ) {
    this.tableLayer.animateCompletions(board, completions, onComplete)
  }

  private buildView() {
    this.boardBackground = new BoardBackground(this)

    this.tableLayer = new TableLayer(this)
    this.tableLayer.setMoveHandler((sourceCol, startRow, targetCol) =>
      this.gameManager.moveStack(sourceCol, startRow, targetCol),
    )
    this.tableLayer.setStockInteractive(() => this.gameManager.dealFromStock())

    this.overlay = new GameOverlay(this)
    this.toast = new Toast(this)

    this.difficultyDialog = new DifficultyDialog(this, (difficulty) => {
      if (difficulty !== this.gameManager.board.difficulty) {
        this.gameManager.startGame(difficulty)
      }
    })

    this.statusBar = new StatusBar(this, {
      onNewGame: () => this.gameManager.restart(),
      onDifficultyClick: () => this.difficultyDialog.show(),
    })
  }

  private relayout() {
    applyRenderScale(this.game)
    this.boardBackground.rebuild()
    this.statusBar.rebuild()
    this.overlay.rebuild()
    this.difficultyDialog.rebuild()
    this.gameManager.refresh()
  }

  private onShutdown() {
    this.boardBackground?.destroy()
    this.tableLayer?.destroy()
    this.statusBar?.destroy()
    this.overlay?.destroy()
    this.toast?.destroy()
    this.difficultyDialog?.destroy()
  }
}
