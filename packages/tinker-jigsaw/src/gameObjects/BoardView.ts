import Phaser from 'phaser'
import max from 'licia/max'
import min from 'licia/min'
import pluck from 'licia/pluck'
import shuffle from 'licia/shuffle'
import { COLORS, REST_SATURATION, SOLVED_FADE_MS } from '../game/constants'
import { padRatio, pieceTexture } from '../game/cutPiece'
import type { PieceCut } from '../game/Jigsaw'
import {
  PICTURE_HEIGHT,
  PICTURE_WIDTH,
  PREVIEW_TEXTURE,
} from '../game/paintPicture'
import { t } from '../lib/i18n'
import { FIELD_WIDTH, GAME_HEIGHT, HEADER_HEIGHT, HUD_TOP } from '../lib/layout'
import { s } from '../lib/scale'
import { motionDuration } from '../lib/util'
import { addSharpText } from '../ui/sharpText'

const SNAP_MS = 140
const REJOIN_MS = 220
const PARADE_MS = 46000
const QUEUE_SCALE = 0.42
const PARADE_FADE = 0.045

export interface PiecePlacement {
  id: number
  progress: number
  snapped: boolean
}

export class BoardView {
  private readonly root: Phaser.GameObjects.Container
  private readonly images = new Map<number, Phaser.GameObjects.Image>()
  private readonly snapped = new Set<number>()
  private readonly parade = new Map<number, number>()
  private readonly settling = new Map<number, Phaser.Tweens.Tween>()
  private ribbon!: Phaser.GameObjects.Container
  private cuts: PieceCut[] = []
  private grid = 3
  private cellW = 0
  private cellH = 0
  private padX = 0
  private padY = 0
  private fullW = 0
  private fullH = 0
  private queueW = 0
  private queueH = 0
  private contentW = 0
  private contentH = 0
  private originX = 0
  private originY = 0
  private paradeGap = 0
  private dragging: number | null = null
  private grabX = 0
  private grabY = 0
  private alive = true

