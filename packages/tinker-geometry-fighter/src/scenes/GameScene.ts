import Phaser from 'phaser'
import clamp from 'licia/clamp'
import find from 'licia/find'
import some from 'licia/some'
import { Game, type KeyState } from '../game/Game'
import { unlockAudio } from '../game/sfx'
import { SCENE_GAME } from './keys'

// OpenGW drops each stick axis inside 0.3 before it counts as input.
const PAD_DEAD = 0.3

const TEXTURE_KEY = 'geometry-fighter'

export class GameScene extends Phaser.Scene {
  private engine!: Game
  private canvasTex!: Phaser.Textures.CanvasTexture
  private displayImg!: Phaser.GameObjects.Image
  private keyState: KeyState = { a: false, w: false, s: false, d: false }
  private keyA!: Phaser.Input.Keyboard.Key
  private keyW!: Phaser.Input.Keyboard.Key
  private keyS!: Phaser.Input.Keyboard.Key
  private keyD!: Phaser.Input.Keyboard.Key
  private keyEsc!: Phaser.Input.Keyboard.Key
  private pauseEdge = false
  private padPauseWas = false
  private padStartWas = false
  private usingPad = false
  private pointerSeen = false
  private lastPointerX = 0
  private lastPointerY = 0

  constructor() {
    super(SCENE_GAME)
  }

  create() {
    const w = Math.max(1, Math.round(this.scale.width))
    const h = Math.max(1, Math.round(this.scale.height))

    this.canvasTex = this.textures.createCanvas(TEXTURE_KEY, w, h)!
    this.engine = new Game(this.canvasTex.context)
    this.engine.resize(w, h)

    this.displayImg = this.add.image(0, 0, TEXTURE_KEY).setOrigin(0)
    this.cameras.main.setPostPipeline('Glow')

    this.input.mouse?.disableContextMenu()
    this.bindKeys()
    this.bindPointer()
    this.scale.on('resize', this.onResize, this)
  }

  private onResize(gameSize: Phaser.Structs.Size) {
    const w = Math.max(1, Math.round(gameSize.width))
    const h = Math.max(1, Math.round(gameSize.height))
    this.canvasTex.setSize(w, h)
    this.engine.resize(w, h)
    this.displayImg.setDisplaySize(w, h)
    this.cameras.main.setSize(w, h)
  }

  update(_time: number, _delta: number) {
    this.keyState = {
      a: this.keyA?.isDown ?? false,
      w: this.keyW?.isDown ?? false,
      s: this.keyS?.isDown ?? false,
      d: this.keyD?.isDown ?? false,
    }
    this.engine.setKeys(this.keyState)

    const p = this.input.activePointer
    const w = this.scale.width
    const h = this.scale.height
    const dx = p.worldX - this.lastPointerX
    const dy = p.worldY - this.lastPointerY
    if (
      this.pointerSeen &&
      (p.leftButtonDown() || p.rightButtonDown() || dx * dx + dy * dy > 4)
    ) {
      this.usingPad = false
    }
    this.pointerSeen = true
    this.lastPointerX = p.worldX
    this.lastPointerY = p.worldY

    this.readPad()
    if (this.consumePauseEdge()) this.engine.requestPause()
    this.engine.setPointer(
      clamp(p.worldX, 0, w),
      clamp(p.worldY, 0, h),
      p.leftButtonDown(),
      p.rightButtonDown(),
    )

    if (this.engine.tick(performance.now())) this.canvasTex.refresh()
  }

  private bindKeys() {
    const kb = this.input.keyboard
    if (!kb) return

    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W)
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S)
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    // Latch the edge. A tap can go down and up before the next poll.
    this.keyEsc.on('down', () => {
      this.pauseEdge = true
    })
  }

  private readPad() {
    const pad = firstGamepad()
    if (!pad) {
      this.usingPad = false
      this.engine.setPad({
        x: 0,
        y: 0,
        aimX: 0,
        aimY: 0,
        aiming: false,
        bomb: false,
        hideCursor: false,
      })
      this.padPauseWas = false
      this.padStartWas = false
      return
    }

    let x = stickAxis(pad.axes[0])
    let y = stickAxis(pad.axes[1])
    if (padButton(pad, 14)) x = -1
    if (padButton(pad, 15)) x = 1
    if (padButton(pad, 12)) y = -1
    if (padButton(pad, 13)) y = 1
    const aimX = stickAxis(pad.axes[2])
    const aimY = stickAxis(pad.axes[3])
    const bomb = (pad.buttons[7]?.value ?? 0) > PAD_DEAD || padButton(pad, 7)
    if (x !== 0 || y !== 0 || aimX !== 0 || aimY !== 0 || padHeld(pad)) {
      this.usingPad = true
    }
    this.engine.setPad({
      x,
      y,
      aimX,
      aimY,
      aiming: aimX !== 0 || aimY !== 0,
      bomb,
      hideCursor: this.usingPad,
    })

    // South (A) is OpenGW's start, same as clicking to fire.
    const start = padButton(pad, 0)
    if (start && !this.padStartWas) {
      unlockAudio()
      this.engine.onPointerDown(true)
    }
    this.padStartWas = start
  }

  private consumePauseEdge() {
    const key = this.pauseEdge
    this.pauseEdge = false
    // Standard mapping: button 9 is Start, OpenGW's gamepad pause.
    const pad = !!firstGamepad()?.buttons[9]?.pressed
    const padEdge = pad && !this.padPauseWas
    this.padPauseWas = pad
    return key || padEdge
  }

  private bindPointer() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      unlockAudio()
      this.engine.setPointer(
        clamp(pointer.worldX, 0, this.scale.width),
        clamp(pointer.worldY, 0, this.scale.height),
        pointer.leftButtonDown(),
        pointer.rightButtonDown(),
      )
      this.engine.onPointerDown(pointer.leftButtonDown())
    })
  }
}

function firstGamepad() {
  const pads = navigator.getGamepads?.()
  if (!pads) return null
  return find(pads, (pad) => !!pad) ?? null
}

function stickAxis(value: number | undefined) {
  const v = value ?? 0
  const mag = Math.abs(v)
  if (mag < PAD_DEAD) return 0
  return Math.sign(v) * clamp((mag - PAD_DEAD) / (1 - PAD_DEAD), 0, 1)
}

function padButton(pad: Gamepad, index: number) {
  return !!pad.buttons[index]?.pressed
}

function padHeld(pad: Gamepad) {
  return some(
    pad.buttons,
    (button) => !!button?.pressed || (button?.value ?? 0) > PAD_DEAD,
  )
}
