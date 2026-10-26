import Phaser from 'phaser'
import clamp from 'licia/clamp'
import max from 'licia/max'
import min from 'licia/min'
import { REST_SATURATION } from '../game/constants'
import { GALLERY, galleryTexture } from '../game/gallery'
import { pictureCanvas } from '../game/paintPicture'
import { FIELD_WIDTH, GAME_HEIGHT, PAGE_PAD } from '../lib/layout'
import { s } from '../lib/scale'
import { motionDuration } from '../lib/util'

const VIEW_TOP = PAGE_PAD
const CARD_GAP = 10
const COLUMNS = 4
const FIT_ROWS = 4
const SATURATION_MS = 320

export class GalleryView {
  private readonly root: Phaser.GameObjects.Container
  private readonly content: Phaser.GameObjects.Container
  private readonly mask: Phaser.Display.Masks.GeometryMask
  private readonly viewTop: number
  private readonly viewHeight: number
  private readonly maxScroll: number
  private readonly baseY: number
  private scroll = 0
  private pointerStartY = 0
  private scrollAtDown = 0
  private moved = false
  private cards: Phaser.GameObjects.Container[] = []
  private tones: { value: number }[] = []

  constructor(
    private scene: Phaser.Scene,
    scroll: number,
    private onChoose: (pictureId: string) => void,
  ) {
    this.viewTop = s(VIEW_TOP)
    this.viewHeight = s(GAME_HEIGHT - PAGE_PAD) - this.viewTop
    const gap = s(CARD_GAP)
    const rows = Math.ceil(GALLERY.length / COLUMNS)
    const pad = s(PAGE_PAD)
    const innerWidth = s(FIELD_WIDTH) - pad * 2
    // Size from the first four rows so a full page is never clipped by rounding.
    const fitRows = min(rows, FIT_ROWS)
    let cardH = Math.floor((this.viewHeight - gap * (fitRows - 1)) / fitRows)
    let cardW = Math.floor((cardH * 16) / 9)
    const maxW = Math.floor((innerWidth - gap * (COLUMNS - 1)) / COLUMNS)
    if (cardW > maxW) {
      cardW = maxW
      cardH = Math.floor((cardW * 9) / 16)
    }
    const contentHeight = rows * cardH + max(0, rows - 1) * gap
    const spare = this.viewHeight - contentHeight
    this.maxScroll = max(0, -spare)
    this.baseY = this.viewTop + max(0, spare / 2)
    const rowWidth = COLUMNS * cardW + (COLUMNS - 1) * gap
    const originX = pad + Math.floor((innerWidth - rowWidth) / 2)

    this.root = scene.add.container(0, 0)

    const viewport = scene.add.container(0, 0)
    const maskGraphics = scene.make.graphics({}, false)
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(0, this.viewTop, s(FIELD_WIDTH), this.viewHeight)
    this.mask = maskGraphics.createGeometryMask()
    viewport.setMask(this.mask)

    this.content = scene.add.container(0, this.baseY)
    viewport.add(this.content)
    this.root.add(viewport)

    GALLERY.forEach((item, index) => {
      const col = index % COLUMNS
      const row = Math.floor(index / COLUMNS)
      const card = this.createCard(
        item.id,
        originX + col * (cardW + gap),
        row * (cardH + gap),
        cardW,
        cardH,
        index,
      )
      this.content.add(card)
      this.cards.push(card)
    })

    this.setScroll(scroll)
    scene.input.on('pointerdown', this.onDown)
    scene.input.on('pointermove', this.onMove)
    scene.input.on('wheel', this.onWheel)
  }

  getScroll() {
    return this.scroll
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onDown)
    this.scene.input.off('pointermove', this.onMove)
    this.scene.input.off('wheel', this.onWheel)
    for (const card of this.cards) this.scene.tweens.killTweensOf(card)
    for (const tone of this.tones) this.scene.tweens.killTweensOf(tone)
    this.mask.destroy()
    this.root.destroy(true)
  }

  private createCard(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    index: number,
  ) {
    const key = galleryTexture(id)
    if (!this.scene.textures.exists(key)) {
      this.scene.textures.addCanvas(key, pictureCanvas(id))
    }
    const image = this.scene.add
      .image(0, 0, key)
      .setOrigin(0, 0)
      .setDisplaySize(width, height)
    const root = this.scene.add.container(x, y, [image])
    this.bindSaturation(image, root)

    root.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    })
    root.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // A drag that scrolls the wall should not also open the picture.
      if (this.maxScroll > 0 && this.moved) return
      if (
        pointer.y < this.viewTop ||
        pointer.y > this.viewTop + this.viewHeight
      ) {
        return
      }
      this.onChoose(id)
    })

    const duration = motionDuration(280)
    if (duration === 0) return root
    root.setAlpha(0)
    this.scene.tweens.add({
      targets: root,
      alpha: 1,
      duration,
      delay: motionDuration(index * 28),
    })
    return root
  }

  private bindSaturation(
    image: Phaser.GameObjects.Image,
    root: Phaser.GameObjects.Container,
  ) {
    if (!image.preFX) return
    const color = image.preFX.addColorMatrix()
    const tone = { value: REST_SATURATION }
    this.tones.push(tone)
    color.saturate(REST_SATURATION)
    const fade = (value: number) => {
      this.scene.tweens.killTweensOf(tone)
      const duration = motionDuration(SATURATION_MS)
      if (duration === 0) {
        tone.value = value
        color.saturate(value)
        return
      }
      this.scene.tweens.add({
        targets: tone,
        value,
        duration,
        onUpdate: () => {
          color.saturate(tone.value)
        },
      })
    }
    root.on('pointerover', () => fade(0))
    root.on('pointerout', () => fade(REST_SATURATION))
  }

  private readonly onDown = (pointer: Phaser.Input.Pointer) => {
    this.pointerStartY = pointer.y
    this.scrollAtDown = this.scroll
    this.moved = false
  }

  private readonly onMove = (pointer: Phaser.Input.Pointer) => {
    if (!pointer.isDown || this.maxScroll <= 0) return
    const travel = pointer.y - this.pointerStartY
    if (Math.abs(travel) > s(8)) this.moved = true
    if (!this.moved) return
    this.setScroll(this.scrollAtDown - travel)
  }

  private readonly onWheel = (
    _pointer: Phaser.Input.Pointer,
    _objects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ) => {
    if (this.maxScroll <= 0) return
    this.moved = true
    this.setScroll(this.scroll + deltaY)
  }

  private setScroll(value: number) {
    this.scroll = clamp(value, 0, this.maxScroll)
    this.content.setY(this.baseY - this.scroll)
  }
}
