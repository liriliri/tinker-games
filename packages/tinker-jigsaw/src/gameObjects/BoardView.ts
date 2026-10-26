import Phaser from 'phaser'
import max from 'licia/max'
import min from 'licia/min'
import pluck from 'licia/pluck'
import shuffle from 'licia/shuffle'
import { COLORS, REST_SATURATION, SOLVED_FADE_MS } from '../game/constants'
import { padRatio, pieceTexture, seamCanvas } from '../game/cutPiece'
import { boardGrid, type PieceCut } from '../game/jigsaw'
import { PREVIEW_TEXTURE } from '../game/paintPicture'
import { FIELD_WIDTH, GAME_HEIGHT, HEADER_HEIGHT, HUD_TOP } from '../lib/layout'
import { s } from '../lib/scale'
import { preloadSnapSound, playSnapSound } from '../lib/sound'
import { motionDuration } from '../lib/util'
import { addCountText } from '../ui/sharpText'

const SNAP_MS = 140
const REJOIN_MS = 220
const PARADE_MS = 108000
const QUEUE_SCALE = 0.32
const SEAM_TEXTURE = 'jigsaw-seams'
const COMBO_MAX = 5
// Long enough to pull the next card off the parade, short enough that waiting drops the chain.
const COMBO_WINDOW_MS = 10000
// A full lap is slow on purpose. Quarter speed is the crawl the combo buys.
const COMBO_SLOW_SCALE = 0.25
const COMBO_SLOW_MS = [0, 0, 2000, 3000, 4000]
const COMBO_REWIND_SLOTS = 3
const REWIND_BUDGET_MS = 480
const COMBO_FLOAT_MS = 670
const SLOW_BREATH_MS = 2800
const SLOW_ALPHA = 0.72
const DRAG_DEPTH = 50000
// The piece keeps its drag depth until the snap tween ends, so the number must sit above that.
const COMBO_DEPTH = 60000

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
  private seams!: Phaser.GameObjects.Image
  private finalImage!: Phaser.GameObjects.Image
  private cuts: PieceCut[] = []
  private columns = 1
  private rows = 1
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
  private failed = false
  private combo: number
  private comboUntil: number
  private slowUntil: number
  private rewinding = false
  private rewindLeft = 0
  private entranceCover?: Phaser.GameObjects.Graphics
  private entranceMask?: Phaser.Display.Masks.GeometryMask
  private readonly comboFloats: Phaser.GameObjects.Text[] = []

  constructor(
    private scene: Phaser.Scene,
    private pictureWidth: number,
    private pictureHeight: number,
    private fineLevel: number,
    private onProgress: (placed: number, total: number) => void,
    private onFail: () => void,
    combo = 0,
    comboUntil = 0,
    slowUntil = 0,
  ) {
    this.combo = combo
    this.comboUntil = comboUntil
    this.slowUntil = slowUntil
    preloadSnapSound()
    this.root = scene.add.container(0, 0).setDepth(1)
  }

  mount(cuts: PieceCut[], placements: PiecePlacement[] | null) {
    this.cuts = cuts
    this.rows = max(...pluck(cuts, 'row')) + 1
    this.columns = max(...pluck(cuts, 'column')) + 1
    this.measure()
    this.createEntranceMask()
    this.createGhost()
    this.createSeams()
    this.createPieces(placements)
    this.createFinalImage()
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
    this.scene.tweens.killTweensOf([this.seams, this.finalImage])
    const duration = animate ? motionDuration(SOLVED_FADE_MS) : 0
    if (duration === 0) {
      this.seams.setAlpha(0)
      this.finalImage.setAlpha(1)
      return
    }

    this.scene.tweens.add({
      targets: this.seams,
      alpha: 0,
      duration,
    })
    this.scene.tweens.add({
      targets: this.finalImage,
      alpha: 1,
      duration,
    })
  }

  destroy() {
    this.alive = false
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate)
    this.scene.input.off('pointermove', this.onMove)
    this.scene.input.off('pointerup', this.onUp)
    for (const label of this.comboFloats) this.scene.tweens.killTweensOf(label)
    for (const tween of this.settling.values()) tween.stop()
    this.settling.clear()
    for (const image of this.images.values()) {
      this.scene.tweens.killTweensOf(image)
    }
    if (this.seams) this.scene.tweens.killTweensOf(this.seams)
    if (this.finalImage) this.scene.tweens.killTweensOf(this.finalImage)
    this.root.destroy(true)
    this.entranceMask?.destroy()
    this.entranceCover?.destroy()
    this.entranceMask = undefined
    this.entranceCover = undefined
    if (this.scene.textures.exists(SEAM_TEXTURE)) {
      this.scene.textures.remove(SEAM_TEXTURE)
    }
    this.images.clear()
  }

  private measure() {
    const pad = padRatio(
      this.columns,
      this.rows,
      this.pictureWidth,
      this.pictureHeight,
    )
    const fieldW = s(FIELD_WIDTH)
    const fieldH = s(GAME_HEIGHT)
    const top = s(HUD_TOP + HEADER_HEIGHT + 8)
    const gap = s(6)
    // Sliding pieces stay the finest split's size, so coarser boards do not grow them.
    const fine = boardGrid(
      this.pictureWidth,
      this.pictureHeight,
      this.fineLevel,
    )
    const finePad = padRatio(
      fine.columns,
      fine.rows,
      this.pictureWidth,
      this.pictureHeight,
    )
    let lane = s(48)
    const fit = (laneWidth: number) => {
      const maxH = fieldH - top - laneWidth
      const maxW = fieldW - laneWidth * 2
      const contentW = min(
        maxW,
        (maxH * this.pictureWidth) / this.pictureHeight,
      )
      const contentH = (contentW * this.pictureHeight) / this.pictureWidth
      const cellW = contentW / fine.columns
      const cellH = contentH / fine.rows
      const fullW = cellW * (1 + finePad.x * 2)
      const fullH = cellH * (1 + finePad.y * 2)
      return {
        contentW,
        contentH,
        maxH,
        slot: max(fullW, fullH) * QUEUE_SCALE,
      }
    }
    for (let pass = 0; pass < 4; pass++) {
      const fitted = fit(lane)
      lane = fitted.slot + gap + s(4)
    }
    const fitted = fit(lane)
    this.contentW = fitted.contentW
    this.contentH = fitted.contentH
    this.cellW = this.contentW / this.columns
    this.cellH = this.contentH / this.rows
    this.padX = this.cellW * pad.x
    this.padY = this.cellH * pad.y
    this.fullW = this.cellW * (1 + pad.x * 2)
    this.fullH = this.cellH * (1 + pad.y * 2)
    const slide = fitted.slot / max(this.fullW, this.fullH)
    this.queueW = this.fullW * slide
    this.queueH = this.fullH * slide
    this.originX = (fieldW - this.contentW) / 2
    this.originY = top + (fitted.maxH - this.contentH) / 2
    this.paradeGap = gap
  }

  // Cards above this corner stay hidden, so each one slides out of the entrance instead of popping in whole.
  private createEntranceMask() {
    const graphics = this.scene.make.graphics({}, false)
    graphics.fillStyle(0xffffff)
    graphics.fillRect(0, this.originY, s(FIELD_WIDTH), s(GAME_HEIGHT))
    graphics.fillRect(this.originX, 0, s(FIELD_WIDTH), this.originY)
    this.entranceCover = graphics
    this.entranceMask = graphics.createGeometryMask()
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

  private createSeams() {
    if (this.scene.textures.exists(SEAM_TEXTURE)) {
      this.scene.textures.remove(SEAM_TEXTURE)
    }
    this.scene.textures.addCanvas(
      SEAM_TEXTURE,
      seamCanvas(
        this.columns,
        this.rows,
        this.cuts,
        this.contentW,
        this.contentH,
      ),
    )
    this.seams = this.scene.add
      .image(this.originX, this.originY, SEAM_TEXTURE)
      .setOrigin(0, 0)
      .setDisplaySize(this.contentW, this.contentH)
      .setDepth(0.5)
    this.root.add(this.seams)
  }

  private createFinalImage() {
    this.finalImage = this.scene.add
      .image(this.originX, this.originY, PREVIEW_TEXTURE)
      .setOrigin(0, 0)
      .setDisplaySize(this.contentW, this.contentH)
      .setAlpha(0)
      .setDepth(2)
    this.root.add(this.finalImage)
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
      const spread = (paradeIndex + 0.5) / max(1, loose.length)
      const progress =
        spot?.progress ??
        (motionDuration(1) === 0 ? spread : -paradeIndex * this.enterGap())
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

  private bindPointer() {
    this.scene.input.on('pointermove', this.onMove)
    this.scene.input.on('pointerup', this.onUp)
  }

  private readonly onUpdate = (_time: number, delta: number) => {
    if (!this.alive || this.failed || this.parade.size === 0) return
    this.releaseSlow()
    const slowing = this.scene.time.now < this.slowUntil
    if (this.rewinding) {
      const span = this.enterGap()
      const step = min(
        this.rewindLeft,
        (span * COMBO_REWIND_SLOTS * min(delta, 48)) / REWIND_BUDGET_MS,
      )
      const moved = this.pullParade(step)
      this.rewindLeft = max(0, this.rewindLeft - moved)
      if (moved <= 1e-6 || this.rewindLeft <= 1e-5) this.rewinding = false
    } else if (motionDuration(1) !== 0) {
      const scale = slowing ? COMBO_SLOW_SCALE : 1
      this.pushParade((min(delta, 48) / PARADE_MS) * scale)
    }
    for (const [id, progress] of this.parade) {
      if (id === this.dragging) continue
      if (this.settling.has(id) && !this.rewinding) continue
      this.poseOnParade(id, progress)
    }
    this.paintSlow(slowing)
    this.root.sort('depth')
  }

  // Queue cards ease between full and dim so the slow reads as a breath, not a blink.
  private paintSlow(slowing: boolean) {
    if (!slowing || motionDuration(1) === 0) return
    const phase = (this.scene.time.now % SLOW_BREATH_MS) / SLOW_BREATH_MS
    const breath = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2)
    const scale = 1 - (1 - SLOW_ALPHA) * breath
    for (const [id, image] of this.images) {
      if (!this.parade.has(id) || id === this.dragging || !image.visible)
        continue
      image.setAlpha(image.alpha * scale)
    }
  }

  // The entrance pushes the rearmost card. Cards past a gap stay put until that line closes up.
  // A piece settling into a slot holds that slot, so the line stops against it.
  private pushParade(step: number) {
    const ids = this.paradeIds(this.dragging)
    if (ids.length === 0) return
    const span = this.enterGap()
    const eps = 1e-4
    let count = 0
    while (count < ids.length && !this.settling.has(ids[count])) {
      if (
        count > 0 &&
        this.paradeProgress(ids[count]) >
          this.paradeProgress(ids[count - 1]) + span + eps
      ) {
        break
      }
      count += 1
    }
    for (let index = 0; index < count; index++) {
      const id = ids[index]
      this.parade.set(id, this.paradeProgress(id) + step)
    }
    if (count === 0) return
    let head = this.paradeProgress(ids[count - 1])
    const wall = count < ids.length ? ids[count] : undefined
    if (wall !== undefined && this.settling.has(wall)) {
      const limit = this.paradeProgress(wall) - span
      if (head > limit) {
        const overflow = head - limit
        for (let index = 0; index < count; index++) {
          const id = ids[index]
          this.parade.set(id, this.paradeProgress(id) - overflow)
        }
        head = limit
      }
    }
    if (head >= 1) {
      this.lose()
      return
    }
    while (
      count < ids.length &&
      !this.settling.has(ids[count]) &&
      this.paradeProgress(ids[count]) <= head + span + eps
    ) {
      head += span
      this.parade.set(ids[count], head)
      count += 1
      if (head >= 1) {
        this.lose()
        return
      }
    }
  }

  private lose() {
    if (this.failed) return
    this.failed = true
    this.dragging = null
    this.onFail()
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
    if (this.failed || this.snapped.has(id)) return
    if ((this.parade.get(id) ?? 0) < 0) return
    const image = this.images.get(id)
    if (!image) return
    this.killSettle(id)
    const scale = image.displayWidth / this.fullW || QUEUE_SCALE
    const localX = (pointer.x - image.x) / scale
    const localY = (pointer.y - image.y) / scale
    image
      .clearMask(false)
      .setDisplaySize(this.fullW, this.fullH)
      .setAlpha(1)
      .setDepth(DRAG_DEPTH)
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
      this.breakCombo()
      this.rejoin(id)
      return
    }

    this.raiseCombo(piece)
    playSnapSound()
    this.parade.delete(id)
    image.clearMask(false).disableInteractive().setAlpha(1)
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
    this.parade.set(id, this.firstGap(id))
    if (this.entranceMask) image.setMask(this.entranceMask)
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
        const point = this.pointOnParade(this.paradeProgress(id))
        const width = this.fullW + (this.queueW - this.fullW) * state.t
        const height = this.fullH + (this.queueH - this.fullH) * state.t
        image.setDisplaySize(width, height)
        image.setPosition(
          dropX + (point.x - width / 2 - dropX) * state.t,
          dropY + (point.y - height / 2 - dropY) * state.t,
        )
        image.setAlpha(1)
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
    image.setDisplaySize(this.queueW, this.queueH)
    image.setPosition(point.x - this.queueW / 2, point.y - this.queueH / 2)
    image.setAlpha(1)
    image.setDepth(10 + max(point.y, 0))
    if (this.entranceMask) image.setMask(this.entranceMask)
    const bottom = image.y + this.queueH
    if (progress >= 1 || bottom <= this.originY) {
      image.setVisible(false).disableInteractive()
      return
    }
    image.setVisible(true)
    if (progress < 0) {
      image.disableInteractive()
      return
    }
    if (!image.input?.enabled) this.armPiece(image)
  }

  private armPiece(image: Phaser.GameObjects.Image) {
    // Pixel tests miss the blanks and the clear margin, so a near click never starts a drag.
    const scaleX = this.queueW / image.width || 1
    const scaleY = this.queueH / image.height || 1
    const padX = s(8) / scaleX
    const padY = s(8) / scaleY
    image.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(
        -padX,
        -padY,
        image.width + padX * 2,
        image.height + padY * 2,
      ),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    })
  }

  getCombo() {
    this.expireCombo()
    return this.combo
  }

  getComboUntil() {
    return this.comboUntil
  }

  getSlowUntil() {
    return this.slowUntil
  }

  // A single cleared card has nothing behind it to chain, so the crawl would only stall that card.
  private releaseSlow() {
    if (this.revealedParadeCount() > 1) return
    this.slowUntil = 0
  }

  private revealedParadeCount() {
    let count = 0
    for (const progress of this.parade.values()) {
      if (progress >= 0 && progress < 1) count += 1
    }
    return count
  }

  private raiseCombo(piece: PieceCut) {
    this.expireCombo()
    this.combo = min(COMBO_MAX, this.combo + 1)
    this.comboUntil = this.scene.time.now + COMBO_WINDOW_MS
    this.floatCombo(piece, this.combo)
    const slow = COMBO_SLOW_MS[this.combo] ?? 0
    if (slow > 0 && this.revealedParadeCount() > 1) {
      this.slowUntil = this.scene.time.now + slow
    }
    if (this.combo < COMBO_MAX) return
    this.rewindParade()
    this.combo = 0
    this.comboUntil = 0
  }

  private breakCombo() {
    this.combo = 0
    this.comboUntil = 0
  }

  private expireCombo() {
    if (this.combo === 0 || this.scene.time.now <= this.comboUntil) return
    this.combo = 0
    this.comboUntil = 0
  }

  // Sits on the cell, then drifts up and fades the way a kill score does.
  private floatCombo(piece: PieceCut, combo: number) {
    const home = this.homeOf(piece)
    const x = home.x + this.padX + this.cellW / 2
    const y = home.y + this.padY + this.cellH / 2
    const label = addCountText(this.scene, x, y, `x${combo}`, 14, {
      color: COLORS.starText,
    })
      .setOrigin(0.5, 0.5)
      .setStroke(COLORS.ink, max(1, s(2)))
      .setDepth(COMBO_DEPTH)
    this.root.add(label)
    this.comboFloats.push(label)
    const drop = () => {
      const index = this.comboFloats.indexOf(label)
      if (index >= 0) this.comboFloats.splice(index, 1)
      label.destroy()
    }
    const duration = motionDuration(COMBO_FLOAT_MS)
    if (duration === 0) {
      this.scene.time.delayedCall(COMBO_FLOAT_MS, () => {
        if (this.alive) drop()
      })
      return
    }
    this.scene.tweens.add({
      targets: label,
      y: y - s(6),
      duration,
      ease: 'Linear',
      onComplete: () => {
        if (this.alive) drop()
      },
    })
    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      delay: duration * 0.55,
      duration: duration * 0.45,
      ease: 'Cubic.easeIn',
    })
  }

  // The front card walks backward and stops at the entrance.
  // Cards behind a gap stay put until it closes up and pushes them.
  private pullParade(step: number) {
    if (step <= 0) return 0
    const ids = this.paradeIds(this.dragging, true)
    if (ids.length === 0) return 0
    const applied = min(step, max(0, this.paradeProgress(ids[0])))
    if (applied <= 0) return 0
    const span = this.enterGap()
    const eps = 1e-4
    let count = 0
    while (count < ids.length) {
      if (
        count > 0 &&
        this.paradeProgress(ids[count - 1]) - this.paradeProgress(ids[count]) >
          span + eps
      ) {
        break
      }
      count += 1
    }
    for (let index = 0; index < count; index++) {
      const id = ids[index]
      this.parade.set(id, this.paradeProgress(id) - applied)
    }
    let back = this.paradeProgress(ids[count - 1])
    while (
      count < ids.length &&
      this.paradeProgress(ids[count]) >= back - span - eps
    ) {
      back -= span
      this.parade.set(ids[count], back)
      count += 1
    }
    return applied
  }

  // Open gaps, plus a few card slots after the line is packed again.
  // The front card cannot pass the entrance, so the pull stops at the start.
  private rewindTravel() {
    const span = this.enterGap()
    const eps = 1e-4
    const spots = this.paradeIds(this.dragging).map((id) =>
      this.paradeProgress(id),
    )
    if (spots.length === 0) return 0
    let slack = 0
    for (let index = 1; index < spots.length; index++) {
      const gap = spots[index] - spots[index - 1] - span
      if (gap > eps) slack += gap
    }
    const head = spots[spots.length - 1]
    return min(slack + span * COMBO_REWIND_SLOTS, max(0, head))
  }

  private rewindParade() {
    this.slowUntil = 0
    const distance = this.rewindTravel()
    if (distance <= 1e-6) return
    if (motionDuration(1) === 0) {
      this.pullParade(distance)
      return
    }
    this.rewindLeft = distance
    this.rewinding = true
  }

  private paradeIds(skip: number | null, newestFirst = false) {
    const ids: number[] = []
    for (const id of this.parade.keys()) {
      if (id === skip) continue
      ids.push(id)
    }
    ids.sort((left, right) => {
      const delta = this.paradeProgress(left) - this.paradeProgress(right)
      return newestFirst ? -delta : delta
    })
    return ids
  }

  private paradeProgress(id: number) {
    return this.parade.get(id) ?? 0
  }

  // First opening between cards, walking from the source. A slot sits one span after the card before the gap.
  // A packed line has no opening, so the card joins the front.
  private firstGap(id: number) {
    const span = this.enterGap()
    const eps = 1e-4
    const spots = this.paradeIds(id).map((other) => this.paradeProgress(other))
    for (let index = 0; index < spots.length - 1; index++) {
      if (spots[index + 1] - spots[index] >= span * 2 - eps) {
        return spots[index] + span
      }
    }
    if (spots.length === 0) return 0
    const head = spots[spots.length - 1] + span
    if (head < 1) return head
    return spots[0] - span
  }

  // Same speed as the cruise, spaced so pieces do not stack while they enter.
  private enterGap() {
    return (this.queueH + this.paradeGap) / max(this.paradeMetrics().total, 1)
  }

  // The top stays clear so the parade does not run through the header.
  private pointOnParade(progress: number) {
    const { xL, xR, yT, yB, leftLen, bottomLen, total } = this.paradeMetrics()
    let distance = progress * total
    if (distance <= leftLen) return { x: xL, y: yT + distance }
    distance -= leftLen
    if (distance <= bottomLen) return { x: xL + distance, y: yB }
    distance -= bottomLen
    return { x: xR, y: yB - distance }
  }

  private paradeMetrics() {
    const gap = this.paradeGap
    const xL = this.originX - gap - this.queueW / 2
    const xR = this.originX + this.contentW + gap + this.queueW / 2
    const yT = this.originY + this.queueH / 2
    const yB = this.originY + this.contentH + gap + this.queueH / 2
    const leftLen = yB - yT
    const bottomLen = xR - xL
    return {
      xL,
      xR,
      yT,
      yB,
      leftLen,
      bottomLen,
      total: leftLen + bottomLen + leftLen,
    }
  }

  private homeOf(piece: PieceCut) {
    return {
      x: this.originX + piece.column * this.cellW - this.padX,
      y: this.originY + piece.row * this.cellH - this.padY,
    }
  }
}