  constructor(
    private scene: Phaser.Scene,
    private onProgress: (placed: number, total: number) => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1)
  }

  mount(cuts: PieceCut[], placements: PiecePlacement[] | null) {
    this.cuts = cuts
    this.grid = max(...pluck(cuts, 'row')) + 1
    this.measure()
    this.createGhost()
    this.createPieces(placements)
    this.createRibbon()
    this.bindPointer()
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate)
    this.onProgress(this.snapped.size, cuts.length)
    if (this.snapped.size === cuts.length) this.showSolved({ animate: false })
  }

  capture(): PiecePlacement[] {
    return this.cuts.map((piece) => ({
      id: piece.id,
      progress: this.paradeProgress(piece.id),
      snapped: this.snapped.has(piece.id),
    }))
  }

  private showSolved(options: { animate?: boolean } = {}) {
    const animate = options.animate !== false
    this.scene.tweens.killTweensOf(this.ribbon)
    this.ribbon.setVisible(true)
    this.root.bringToTop(this.ribbon)
    const duration = animate ? motionDuration(SOLVED_FADE_MS) : 0
    if (duration === 0) {
      this.ribbon.setAlpha(1)
      return
    }

    this.ribbon.setAlpha(0)
    this.scene.tweens.add({
      targets: this.ribbon,
      alpha: 1,
      duration,
    })
  }

  destroy() {
    this.alive = false
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate)
    this.scene.input.off('pointermove', this.onMove)
    this.scene.input.off('pointerup', this.onUp)
    for (const tween of this.settling.values()) tween.stop()
    this.settling.clear()
    for (const image of this.images.values()) {
      this.scene.tweens.killTweensOf(image)
    }
    if (this.ribbon) this.scene.tweens.killTweensOf(this.ribbon)
    this.root.destroy(true)
    this.images.clear()
  }

  private measure() {
    const pad = padRatio(this.grid)
    const fieldW = s(FIELD_WIDTH)
    const fieldH = s(GAME_HEIGHT)
    const top = s(HUD_TOP + HEADER_HEIGHT + 8)
    const gap = s(6)
    let lane = s(48)
    const fit = (laneWidth: number) => {
      const maxH = fieldH - top - laneWidth
      const maxW = fieldW - laneWidth * 2
      const contentW = min(maxW, (maxH * PICTURE_WIDTH) / PICTURE_HEIGHT)
      const contentH = (contentW * PICTURE_HEIGHT) / PICTURE_WIDTH
      const cellW = contentW / this.grid
      const cellH = contentH / this.grid
      return {
        contentW,
        contentH,
        cellW,
        cellH,
        fullW: cellW * (1 + pad.x * 2),
        fullH: cellH * (1 + pad.y * 2),
      }
    }
    for (let pass = 0; pass < 4; pass++) {
      const fitted = fit(lane)
      lane = max(fitted.fullW, fitted.fullH) * QUEUE_SCALE + gap + s(4)
    }
    const fitted = fit(lane)
    this.cellW = fitted.cellW
    this.cellH = fitted.cellH
    this.padX = this.cellW * pad.x
    this.padY = this.cellH * pad.y
    this.fullW = fitted.fullW
    this.fullH = fitted.fullH
    this.queueW = this.fullW * QUEUE_SCALE
    this.queueH = this.fullH * QUEUE_SCALE
    this.contentW = fitted.contentW
    this.contentH = fitted.contentH
    this.originX = (fieldW - fitted.contentW) / 2
    this.originY = top
    this.paradeGap = gap
  }

  private createGhost() {
    const ghost = this.scene.add
      .image(this.originX, this.originY, PREVIEW_TEXTURE)
      .setOrigin(0, 0)
      .setDisplaySize(this.contentW, this.contentH)
      .setAlpha(0.86)
      .setDepth(0)
    ghost.preFX?.addColorMatrix().saturate(REST_SATURATION)
    this.root.add(ghost)
  }

  private createPieces(placements: PiecePlacement[] | null) {
    const placed = new Map(placements?.map((item) => [item.id, item]))
    const loose = this.cuts.filter((piece) => !placed.get(piece.id)?.snapped)
    const fixed = this.cuts.filter((piece) => placed.get(piece.id)?.snapped)
    const order = placements
      ? [...fixed, ...shuffle(loose.slice())]
      : shuffle(this.cuts.slice())
    let paradeIndex = 0

    for (const piece of order) {
      const home = this.homeOf(piece)
      const spot = placed.get(piece.id)
      const snapped = spot?.snapped === true
      const image = this.scene.add
        .image(0, 0, pieceTexture(piece.id))
        .setOrigin(0, 0)
        .setDisplaySize(this.fullW, this.fullH)
      this.root.add(image)
      this.images.set(piece.id, image)
      if (snapped) {
        image.setPosition(home.x, home.y).setDepth(1)
        this.snapped.add(piece.id)
        continue
      }
      const progress =
        spot?.progress ?? (paradeIndex + 0.5) / max(1, loose.length)
      paradeIndex += 1
      this.parade.set(piece.id, progress)
      this.armPiece(image)
      image.on(
        'pointerdown',
        (
          pointer: Phaser.Input.Pointer,
          _x: number,
          _y: number,
          event: Phaser.Types.Input.EventData,
        ) => {
          event.stopPropagation()
          this.beginDrag(piece.id, pointer)
        },
      )
      this.poseOnParade(piece.id, progress)
    }
    this.root.sort('depth')
  }

  private createRibbon() {
    const label = addSharpText(this.scene, 0, 0, t('solved'), 16, {
      color: COLORS.ink,
    }).setOrigin(0.5)
    const padX = s(14)
    const padY = s(7)
    const width = label.width + padX * 2
    const height = label.height + padY * 2
    const bg = this.scene.add.graphics()
    bg.fillStyle(COLORS.brass, 1)
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, s(2))
    this.ribbon = this.scene.add.container(
      this.originX + this.contentW / 2,
      this.originY + this.contentH / 2,
      [bg, label],
    )
    this.ribbon.setVisible(false).setDepth(100000)
    this.root.add(this.ribbon)
  }

  private bindPointer() {
    this.scene.input.on('pointermove', this.onMove)
    this.scene.input.on('pointerup', this.onUp)
  }

  private readonly onUpdate = (_time: number, delta: number) => {
    if (!this.alive || this.parade.size === 0) return
    const step = min(delta, 48) / PARADE_MS
    for (const [id, progress] of this.parade) {
      const next = (progress + step) % 1
      this.parade.set(id, next)
      if (id === this.dragging || this.settling.has(id)) continue
      this.poseOnParade(id, next)
    }
    this.root.sort('depth')
  }

  private readonly onMove = (pointer: Phaser.Input.Pointer) => {
    if (this.dragging === null || !pointer.isDown) return
    this.images
      .get(this.dragging)
      ?.setPosition(pointer.x - this.grabX, pointer.y - this.grabY)
  }

  private readonly onUp = () => {
    if (this.dragging === null) return
    const id = this.dragging
    this.dragging = null
    this.trySnap(id)
  }

  private beginDrag(id: number, pointer: Phaser.Input.Pointer) {
    if (this.snapped.has(id)) return
    const image = this.images.get(id)
    if (!image) return
    this.killSettle(id)
    const scale = image.displayWidth / this.fullW || QUEUE_SCALE
    const localX = (pointer.x - image.x) / scale
    const localY = (pointer.y - image.y) / scale
    image.setDisplaySize(this.fullW, this.fullH).setAlpha(1).setDepth(50000)
    image.setPosition(pointer.x - localX, pointer.y - localY)
    this.dragging = id
    this.grabX = localX
    this.grabY = localY
    this.root.bringToTop(image)
  }

  private trySnap(id: number) {
    const image = this.images.get(id)
    const piece = this.cuts.find((item) => item.id === id)
    if (!image || !piece || this.snapped.has(id)) return
    const home = this.homeOf(piece)
    const distance = Math.hypot(
      (image.x - home.x) / this.cellW,
      (image.y - home.y) / this.cellH,
    )
    if (distance > 0.38) {
      this.rejoin(id)
      return
    }

    this.parade.delete(id)
    image.disableInteractive().setAlpha(1)
    const duration = motionDuration(SNAP_MS)
    const finish = () => {
      if (!this.alive) return
      this.snapped.add(id)
      this.onProgress(this.snapped.size, this.cuts.length)
      if (this.snapped.size === this.cuts.length) this.showSolved()
    }
    if (duration === 0) {
      image.setPosition(home.x, home.y).setDepth(1)
      finish()
      return
    }
    this.scene.tweens.add({
      targets: image,
      x: home.x,
      y: home.y,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: finish,
    })
  }

  private rejoin(id: number) {
    const image = this.images.get(id)
    if (!image || !this.parade.has(id)) return
    const dropX = image.x
    const dropY = image.y
    const duration = motionDuration(REJOIN_MS)
    this.killSettle(id)
    if (duration === 0) {
      this.poseOnParade(id, this.paradeProgress(id))
      return
    }

    const state = { t: 0 }
    const tween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (!this.alive) return
        const progress = this.paradeProgress(id)
        const point = this.pointOnParade(progress)
        const scale = 1 + (QUEUE_SCALE - 1) * state.t
        const width = this.fullW * scale
        const height = this.fullH * scale
        image.setDisplaySize(width, height)
        image.setPosition(
          dropX + (point.x - width / 2 - dropX) * state.t,
          dropY + (point.y - height / 2 - dropY) * state.t,
        )
        image.setAlpha(1 + (this.paradeAlpha(progress) - 1) * state.t)
      },
      onComplete: () => {
        if (this.settling.get(id) !== tween) return
        this.settling.delete(id)
        if (!this.alive || this.dragging === id) return
        this.poseOnParade(id, this.paradeProgress(id))
      },
    })
    this.settling.set(id, tween)
  }

  private killSettle(id: number) {
    const tween = this.settling.get(id)
    this.settling.delete(id)
    tween?.stop()
  }

  private poseOnParade(id: number, progress: number) {
    const image = this.images.get(id)
    if (!image) return
    const point = this.pointOnParade(progress)
    const alpha = this.paradeAlpha(progress)
    image.setDisplaySize(this.queueW, this.queueH)
    image.setPosition(point.x - this.queueW / 2, point.y - this.queueH / 2)
    image.setAlpha(alpha)
    image.setDepth(10 + point.y)
    // The wrap is invisible, so a faded piece should not steal the pointer.
    if (alpha < 0.35) image.disableInteractive()
    else if (!image.input?.enabled) this.armPiece(image)
  }

  private armPiece(image: Phaser.GameObjects.Image) {
    image.setInteractive({
      pixelPerfect: true,
      alphaTolerance: 8,
      useHandCursor: true,
    })
  }

  private paradeProgress(id: number) {
    return this.parade.get(id) ?? 0
  }

  // The top stays clear so the parade does not run through the header.
  private pointOnParade(progress: number) {
    const gap = this.paradeGap
    const xL = this.originX - gap - this.queueW / 2
    const xR = this.originX + this.contentW + gap + this.queueW / 2
    const yT = this.originY + this.queueH / 2
    const yB = this.originY + this.contentH + gap + this.queueH / 2
    const leftLen = yB - yT
    const bottomLen = xR - xL
    const total = leftLen + bottomLen + leftLen
    let distance = progress * total
    if (distance <= leftLen) return { x: xL, y: yT + distance }
    distance -= leftLen
    if (distance <= bottomLen) return { x: xL + distance, y: yB }
    distance -= bottomLen
    return { x: xR, y: yB - distance }
  }

  private paradeAlpha(progress: number) {
    if (progress < PARADE_FADE) return progress / PARADE_FADE
    if (progress > 1 - PARADE_FADE) return (1 - progress) / PARADE_FADE
    return 1
  }

  private homeOf(piece: PieceCut) {
    return {
      x: this.originX + piece.column * this.cellW - this.padX,
      y: this.originY + piece.row * this.cellH - this.padY,
    }
  }
}
