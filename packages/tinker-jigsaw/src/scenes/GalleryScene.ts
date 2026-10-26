import Phaser from 'phaser'
import { GALLERY } from '../game/gallery'
import { loadGalleryPictures } from '../game/paintPicture'
import { GalleryView } from '../gameObjects/GalleryView'
import { initStorage } from '../lib/storage'
import { applyRenderScale, RELAYOUT_EVENT } from '../lib/scale'
import { SCENE_GAME, type GameLaunch } from './GameScene'

export const SCENE_GALLERY = 'Gallery'

export class GalleryScene extends Phaser.Scene {
  private view?: GalleryView
  private alive = false
  private leaving = false

  constructor() {
    super(SCENE_GALLERY)
  }

  create() {
    this.alive = true
    this.leaving = false
    applyRenderScale(this.game)
    initStorage(this.game)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)
    void this.open()
  }

  private async open() {
    await loadGalleryPictures(GALLERY)
    if (!this.alive) return
    this.mount(0)
    this.events.on(RELAYOUT_EVENT, this.relayout, this)
  }

  private mount(scroll: number) {
    this.view = new GalleryView(this, scroll, (pictureId) => {
      this.choose(pictureId)
    })
  }

  private choose(pictureId: string) {
    if (this.leaving) return
    this.leaving = true
    this.scene.start(SCENE_GAME, { pictureId } satisfies GameLaunch)
  }

  private readonly relayout = () => {
    const scroll = this.view?.getScroll() ?? 0
    this.view?.destroy()
    this.mount(scroll)
  }

  private readonly shutdown = () => {
    this.alive = false
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.view?.destroy()
    this.view = undefined
  }
}
