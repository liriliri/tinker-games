import Phaser from 'phaser'
import { cutPiece, pieceTexture } from '../game/cutPiece'
import { boardGrid, cutBoard, type PieceCut } from '../game/jigsaw'
import { splitLevels } from '../game/splitLevels'
import { pictureCanvas, PREVIEW_TEXTURE } from '../game/paintPicture'
import { BoardView, type PiecePlacement } from '../gameObjects/BoardView'
import { ConfirmDialog } from '../gameObjects/ConfirmDialog'
import { Hud } from '../gameObjects/Hud'
import { SOLVED_FADE_MS } from '../game/constants'
import { t } from '../lib/i18n'
import { getStorage, initStorage, type SplitRank } from '../lib/storage'
import { applyRenderScale, RELAYOUT_EVENT } from '../lib/scale'
import { motionDuration } from '../lib/util'
import { SCENE_GALLERY } from './GalleryScene'

const CLEAR_HOLD_MS = 3000

export const SCENE_GAME = 'Game'

export interface GameLaunch {
  pictureId: string
}

export class GameScene extends Phaser.Scene {
  private pictureId = ''
  private previewId = ''
  private picture!: HTMLCanvasElement
  private hud!: Hud
  private board!: BoardView
  private cuts: PieceCut[] = []
  private placements: PiecePlacement[] | null = null
  private levels: number[] = [4, 5, 6]
  private level = 4
  private columns = 1
  private rows = 1
  private pieceKeys: string[] = []
  private dealId = 0
  private texturedDeal = -1
  private dialog: ConfirmDialog | null = null
  private solvedTimer?: Phaser.Time.TimerEvent
  private combo = 0
  private comboUntil = 0
  private slowUntil = 0

  constructor() {
    super(SCENE_GAME)
  }

  init(data: GameLaunch) {
    this.pictureId = data.pictureId
  }

  create() {
    initStorage(this.game)
    applyRenderScale(this.game)
    this.picture = pictureCanvas(this.pictureId)
    this.levels = splitLevels(this.picture)
    this.deal(this.levels[getStorage(this).getRank()])
    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }

  private deal(level: number) {
    this.level = level
    const grid = boardGrid(this.picture.width, this.picture.height, level)
    this.columns = grid.columns
    this.rows = grid.rows
    this.cuts = cutBoard(grid.columns, grid.rows)
    this.placements = null
    this.combo = 0
    this.comboUntil = 0
    this.slowUntil = 0
    this.dealId += 1
    this.rebuild()
  }

  private rebuild() {
    this.clearSolvedTimer()
    const placed = this.placements?.filter((item) => item.snapped).length ?? 0
    this.board?.destroy()
    this.hud?.destroy()
    this.syncTextures()
    this.hud = new Hud(
      this,
      placed,
      this.columns * this.rows,
      this.levels,
      this.level,
      getStorage(this).getBest(this.pictureId),
      {
        onBack: () =>
          this.ask(t('leavePrompt'), () => this.scene.start(SCENE_GALLERY)),
        onLevel: (level) => {
          if (level === this.level) return
          this.ask(t('switchPrompt'), () => this.setLevel(level))
        },
      },
    )
    this.board = new BoardView(
      this,
      this.picture.width,
      this.picture.height,
      this.levels[this.levels.length - 1],
      (nextPlaced, total) => {
        this.hud.setPlaced(nextPlaced, total)
        if (nextPlaced < total) return
        const best = getStorage(this).recordClear(
          this.pictureId,
          this.levels.indexOf(this.level),
        )
        if (best !== null) this.hud.setBest(best)
        this.noteSolved()
      },
      () => this.fail(),
      this.combo,
      this.comboUntil,
      this.slowUntil,
    )
    this.board.mount(this.cuts, this.placements)
  }

  private syncTextures() {
    if (this.previewId !== this.pictureId) {
      if (this.textures.exists(PREVIEW_TEXTURE)) {
        this.textures.remove(PREVIEW_TEXTURE)
      }
      this.textures.addCanvas(PREVIEW_TEXTURE, this.picture)
      this.previewId = this.pictureId
    }
    if (this.texturedDeal === this.dealId) return

    for (const key of this.pieceKeys) {
      if (this.textures.exists(key)) this.textures.remove(key)
    }
    this.pieceKeys = []
    for (const piece of this.cuts) {
      const key = pieceTexture(piece.id)
      this.textures.addCanvas(
        key,
        cutPiece(this.picture, piece, this.columns, this.rows),
      )
      this.pieceKeys.push(key)
    }
    this.texturedDeal = this.dealId
  }

  private ask(
    message: string,
    action: () => void,
    cancel: () => void = () => {},
    labels?: { confirm?: string; cancel?: string; solo?: boolean },
  ) {
    if (this.dialog) return
    const finish = (next: () => void) => {
      const dialog = this.dialog
      if (!dialog) return
      this.dialog = null
      this.time.delayedCall(0, () => {
        dialog.destroy()
        next()
      })
    }
    this.dialog = new ConfirmDialog(
      this,
      message,
      () => finish(action),
      () => finish(cancel),
      labels,
    )
  }

  private fail() {
    this.clearSolvedTimer()
    this.closeDialog()
    this.ask(
      t('failPrompt'),
      () => this.deal(this.level),
      () => this.scene.start(SCENE_GALLERY),
      { confirm: t('retry'), cancel: t('back') },
    )
  }

  private closeDialog() {
    this.dialog?.destroy()
    this.dialog = null
  }

  private noteSolved() {
    this.clearSolvedTimer()
    const wait = motionDuration(SOLVED_FADE_MS) + CLEAR_HOLD_MS
    this.solvedTimer = this.time.delayedCall(wait, () => this.offerNext())
  }

  private clearSolvedTimer() {
    this.solvedTimer?.remove(false)
    this.solvedTimer = undefined
  }

  private offerNext() {
    this.solvedTimer = undefined
    if (this.dialog) {
      this.noteSolved()
      return
    }
    const next = this.levels[this.levels.indexOf(this.level) + 1]
    if (next === undefined) {
      this.ask(
        t('clearPrompt'),
        () => {},
        () => this.scene.start(SCENE_GALLERY),
        { cancel: t('back'), solo: true },
      )
      return
    }
    this.ask(
      t('clearNextPrompt'),
      () => this.setLevel(next),
      () => this.scene.start(SCENE_GALLERY),
      { confirm: t('next'), cancel: t('back') },
    )
  }

  private setLevel(level: number) {
    const rank = this.levels.indexOf(level)
    if (rank < 0 || level === this.level) return
    getStorage(this).setRank(rank as SplitRank)
    this.deal(level)
  }

  private readonly relayout = () => {
    this.closeDialog()
    this.placements = this.board.capture()
    this.combo = this.board.getCombo()
    this.comboUntil = this.board.getComboUntil()
    this.slowUntil = this.board.getSlowUntil()
    this.rebuild()
  }

  private readonly shutdown = () => {
    this.clearSolvedTimer()
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.closeDialog()
    this.board?.destroy()
    this.hud?.destroy()
  }
}
