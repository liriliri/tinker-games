import Phaser from 'phaser'
import { CUSTOM_PICTURE_ID, GALLERY } from '../game/gallery'
import {
  loadGalleryThumbs,
  loadPicture,
  rememberLocalPicture,
} from '../game/paintPicture'
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
    await loadGalleryThumbs(GALLERY)
    if (!this.alive) return
    this.mount(0)
    this.events.on(RELAYOUT_EVENT, this.relayout, this)
  }

  private mount(scroll: number) {
    this.view = new GalleryView(
      this,
      scroll,
      (pictureId) => {
        void this.choose(pictureId)
      },
      () => this.pick(),
    )
  }

  private async choose(pictureId: string) {
    if (this.leaving) return
    const item = GALLERY.find((entry) => entry.id === pictureId)
    if (!item) return
    this.leaving = true
    try {
      await loadPicture(item)
    } catch {
      this.leaving = false
      return
    }
    if (!this.alive) return
    this.scene.start(SCENE_GAME, { pictureId } satisfies GameLaunch)
  }

  private pick() {
    if (this.leaving) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    document.body.appendChild(input)
    const finish = () => input.remove()
    input.addEventListener('cancel', finish)
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      finish()
      if (!file) return
      void this.openPicked(file)
    })
    input.click()
  }

  private async openPicked(file: Blob) {
    if (this.leaving) return
    this.leaving = true
    try {
      await rememberLocalPicture(file)
    } catch {
      this.leaving = false
      return
    }
    if (!this.alive) return
    this.scene.start(SCENE_GAME, {
      pictureId: CUSTOM_PICTURE_ID,
    } satisfies GameLaunch)
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
