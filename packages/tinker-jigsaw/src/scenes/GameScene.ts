import Phaser from 'phaser'
import { cutPiece, pieceTexture } from '../game/cutPiece'
import { cutBoard, type JigsawSize, type PieceCut } from '../game/Jigsaw'
import { pictureCanvas, PREVIEW_TEXTURE } from '../game/paintPicture'
import { BoardView, type PiecePlacement } from '../gameObjects/BoardView'
import { Hud } from '../gameObjects/Hud'
import { getStorage, initStorage } from '../lib/storage'
import { applyRenderScale, RELAYOUT_EVENT } from '../lib/scale'
import { SCENE_GALLERY } from './GalleryScene'

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
  private size: JigsawSize = 3
  private pieceKeys: string[] = []
  private dealId = 0
  private texturedDeal = -1

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
    this.deal(getStorage(this).getSize())
    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
  }

  private deal(size: JigsawSize) {
    this.size = size
    this.cuts = cutBoard(size)
    this.placements = null
    this.dealId += 1
    this.rebuild()
  }

  private rebuild() {
    const placed = this.placements?.filter((item) => item.snapped).length ?? 0
    this.board?.destroy()
    this.hud?.destroy()
    this.syncTextures()
    this.hud = new Hud(this, placed, this.size * this.size, this.size, {
      onBack: () => this.scene.start(SCENE_GALLERY),
      onSize: (size) => this.setSize(size),
    })
    this.board = new BoardView(this, (nextPlaced, total) => {
      this.hud.setPlaced(nextPlaced, total)
    })
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
      this.textures.addCanvas(key, cutPiece(this.picture, piece, this.size))
      this.pieceKeys.push(key)
    }
    this.texturedDeal = this.dealId
  }

  private setSize(size: JigsawSize) {
    if (size === this.size) return
    getStorage(this).setSize(size)
    this.deal(size)
  }

  private readonly relayout = () => {
    this.placements = this.board.capture()
    this.rebuild()
  }

  private readonly shutdown = () => {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.board?.destroy()
    this.hud?.destroy()
  }
}
