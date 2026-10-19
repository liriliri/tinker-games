import Phaser from 'phaser'
import clamp from 'licia/clamp'
import find from 'licia/find'
import some from 'licia/some'
import { Game, type KeyState } from '../game/Game'
import { unlockAudio } from '../game/sfx'
import { TouchStick } from '../ui/TouchStick'

// OpenGW drops each stick axis inside 0.3 before it counts as input.
const PAD_DEAD = 0.3

const TEXTURE_KEY = 'geometry-fighter'

export const SCENE_GAME = 'Game'

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
  private stick = new TouchStick()
  private moveId: number | null = null
  private lastMoveId: number | null = null
  private aimId: number | null = null
  private aimX = 0
  private aimY = 0
  private moveAxis = { x: 0, y: 0 }
  private touchStamp = -Infinity

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.stick.destroy()
    })
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
    this.stick.setShown(this.usesTouch() && !this.engine.isTitle())

    const touchAiming = this.syncTouch()

    this.readPad()
    if (this.consumePauseEdge()) this.engine.requestPause()
    if (!touchAiming) this.syncPointer()

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
        x: this.moveAxis.x,
        y: this.moveAxis.y,
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
    const padMove = x !== 0 || y !== 0
    if (!padMove) {
      x = this.moveAxis.x
      y = this.moveAxis.y
    }
    const aimX = stickAxis(pad.axes[2])
    const aimY = stickAxis(pad.axes[3])
    const bomb = (pad.buttons[7]?.value ?? 0) > PAD_DEAD || padButton(pad, 7)
    if (padMove || aimX !== 0 || aimY !== 0 || padHeld(pad)) {
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
      if (pointer.wasTouch) this.touchStamp = performance.now()
      // A touch is followed by a compatibility mouse click at the same spot.
      if (!pointer.wasTouch && this.recentTouch()) return
      if (this.claimMove(pointer)) {
        this.engine.onPointerDown(true)
        return
      }
      if (pointer.wasTouch) {
        this.aimId = pointer.id
        if (this.lastMoveId === pointer.id) this.lastMoveId = null
      }
      const fire = pointer.wasTouch || pointer.leftButtonDown()
      this.engine.setPointer(
        clamp(pointer.worldX, 0, this.scale.width),
        clamp(pointer.worldY, 0, this.scale.height),
        fire,
        pointer.rightButtonDown(),
      )
      this.engine.onPointerDown(fire)
    })
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.releasePointer(pointer)
    })
  }

  // The stick stays in the corner, so only a finger that starts on it steers.
  private claimMove(pointer: Phaser.Input.Pointer) {
    if (!pointer.wasTouch || !this.stick.shown) return false
    if (this.moveId !== null) return false
    if (!this.stick.hit(pointer.x, pointer.y, this.game.canvas)) return false
    this.moveId = pointer.id
    this.lastMoveId = pointer.id
    this.stick.begin()
    this.moveAxis = this.stick.drag(pointer.x, pointer.y, this.game.canvas)
    return true
  }

  private releasePointer(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.moveId) {
      this.moveId = null
      this.lastMoveId = pointer.id
      this.moveAxis = { x: 0, y: 0 }
      this.stick.end()
    }
    if (pointer.id === this.aimId) this.aimId = null
  }

  private syncTouch() {
    const move = this.pointerById(this.moveId)
    if (move?.isDown) {
      this.touchStamp = performance.now()
      this.moveAxis = this.stick.drag(move.x, move.y, this.game.canvas)
    } else if (this.moveId !== null) {
      this.lastMoveId = this.moveId
      this.moveId = null
      this.moveAxis = { x: 0, y: 0 }
      this.stick.end()
    }

    const aim = this.pointerById(this.aimId)
    if (!aim?.isDown) {
      if (this.aimId !== null) this.aimId = null
      return false
    }
    this.touchStamp = performance.now()
    const w = this.scale.width
    const h = this.scale.height
    this.aimX = clamp(aim.worldX, 0, w)
    this.aimY = clamp(aim.worldY, 0, h)
    this.usingPad = false
    this.engine.setPointer(this.aimX, this.aimY, true, false)
    return true
  }

  private syncPointer() {
    const p = this.input.activePointer
    if (this.recentTouch() || (p.id === this.lastMoveId && p.wasTouch)) {
      this.engine.setPointer(this.aimX, this.aimY, false, false)
      return
    }
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
    this.aimX = clamp(p.worldX, 0, w)
    this.aimY = clamp(p.worldY, 0, h)
    this.engine.setPointer(
      this.aimX,
      this.aimY,
      p.leftButtonDown(),
      p.rightButtonDown(),
    )
  }

  private pointerById(id: number | null) {
    if (id === null) return null
    return find(this.input.manager.pointers, (pointer) => pointer.id === id)
  }

  private recentTouch() {
    return performance.now() - this.touchStamp < 800
  }

  private usesTouch() {
    return (
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    )
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
