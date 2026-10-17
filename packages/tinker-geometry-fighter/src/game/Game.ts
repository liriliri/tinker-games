import clamp from 'licia/clamp'
import each from 'licia/each'
import random from 'licia/random'
import { getBestScore, setBestScore } from '../lib/storage'
import { getFontFamily, t, tf } from '../lib/i18n'
import { setContextAttribute } from './colors'
import {
  BULLET_SPEED,
  CRUISER_BULLET_SPEED,
  CRUISER_FIRE_COUNT,
  CRUISER_FIRE_GAP,
  CRUISER_FIRE_PAUSE,
  CRUISER_HP,
  CRUISER_HP_MAX,
  CRUISER_INTERVAL_MAX,
  CRUISER_INTERVAL_MIN,
  CRUISER_SPAWN_FRAMES,
  CRUISER_WING_COUNT,
  CRUISER_WING_GAP,
  CRUISER_WING_PAUSE,
  EXTRA_BOMB_SCORE,
  EXTRA_LIFE_SCORE,
  FH,
  FW,
  GRID_H,
  GRID_W,
  HERO_RADIUS,
  MAP_H,
  MAP_W,
  MAX_SPAWN_INDEX,
  MULT_KILL_STEPS,
  PLAYER_BOMBS,
  PLAYER_LIVES,
  PLAYER_SHIELD_FRAMES,
  SHIELD_PICKUP_FRAMES,
  SHIELD_PICKUP_LIFE,
  FIELD_ITEM_INTERVAL_MIN,
  FIELD_ITEM_INTERVAL_MAX,
  FIELD_ITEM_INTERVAL_MAX_LATE,
  SLOW_FRAMES,
  ENEMY_SLOW_SCALE,
  PLAYER_SPEED,
  RESPAWN_FRAMES,
  SPAWN_CLEAR_RADIUS,
  SPAWN_MARGIN,
  TILESET,
  UNIT,
  WEAPON_PICKUP_INTERVAL_MAX,
  WEAPON_PICKUP_INTERVAL_MAX_LATE,
  WEAPON_PICKUP_INTERVAL_MIN,
  WEAPON_PICKUP_LIFE,
} from './constants'
import { drawLine, getAngle, path } from './draw'
import { DEFS, EXPLOSION, POOL, type Enemy, type EnemyKind } from './enemyTypes'
import { displaySegmentWord, displayWord } from './font'
import {
  bombSound,
  cruiserDie,
  cruiserSpawnSound,
  extraBombSound,
  extraLifeSound,
  fireSounds,
  heroDie,
  hitSounds,
  itemSound,
  pauseGameAudio,
  play,
  playRandom,
  powerupSound,
  resumeGameAudio,
  startGameMusic,
  stopGameMusic,
  unlockAudio,
} from './sfx'
import { Spawner } from './spawner'

export type KeyState = { a: boolean; w: boolean; s: boolean; d: boolean }

export type PadState = {
  x: number
  y: number
  aimX: number
  aimY: number
  aiming: boolean
  bomb: boolean
  hideCursor: boolean
}

interface BombRing {
  x: number
  y: number
  radius: number
  speed: number
  ttl: number
  alpha: number
  thickness: number
  phase: number
}

interface GridRipple {
  x: number
  y: number
  age: number
  life: number
  strength: number
  speed: number
}

interface FloatMsg {
  text: string
  x: number
  y: number
  ttl: number
}

interface Bolt {
  x: number
  y: number
  vx: number
  vy: number
}

interface WeaponPickup {
  x: number
  y: number
  vx: number
  vy: number
  ttl: number
  phase: number
}

interface FieldItem {
  kind: 'shield' | 'bomb' | 'slow'
  x: number
  y: number
  ttl: number
}

const FIELD_ITEM_KINDS: FieldItem['kind'][] = ['shield', 'bomb', 'slow']

/** OpenGW spreads: 1 → parallel pair → triple → five-way. */
const WEAPON_PATTERNS: {
  off: number
  ang: number
  muzzle: number
  /** Ship-local muzzle in hero radii. Nose is −Y. */
  local?: [number, number]
}[][] = [
  [{ off: 0, ang: 0, muzzle: 0 }],
  [
    { off: 0.4, ang: 0, muzzle: 2 },
    { off: -0.4, ang: 0, muzzle: 2 },
  ],
  [
    { off: 0, ang: 0, muzzle: 0.5 },
    { off: 0.8, ang: 0.06, muzzle: 2 },
    { off: -0.8, ang: -0.06, muzzle: 2 },
  ],
  [
    { off: 0, ang: 0, muzzle: 2 },
    { off: 0.1, ang: 0.05, muzzle: 2 },
    { off: -0.1, ang: -0.05, muzzle: 2 },
    { off: 0, ang: 0.42, muzzle: 0, local: [0.82, -0.12] },
    { off: 0, ang: -0.42, muzzle: 0, local: [-0.82, -0.12] },
  ],
]
const WEAPON_SHOTS = [1, 2, 3, 5]
/** Nose is −Y. Bright mass sits aft of the logic origin, so the sprite shifts forward. */
const HERO_ART_FORWARD = 0.34
/** Screen pixels, not grid units. */
const SHIELD_PICKUP_HALF = 17

/** Geometry Wars–style loop driven by OpenGW spawner logic. */
export class Game {
  private keys: KeyState = { a: false, w: false, s: false, d: false }
  private pointer = [0, 0, 0, 0]
  private pad: PadState = {
    x: 0,
    y: 0,
    aimX: 0,
    aimY: 0,
    aiming: false,
    bomb: false,
    hideCursor: false,
  }
  private splash = true
  private fade = 0
  private gameOver = false
  private paused = false
  private pauseRequested = false
  private armed = false
  private lastTime = 0
  private frame = 0

  private screenW = FW
  private screenH = FH

  /** Map → screen translate; OpenGW-style smooth follow. */
  private viewPort = [0, 0]
  private heroX = MAP_W / 2
  private heroY = MAP_H / 2
  private heroAngle = 0
  private fireCd = 0
  private lives = PLAYER_LIVES
  private bombs = PLAYER_BOMBS
  private shield = 0
  private slowLeft = 0
  private deadTimer = 0
  private heroAlive = true
  private score = 0
  private record = 0
  private newRecord = false
  private multiplier = 1
  private killCounter = 0
  private lifeCounter = 0
  private bombCounter = 0

  private bullets: Bolt[] = []
  private enemyBullets: Bolt[] = []
  private cruiserTimer = 0
  private particles: {
    x: number
    y: number
    vx: number
    vy: number
    ttl: number
    color: number
    scale?: number
  }[] = []
  private enemies: Enemy[] = []
  /** Spawn and running enemies only. Hot loops stay off the inactive pool. */
  private live: Enemy[] = []
  private runningIds = new Set<number>()
  private kindCount: Record<EnemyKind, number> = {
    wanderer: 0,
    grunt: 0,
    spinner: 0,
    tinySpinner: 0,
    weaver: 0,
    mayfly: 0,
    snake: 0,
    blackHole: 0,
    repulsor: 0,
    proton: 0,
    cruiser: 0,
  }
  private gridCols = 0
  private gridRows = 0
  private buckets: Enemy[][] = []
  private nearStamp = 0
  private nextGenId = 1
  private spawner = new Spawner()
  private bombRings: BombRing[] = []
  private gridRipples: GridRipple[] = []
  private floatMsgs: FloatMsg[] = []
  private bombHeld = false
  /** 0 single, 1 twin, 2 triple, 3 five-way. */
  private weapon = 0
  private weaponPickups: WeaponPickup[] = []
  private bombPickups: WeaponPickup[] = []
  private fieldItems: FieldItem[] = []
  private fieldItemTimer = 0
  private weaponPickupTimer = this.rollWeaponPickupDelay()
  /** Central fuselage (nose −Y), flat stern. */
  private heroHull: [number, number][] = [
    [0, -1.15],
    [0.24, -0.55],
    [0.3, 0.15],
    [0.28, 0.78],
    [-0.28, 0.78],
    [-0.3, 0.15],
    [-0.24, -0.55],
  ]
  /** Side thruster pods — long nacelles set aft. */
  private heroPodR: [number, number][] = [
    [0.58, -0.08],
    [0.98, 0.08],
    [1.08, 0.85],
    [0.82, 1.32],
    [0.6, 0.88],
  ]
  private heroPodL: [number, number][] = [
    [-0.58, -0.08],
    [-0.98, 0.08],
    [-1.08, 0.85],
    [-0.82, 1.32],
    [-0.6, 0.88],
  ]
  /** Small swept winglets on each pod. */
  private heroFinR: [number, number][] = [
    [1.0, 0.12],
    [1.55, 0.42],
    [1.42, 0.62],
    [1.02, 0.55],
  ]
  private heroFinL: [number, number][] = [
    [-1.0, 0.12],
    [-1.55, 0.42],
    [-1.42, 0.62],
    [-1.02, 0.55],
  ]
  /** Pylons bridging fuselage ↔ thruster pods. */
  private heroPylonR: [number, number][] = [
    [0.3, 0.06],
    [0.58, 0.14],
    [0.58, 0.42],
    [0.3, 0.34],
  ]
  private heroPylonL: [number, number][] = [
    [-0.3, 0.06],
    [-0.58, 0.14],
    [-0.58, 0.42],
    [-0.3, 0.34],
  ]
  private fieldStars: {
    x: number
    y: number
    size: number
    phase: number
    speed: number
  }[] = []
  /** Distant space-battle beams behind the playfield. */
  private bgLasers: {
    x0: number
    y0: number
    x1: number
    y1: number
    age: number
    life: number
    rgb: string
    width: number
    /** 0 = far/dim, 1 = nearer/brighter. */
    depth: number
  }[] = []

  constructor(private ctx: CanvasRenderingContext2D) {
    this.record = getBestScore()
    this.snapViewPort()
    this.initFieldStars()
    setTimeout(() => {
      this.armed = true
    }, 300)
  }

  resize(w: number, h: number) {
    this.screenW = Math.max(1, w)
    this.screenH = Math.max(1, h)
    this.snapViewPort()
    this.initFieldStars()
  }

  /** OpenGW camera target: keep fighter centered with soft edge bias. */
  private targetViewPort(): [number, number] {
    const border = -20 * UNIT
    const lookX = (this.heroX / MAP_W) * (MAP_W + border * 2) - border
    const lookY = (this.heroY / MAP_H) * (MAP_H + border * 2) - border
    return [this.screenW / 2 - lookX, this.screenH / 2 - lookY]
  }

  private snapViewPort() {
    const [tx, ty] = this.targetViewPort()
    this.viewPort[0] = tx
    this.viewPort[1] = ty
    this.clampViewPort()
  }

  private followViewPort() {
    const [tx, ty] = this.targetViewPort()
    // OpenGW: current += (target - current) / 30
    this.viewPort[0] += (tx - this.viewPort[0]) / 30
    this.viewPort[1] += (ty - this.viewPort[1]) / 30
    this.clampViewPort()
  }

  private clampViewPort() {
    if (MAP_W <= this.screenW) {
      this.viewPort[0] = (this.screenW - MAP_W) / 2
    } else {
      this.viewPort[0] = clamp(this.viewPort[0], this.screenW - MAP_W, 0)
    }
    if (MAP_H <= this.screenH) {
      this.viewPort[1] = (this.screenH - MAP_H) / 2
    } else {
      this.viewPort[1] = clamp(this.viewPort[1], this.screenH - MAP_H, 0)
    }
  }

  private initFieldStars() {
    this.fieldStars = []
    const count = Math.round((140 * (this.screenW * this.screenH)) / (FW * FH))
    for (let i = 0; i < count; i++) {
      this.fieldStars.push({
        x: Math.random() * this.screenW,
        y: Math.random() * this.screenH,
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.025 + Math.random() * 0.07,
      })
    }
  }

  setKeys(keys: KeyState) {
    this.keys = keys
  }

  setPointer(x: number, y: number, fire: boolean, bomb: boolean) {
    this.pointer[0] = x
    this.pointer[1] = y
    this.pointer[2] = fire ? 1 : 0
    this.pointer[3] = bomb ? 1 : 0
  }

  setPad(pad: PadState) {
    this.pad = pad
  }

  requestPause() {
    this.pauseRequested = true
  }

  onPointerDown(fire: boolean) {
    if (!this.armed) return
    unlockAudio()
    if (this.splash && fire) this.fade = 0.01
    if (this.gameOver && fire) this.init()
  }

  private init() {
    if (this.paused) resumeGameAudio()
    this.paused = false
    this.gameOver = false
    this.splash = false
    this.fade = 0
    this.frame = 0
    this.score = 0
    this.multiplier = 1
    this.killCounter = 0
    this.lifeCounter = 0
    this.bombCounter = 0
    this.lives = PLAYER_LIVES
    this.bombs = PLAYER_BOMBS
    this.shield = PLAYER_SHIELD_FRAMES
    this.slowLeft = 0
    this.deadTimer = 0
    this.heroAlive = true
    this.heroX = MAP_W / 2
    this.heroY = MAP_H / 2
    this.snapViewPort()
    this.bullets = []
    this.enemyBullets = []
    this.cruiserTimer = this.rollCruiserDelay()
    this.particles = []
    this.enemies = []
    this.live = []
    this.runningIds.clear()
    each(this.kindCount, (_count, kind) => {
      this.kindCount[kind as EnemyKind] = 0
    })
    this.bombRings = []
    this.gridRipples = []
    this.floatMsgs = []
    this.weapon = 0
    this.weaponPickups = []
    this.bombPickups = []
    this.fieldItems = []
    this.fieldItemTimer = this.rollFieldItemDelay()
    this.weaponPickupTimer = this.rollWeaponPickupDelay()
    this.nextGenId = 1
    this.newRecord = false
    this.record = getBestScore()
    this.spawner.init()
    startGameMusic()
  }

  tick(t: number) {
    if (!this.lastTime) this.lastTime = t
    const dt = Math.min(100, t - this.lastTime) / 1000
    this.lastTime = t

    // OpenGW: pause only during play. Logic returns; the last frame keeps drawing.
    this.pollPause()
    if (this.paused) {
      this.draw()
      return
    }

    this.frame++

    this.updateBgLasers()
    if (this.splash) {
      this.drawSplash()
    } else {
      if (!this.gameOver) this.update(dt)
      this.draw()
    }

    if (this.fade > 0) this.fade += 0.05
    if (this.fade > 1) this.init()
    if (this.fade > 0 && this.fade < 1) {
      setContextAttribute(this.ctx, -1, 1, `rgba(220,220,220,${this.fade})`)
      this.ctx.fillRect(0, 0, this.screenW, this.screenH)
    }
  }

  private pollPause() {
    if (!this.pauseRequested) return
    this.pauseRequested = false
    if (this.splash || this.gameOver || this.fade > 0) return
    this.paused = !this.paused
    if (this.paused) pauseGameAudio()
    else resumeGameAudio()
  }

  private update(_dt: number) {
    this.rebuildGrid()
    // OpenGW is frame-based; tick once per render frame.
    if (this.deadTimer > 0) {
      this.deadTimer--
      if (this.deadTimer === 0) {
        this.lives--
        if (this.lives <= 0) {
          this.gameOver = true
          stopGameMusic()
          if (this.score > this.record) {
            this.newRecord = true
            setBestScore(this.score)
            this.record = this.score
          }
        } else {
          this.heroAlive = true
          this.heroX = MAP_W / 2
          this.heroY = MAP_H / 2
          this.snapViewPort()
          this.shield = PLAYER_SHIELD_FRAMES
          this.bombs = PLAYER_BOMBS
          this.multiplier = 1
          this.killCounter = 0
        }
      }
    } else if (this.heroAlive) {
      this.updatePlayer()
    }

    this.updateBullets()
    this.updateEnemyBullets()
    this.updateEnemies()
    if (this.slowLeft > 0) this.slowLeft--
    this.updateCruiserSpawn()
    this.updateBombs()
    this.updateParticles()
    this.updateGridRipples()
    this.updateFloatMsgs()
    this.updateWeaponPickup()
    this.updateBombPickups()
    this.updateFieldItems()

    this.spawner.run({
      playerAlive: this.heroAlive && this.deadTimer <= 0,
      playerX: this.heroX,
      playerY: this.heroY,
      bombing: this.bombRings.some((r) => r.ttl > 0),
      countActive: (kind) => this.kindCount[kind],
      spawnEnemy: (kind, x, y) => this.spawnEnemy(kind, x, y),
      isEnemyAlive: (genId) => this.runningIds.has(genId),
    })

    if (this.shield > 0) this.shield--
    if (this.fireCd > 0) this.fireCd--
  }

  private updatePlayer() {
    const speed = PLAYER_SPEED
    const r = HERO_RADIUS

    const digital = this.keys.a || this.keys.w || this.keys.s || this.keys.d
    if (digital) {
      if (this.keys.a) this.heroX = Math.max(r, this.heroX - speed)
      if (this.keys.w) this.heroY = Math.max(r, this.heroY - speed)
      if (this.keys.s) this.heroY = Math.min(MAP_H - r, this.heroY + speed)
      if (this.keys.d) this.heroX = Math.min(MAP_W - r, this.heroX + speed)
    } else {
      const mag = Math.hypot(this.pad.x, this.pad.y)
      if (mag > 0) {
        const scale = clamp(mag, 0, 1) / mag
        this.heroX = clamp(
          this.heroX + this.pad.x * scale * speed,
          r,
          MAP_W - r,
        )
        this.heroY = clamp(
          this.heroY + this.pad.y * scale * speed,
          r,
          MAP_H - r,
        )
      }
    }
    this.followViewPort()

    if (this.pad.aiming) {
      this.heroAngle = Math.atan2(this.pad.aimY, this.pad.aimX)
    } else {
      this.heroAngle = getAngle(
        [this.heroX + this.viewPort[0], this.heroY + this.viewPort[1]],
        this.pointer,
      )
    }

    this.emitThrustParticles(digital || this.pad.x !== 0 || this.pad.y !== 0)

    if ((this.pointer[2] || this.pad.aiming) && this.fireCd <= 0) {
      this.fireWeapon()
      this.fireCd = 3
      playRandom(fireSounds)
    }

    const bombDown = this.pointer[3] > 0 || this.pad.bomb
    if (bombDown && !this.bombHeld && this.bombs > 0) {
      this.bombs--
      play(bombSound)
      this.bombRings.push({
        x: this.heroX,
        y: this.heroY,
        radius: 1.5 * UNIT,
        speed: 0.9 * UNIT,
        ttl: 90,
        alpha: 1,
        thickness: 2.5 * UNIT,
        phase: Math.random() * Math.PI * 2,
      })
      this.burst(this.heroX, this.heroY, 6, 36)
      this.spawnGridRipple(this.heroX, this.heroY)
    }
    this.bombHeld = bombDown

    if (this.shield <= 0) {
      const reach = HERO_RADIUS + 70
      this.eachNear(this.heroX, this.heroY, reach, (e) => {
        const hit = eRadius(e) + HERO_RADIUS * 0.55
        if (this.touches(e, this.heroX, this.heroY, hit * hit)) {
          this.killHero()
          return true
        }
        return false
      })
    }
  }

  private fireWeapon() {
    const pattern = WEAPON_PATTERNS[this.weapon] ?? WEAPON_PATTERNS[0]
    const aim = this.heroAngle
    const rot = aim + Math.PI / 2
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    for (const shot of pattern) {
      const velAng = aim + shot.ang
      let x = this.heroX
      let y = this.heroY
      if (shot.local) {
        const lx = shot.local[0] * HERO_RADIUS
        const ly = shot.local[1] * HERO_RADIUS
        x += lx * cos - ly * sin
        y += lx * sin + ly * cos
      } else {
        const spawnAng = aim + shot.off
        const dist = shot.muzzle * UNIT
        x += Math.cos(spawnAng) * dist
        y += Math.sin(spawnAng) * dist
      }
      this.bullets.push({
        x,
        y,
        vx: Math.cos(velAng) * BULLET_SPEED,
        vy: Math.sin(velAng) * BULLET_SPEED,
      })
    }
  }

  private rollDifficultyDelay(min: number, max: number, maxLate: number) {
    const t = clamp(this.spawner.getSpawnIndex() / MAX_SPAWN_INDEX, 0, 1)
    const ceiling = Math.round(max + (maxLate - max) * t)
    return min + random(0, ceiling - min)
  }

  private rollWeaponPickupDelay() {
    return this.rollDifficultyDelay(
      WEAPON_PICKUP_INTERVAL_MIN,
      WEAPON_PICKUP_INTERVAL_MAX,
      WEAPON_PICKUP_INTERVAL_MAX_LATE,
    )
  }

  private visibleSpawnRect(pad: number) {
    const viewLeft = -this.viewPort[0]
    const viewTop = -this.viewPort[1]
    return {
      left: Math.max(pad, viewLeft + pad),
      top: Math.max(pad, viewTop + pad),
      right: Math.min(MAP_W - pad, viewLeft + this.screenW - pad),
      bottom: Math.min(MAP_H - pad, viewTop + this.screenH - pad),
    }
  }

  private makeFloatingPickup(): WeaponPickup {
    const pad = 48
    const { left, top, right, bottom } = this.visibleSpawnRect(pad)
    const speed = 0.35 + Math.random() * 0.45
    const ang = Math.random() * Math.PI * 2
    return {
      x: left + Math.random() * Math.max(1, right - left),
      y: top + Math.random() * Math.max(1, bottom - top),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      ttl: WEAPON_PICKUP_LIFE,
      phase: 0,
    }
  }

  private spawnWeaponPickup() {
    this.weaponPickups.push(this.makeFloatingPickup())
    this.weaponPickupTimer = this.rollWeaponPickupDelay()
  }

  private spawnBombPickup() {
    this.bombPickups.push(this.makeFloatingPickup())
  }

  /** Moves a capsule in map space. Returns false when it expires. */
  private driftPickup(p: WeaponPickup): boolean {
    p.ttl--
    p.vx += (Math.random() - 0.5) * 0.06
    p.vy += (Math.random() - 0.5) * 0.06
    const sp = Math.hypot(p.vx, p.vy) || 1
    const max = 0.9
    if (sp > max) {
      p.vx = (p.vx / sp) * max
      p.vy = (p.vy / sp) * max
    }
    p.x += p.vx
    p.y += p.vy
    const m = 36
    if (p.x < m) {
      p.x = m
      p.vx = Math.abs(p.vx)
    } else if (p.x > MAP_W - m) {
      p.x = MAP_W - m
      p.vx = -Math.abs(p.vx)
    }
    if (p.y < m) {
      p.y = m
      p.vy = Math.abs(p.vy)
    } else if (p.y > MAP_H - m) {
      p.y = MAP_H - m
      p.vy = -Math.abs(p.vy)
    }
    return p.ttl > 0
  }

  private pickupHitsHero(p: WeaponPickup) {
    if (!this.heroAlive || this.deadTimer > 0) return false
    return Math.hypot(this.heroX - p.x, this.heroY - p.y) < HERO_RADIUS + 16
  }

  private updateWeaponPickup() {
    if (this.weapon < WEAPON_PATTERNS.length - 1) {
      this.weaponPickupTimer--
      if (this.weaponPickupTimer <= 0 && this.weaponPickups.length === 0) {
        this.spawnWeaponPickup()
      }
    }
    for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
      const p = this.weaponPickups[i]
      if (!this.driftPickup(p)) {
        this.weaponPickups.splice(i, 1)
        continue
      }
      if (!this.pickupHitsHero(p)) continue
      this.weapon = Math.min(WEAPON_PATTERNS.length - 1, this.weapon + 1)
      this.weaponPickups.splice(i, 1)
      play(powerupSound)
      this.floatMsgs.push({
        text: tf('weapon', { n: WEAPON_SHOTS[this.weapon] }),
        x: this.heroX,
        y: this.heroY,
        ttl: 50,
      })
    }
  }

  private updateBombPickups() {
    for (let i = this.bombPickups.length - 1; i >= 0; i--) {
      const p = this.bombPickups[i]
      if (!this.driftPickup(p)) {
        this.bombPickups.splice(i, 1)
        continue
      }
      if (!this.pickupHitsHero(p)) continue
      this.bombs++
      this.bombPickups.splice(i, 1)
      play(extraBombSound)
      this.floatMsgs.push({
        text: t('extraBomb'),
        x: this.heroX,
        y: this.heroY,
        ttl: 50,
      })
    }
  }

  private rollFieldItemDelay() {
    return this.rollDifficultyDelay(
      FIELD_ITEM_INTERVAL_MIN,
      FIELD_ITEM_INTERVAL_MAX,
      FIELD_ITEM_INTERVAL_MAX_LATE,
    )
  }

  private spawnRandomFieldItem() {
    const pad = 56
    const { left, top, right, bottom } = this.visibleSpawnRect(pad)
    if (right <= left || bottom <= top) return
    for (let n = 0; n < 8; n++) {
      const x = left + Math.random() * (right - left)
      const y = top + Math.random() * (bottom - top)
      if (Math.hypot(x - this.heroX, y - this.heroY) < 90) continue
      const kind = FIELD_ITEM_KINDS[random(0, FIELD_ITEM_KINDS.length - 1)]
      this.spawnFieldItem(kind, x, y)
      return
    }
  }

  private spawnFieldItem(kind: FieldItem['kind'], x: number, y: number) {
    this.fieldItems.push({ kind, x, y, ttl: SHIELD_PICKUP_LIFE })
  }

  private updateFieldItems() {
    if (this.heroAlive && this.deadTimer <= 0) {
      this.fieldItemTimer--
      if (this.fieldItemTimer <= 0) {
        this.fieldItemTimer = this.rollFieldItemDelay()
        if (this.fieldItems.length === 0) this.spawnRandomFieldItem()
      }
    }
    for (let i = this.fieldItems.length - 1; i >= 0; i--) {
      const p = this.fieldItems[i]
      p.ttl--
      if (p.ttl <= 0) {
        this.fieldItems.splice(i, 1)
        continue
      }
      if (!this.heroAlive || this.deadTimer > 0) continue
      if (
        Math.hypot(this.heroX - p.x, this.heroY - p.y) >=
        HERO_RADIUS + SHIELD_PICKUP_HALF
      ) {
        continue
      }
      if (p.kind === 'shield') this.shield = SHIELD_PICKUP_FRAMES
      else if (p.kind === 'bomb') this.detonateEnemies()
      else this.slowLeft = SLOW_FRAMES
      this.fieldItems.splice(i, 1)
      play(itemSound)
    }
  }

  private detonateEnemies() {
    for (let i = this.live.length - 1; i >= 0; i--) {
      this.destroyEnemy(this.live[i], true)
    }
  }

  private drawFieldItems() {
    const ctx = this.ctx
    const on = Math.floor(this.frame / 7) % 2 === 0
    ctx.save()
    ctx.lineJoin = 'miter'
    ctx.lineCap = 'round'
    for (const p of this.fieldItems) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.globalAlpha = on ? 0.95 : 0.2
      if (p.kind === 'shield') this.drawShieldGlyph(ctx)
      else if (p.kind === 'bomb') this.drawBombGlyph(ctx)
      else this.drawSlowGlyph(ctx)
      ctx.restore()
    }
    ctx.restore()
  }

  private drawShieldGlyph(ctx: CanvasRenderingContext2D) {
    this.drawItemFrame(ctx)
    setContextAttribute(ctx, -1, 1, '#fff')
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const outer = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      const inner = outer + Math.PI / 5
      const ox = Math.cos(outer) * 10.5
      const oy = Math.sin(outer) * 10.5
      if (i === 0) ctx.moveTo(ox, oy)
      else ctx.lineTo(ox, oy)
      ctx.lineTo(Math.cos(inner) * 4.2, Math.sin(inner) * 4.2)
    }
    ctx.closePath()
    ctx.fill()
  }

  private drawBombGlyph(ctx: CanvasRenderingContext2D) {
    this.drawItemFrame(ctx)
    setContextAttribute(ctx, -1, 1, '#fff')
    ctx.beginPath()
    ctx.arc(0, 3, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(-1.3, -5.2, 2.6, 3.4)
    setContextAttribute(ctx, -1, 0, '#fff')
    setContextAttribute(ctx, -1, 2, 1.6)
    ctx.beginPath()
    ctx.moveTo(0, -4)
    ctx.quadraticCurveTo(5, -6, 3.5, -9)
    ctx.stroke()
    setContextAttribute(ctx, -1, 1, '#ffe6a3')
    ctx.beginPath()
    ctx.arc(3.5, -9, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawSlowGlyph(ctx: CanvasRenderingContext2D) {
    this.drawItemFrame(ctx)
    setContextAttribute(ctx, -1, 1, '#fff')
    ctx.fillRect(-2.2, -12.5, 4.4, 3)
    setContextAttribute(ctx, -1, 0, '#fff')
    setContextAttribute(ctx, -1, 2, 1.6)
    ctx.beginPath()
    ctx.arc(0, 1.5, 8, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, 1.5)
    ctx.lineTo(0, -4.5)
    ctx.moveTo(0, 1.5)
    ctx.lineTo(4.2, 3.2)
    ctx.stroke()
  }

  private enemyPace() {
    return this.slowLeft > 0 ? ENEMY_SLOW_SCALE : 1
  }

  private drawItemFrame(ctx: CanvasRenderingContext2D) {
    const half = SHIELD_PICKUP_HALF
    setContextAttribute(ctx, -1, 0, '#fff')
    setContextAttribute(ctx, -1, 2, 1.9)
    ctx.beginPath()
    ctx.rect(-half, -half, half * 2, half * 2)
    ctx.stroke()
  }

  private drawWeaponPickup() {
    for (const p of this.weaponPickups) {
      this.drawCapsule(p, 'P', '#ffd630', '#fff4b0')
    }
    for (const p of this.bombPickups) {
      this.drawCapsule(p, 'B', '#3ddec0', '#e7fff8')
    }
  }

  private drawCapsule(
    p: WeaponPickup,
    letter: string,
    fill: string,
    edge: string,
  ) {
    const ctx = this.ctx
    const fade =
      p.ttl < 40
        ? p.ttl / 40
        : p.ttl > WEAPON_PICKUP_LIFE - 20
          ? (WEAPON_PICKUP_LIFE - p.ttl) / 20
          : 1
    const hw = 9
    const hh = 15
    ctx.save()
    ctx.translate(p.x + this.viewPort[0], p.y + this.viewPort[1])
    ctx.globalAlpha = fade
    ctx.beginPath()
    ctx.roundRect(-hw, -hh, hw * 2, hh * 2, hw)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineJoin = 'miter'
    ctx.lineWidth = 1
    ctx.strokeStyle = edge
    ctx.stroke()
    ctx.font = `500 ${Math.round(hh * 1.22)}px "Avenir Next", "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#000'
    ctx.fillText(letter, 0, 3)
    ctx.restore()
  }

  private killHero() {
    this.weapon = 0
    play(heroDie)
    this.burst(this.heroX, this.heroY, 6, 28, 2.4)
    this.heroAlive = false
    this.deadTimer = RESPAWN_FRAMES
    this.spawner.onPlayerDied()
    // Clear field like OpenGW single-player death cascade (soft clear)
    for (let i = this.live.length - 1; i >= 0; i--) {
      if (this.live[i].state === 'running')
        this.destroyEnemy(this.live[i], false)
    }
    this.enemyBullets = []
  }

  private rebuildGrid() {
    const cell = GRID_CELL
    const cols = Math.ceil(MAP_W / cell)
    const rows = Math.ceil(MAP_H / cell)
    const n = cols * rows
    if (this.buckets.length !== n) {
      this.buckets = []
      for (let i = 0; i < n; i++) this.buckets.push([])
    } else {
      for (let i = 0; i < n; i++) this.buckets[i].length = 0
    }
    this.gridCols = cols
    this.gridRows = rows
    for (let i = 0; i < this.live.length; i++) {
      const e = this.live[i]
      if (e.state !== 'running') continue
      this.placeInGrid(e, e.x, e.y)
      if (e.kind !== 'snake') continue
      for (let s = 0; s < e.body.length; s++) {
        this.placeInGrid(e, e.body[s].x, e.body[s].y)
      }
    }
  }

  private placeInGrid(e: Enemy, x: number, y: number) {
    const cell = GRID_CELL
    const c = clamp(Math.floor(x / cell), 0, this.gridCols - 1)
    const r = clamp(Math.floor(y / cell), 0, this.gridRows - 1)
    this.buckets[r * this.gridCols + c].push(e)
  }

  private eachNear(
    x: number,
    y: number,
    reach: number,
    visit: (e: Enemy) => boolean,
  ) {
    const cols = this.gridCols
    const rows = this.gridRows
    if (cols === 0) return
    const cell = GRID_CELL
    const c0 = clamp(Math.floor((x - reach) / cell), 0, cols - 1)
    const c1 = clamp(Math.floor((x + reach) / cell), 0, cols - 1)
    const r0 = clamp(Math.floor((y - reach) / cell), 0, rows - 1)
    const r1 = clamp(Math.floor((y + reach) / cell), 0, rows - 1)
    const reach2 = reach * reach
    const stamp = ++this.nearStamp
    for (let r = r0; r <= r1; r++) {
      const row = r * cols
      for (let c = c0; c <= c1; c++) {
        const bucket = this.buckets[row + c]
        for (let i = 0; i < bucket.length; i++) {
          const e = bucket[i]
          if (e.state !== 'running' || e.nearStamp === stamp) continue
          if (!this.touches(e, x, y, reach2)) continue
          e.nearStamp = stamp
          if (visit(e)) return
        }
      }
    }
  }

  /** Head, or any snake segment, within a squared radius. */
  private touches(e: Enemy, x: number, y: number, reach2: number) {
    const dx = e.x - x
    const dy = e.y - y
    if (dx * dx + dy * dy <= reach2) return true
    if (e.kind !== 'snake') return false
    for (let i = 0; i < e.body.length; i++) {
      const s = e.body[i]
      const sx = s.x - x
      const sy = s.y - y
      if (sx * sx + sy * sy <= reach2) return true
    }
    return false
  }

  private inRing(e: Enemy, x: number, y: number, inner: number, outer: number) {
    const hit = (px: number, py: number) => {
      const dx = px - x
      const dy = py - y
      const d2 = dx * dx + dy * dy
      return d2 < outer * outer && d2 > inner * inner
    }
    if (hit(e.x, e.y)) return true
    if (e.kind !== 'snake') return false
    for (let i = 0; i < e.body.length; i++) {
      if (hit(e.body[i].x, e.body[i].y)) return true
    }
    return false
  }

  private updateBullets() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.x += b.vx
      b.y += b.vy
      if (b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
        this.bullets.splice(i, 1)
        continue
      }
      let hit = false
      this.eachNear(b.x, b.y, 72, (e) => {
        const hitR = eRadius(e) + 4
        if (this.touches(e, b.x, b.y, hitR * hitR)) {
          this.hitEnemy(e)
          hit = true
          return true
        }
        return false
      })
      if (hit) this.bullets.splice(i, 1)
    }
  }

  private updateEnemyBullets() {
    const pace = this.enemyPace()
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i]
      b.x += b.vx * pace
      b.y += b.vy * pace
      if (b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
        this.enemyBullets.splice(i, 1)
        continue
      }
      if (
        this.heroAlive &&
        this.deadTimer <= 0 &&
        this.shield <= 0 &&
        Math.hypot(b.x - this.heroX, b.y - this.heroY) < HERO_RADIUS + 4
      ) {
        this.killHero()
        break
      }
    }
  }

  private cruiserHp() {
    const t = (this.spawner.getLevel() - 1) / (MAX_SPAWN_INDEX - 1)
    return Math.round(CRUISER_HP + t * (CRUISER_HP_MAX - CRUISER_HP))
  }

  private rollCruiserDelay() {
    return (
      CRUISER_INTERVAL_MIN +
      Math.floor(
        Math.random() * (CRUISER_INTERVAL_MAX - CRUISER_INTERVAL_MIN + 1),
      )
    )
  }

  private updateCruiserSpawn() {
    if (!this.heroAlive || this.deadTimer > 0) return
    if (this.cruiserTimer > 0) {
      this.cruiserTimer--
      return
    }
    const room = POOL.cruiser - this.kindCount.cruiser
    this.cruiserTimer = this.rollCruiserDelay()
    if (room <= 0) return
    const count = Math.min(room, Math.random() < 0.5 ? 1 : 2)
    for (let i = 0; i < count; i++) this.spawnCruiser()
  }

  private spawnCruiser() {
    const pad = 120
    const viewLeft = -this.viewPort[0]
    const viewTop = -this.viewPort[1]
    let x = this.heroX + SPAWN_CLEAR_RADIUS
    let y = this.heroY
    for (let i = 0; i < 16; i++) {
      const nx = clamp(
        viewLeft + pad + Math.random() * Math.max(1, this.screenW - pad * 2),
        pad,
        MAP_W - pad,
      )
      const ny = clamp(
        viewTop + pad + Math.random() * Math.max(1, this.screenH - pad * 2),
        pad,
        MAP_H - pad,
      )
      const clearOfHero =
        Math.hypot(nx - this.heroX, ny - this.heroY) >= SPAWN_CLEAR_RADIUS
      const clearOfCruiser = this.live.every(
        (e) => e.kind !== 'cruiser' || Math.hypot(e.x - nx, e.y - ny) >= 180,
      )
      if (clearOfHero && clearOfCruiser) {
        x = nx
        y = ny
        break
      }
    }
    x = clamp(x, pad, MAP_W - pad)
    y = clamp(y, pad, MAP_H - pad)
    this.spawnEnemy('cruiser', x, y)
  }

  private fireCruiser(e: Enemy) {
    const nose = DEFS.cruiser.radius * 1.2
    const ang = e.angle
    this.enemyBullets.push({
      x: e.x + Math.cos(ang) * nose,
      y: e.y + Math.sin(ang) * nose,
      vx: Math.cos(ang) * CRUISER_BULLET_SPEED,
      vy: Math.sin(ang) * CRUISER_BULLET_SPEED,
    })
  }

  private releaseTinySpinner(e: Enemy, port: boolean) {
    const side = e.angle + (port ? Math.PI / 2 : -Math.PI / 2)
    const dist = DEFS.cruiser.radius * 0.75
    this.spawnEnemy(
      'tinySpinner',
      e.x + Math.cos(side) * dist,
      e.y + Math.sin(side) * dist,
    )
  }

  private stepBurst(
    cd: number,
    left: number,
    count: number,
    gap: number,
    pause: number,
    release: (left: number) => void,
  ) {
    cd--
    if (left === 0) {
      if (cd > 0) return { cd, left }
      return { cd: 0, left: count }
    }
    if (cd > 0) return { cd, left }
    release(left)
    left--
    return { cd: left > 0 ? gap : pause, left }
  }

  private updateCruiserWings(e: Enemy) {
    const wing = this.stepBurst(
      e.wingCd,
      e.wingLeft,
      CRUISER_WING_COUNT,
      CRUISER_WING_GAP,
      CRUISER_WING_PAUSE,
      (left) => this.releaseTinySpinner(e, left % 2 === 0),
    )
    e.wingCd = wing.cd
    e.wingLeft = wing.left
  }

  private hitEnemy(e: Enemy) {
    if (e.kind === 'blackHole') {
      e.strength -= 0.35
      if (e.strength > 0.7) {
        playRandom(hitSounds)
        return
      }
    }
    if (e.kind === 'snake' && e.body.length > 0) {
      const tail = e.body.pop()
      if (tail) this.burst(tail.x, tail.y, DEFS.snake.color, 5)
      playRandom(hitSounds)
      return
    }
    if (e.hp > 1) {
      playRandom(hitSounds)
      e.hp--
      this.burst(e.x, e.y, DEFS[e.kind].color, 5)
      return
    }
    if (e.kind === 'spinner' && !e.split) {
      e.split = true
      this.spawnEnemy('tinySpinner', e.x + 1.25 * UNIT, e.y)
      this.spawnEnemy('tinySpinner', e.x - 1.25 * UNIT, e.y)
    }
    this.destroyEnemy(e, true)
  }

  private destroyEnemy(e: Enemy, scoreIt: boolean) {
    if (e.state === 'inactive') return
    const def = DEFS[e.kind]
    const boom = EXPLOSION[e.kind]
    this.burst(e.x, e.y, def.color, boom.n, boom.scale)
    this.spawnGridRipple(e.x, e.y)
    playRandom(hitSounds)
    if (scoreIt && this.heroAlive) {
      this.addKill(def.score, e.x, e.y)
      if (e.kind === 'cruiser') play(cruiserDie)
    }
    e.state = 'inactive'
    this.runningIds.delete(e.genId)
    this.kindCount[e.kind]--
    this.unlink(e)
  }

  private unlink(e: Enemy) {
    const i = e.liveIndex
    if (i < 0) return
    const last = this.live.pop()
    if (last && last !== e) {
      this.live[i] = last
      last.liveIndex = i
    }
    e.liveIndex = -1
  }

  private addKill(base: number, x: number, y: number) {
    const earned = base * this.multiplier
    this.score += earned
    this.lifeCounter += earned
    this.bombCounter += earned

    if (this.bombCounter >= EXTRA_BOMB_SCORE) {
      this.bombCounter = 0
      this.spawnBombPickup()
    }
    if (this.lifeCounter >= EXTRA_LIFE_SCORE) {
      this.lifeCounter = 0
      this.lives++
      play(extraLifeSound)
      this.floatMsgs.push({
        text: t('extraLife'),
        x,
        y,
        ttl: 50,
      })
    }

    this.killCounter++
    const need = MULT_KILL_STEPS[this.multiplier - 1]
    if (need !== undefined && this.killCounter >= need) {
      this.killCounter = 0
      this.multiplier++
      this.floatMsgs.push({
        text: tf('multiplier', { n: this.multiplier }),
        x,
        y,
        ttl: 50,
      })
      return
    }
    this.floatMsgs.push({
      text: String(earned),
      x,
      y,
      ttl: 40,
    })
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number) {
    if (this.kindCount[kind] >= POOL[kind]) return null

    let e = this.enemies.find(
      (en) => en.kind === kind && en.state === 'inactive',
    )
    if (!e) {
      e = {
        genId: 0,
        kind,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        angle: 0,
        aggression: 1,
        state: 'inactive',
        spawnTimer: 0,
        anim: 0,
        strength: 1,
        heading: Math.random() * Math.PI * 2,
        split: false,
        hp: 1,
        fireCd: 0,
        fireLeft: 0,
        wingCd: 0,
        wingLeft: 0,
        liveIndex: -1,
        body: [],
        trail: [],
        nearStamp: 0,
      }
      this.enemies.push(e)
    }
    e.genId = this.nextGenId++
    this.kindCount[kind]++
    e.liveIndex = this.live.length
    this.live.push(e)
    e.x = x
    e.y = y
    e.vx = 0
    e.vy = 0
    e.aggression = 1
    e.state = 'spawn'
    e.spawnTimer = kind === 'cruiser' ? CRUISER_SPAWN_FRAMES : 40
    e.anim = 0
    e.strength = kind === 'blackHole' ? 2 : 1
    e.heading = Math.random() * Math.PI * 2
    e.split = false
    e.hp = kind === 'cruiser' ? this.cruiserHp() : 1
    e.fireCd = kind === 'cruiser' ? CRUISER_FIRE_GAP : 0
    e.fireLeft = kind === 'cruiser' ? CRUISER_FIRE_COUNT : 0
    e.wingCd = kind === 'cruiser' ? CRUISER_WING_PAUSE : 0
    e.wingLeft = 0
    e.body = []
    e.trail = []
    e.nearStamp = 0
    if (kind === 'snake') {
      e.fireCd = random(28, 85)
      this.layoutSnake(e, random(SNAKE_MIN, SNAKE_MAX) - 1)
    }
    if (kind === 'cruiser') {
      e.angle = Math.random() * Math.PI * 2
      play(cruiserSpawnSound)
      this.burst(x, y, DEFS.cruiser.color, 18)
      this.spawnGridRipple(x, y)
    }
    return { genId: e.genId }
  }

  /** `segments` is the body count behind the head. Trail is laid out along the heading. */
  private layoutSnake(e: Enemy, segments: number) {
    const hx = Math.cos(e.heading)
    const hy = Math.sin(e.heading)
    const steps = Math.ceil((segments * SNAKE_GAP) / SNAKE_SPEED) + 2
    e.trail = []
    for (let i = steps; i >= 0; i--) {
      e.trail.push({
        x: e.x - hx * SNAKE_SPEED * i,
        y: e.y - hy * SNAKE_SPEED * i,
      })
    }
    e.body = []
    for (let i = 1; i <= segments; i++) {
      e.body.push(pointBehind(e.trail, i * SNAKE_GAP))
    }
  }

  private stepSnake(e: Enemy) {
    if (e.fireCd <= 0) {
      e.heading += random(-1.1, 1.1)
      e.fireCd = random(28, 85)
    } else {
      e.fireCd--
    }
    const step = SNAKE_SPEED * this.enemyPace()
    const margin = SPAWN_MARGIN
    const aheadX = e.x + Math.cos(e.heading) * step
    const aheadY = e.y + Math.sin(e.heading) * step
    if (aheadX < margin || aheadX > GRID_W - margin)
      e.heading = Math.PI - e.heading
    if (aheadY < margin || aheadY > GRID_H - margin) e.heading = -e.heading
    e.x += Math.cos(e.heading) * step
    e.y += Math.sin(e.heading) * step
    e.vx = 0
    e.vy = 0
    e.trail.push({ x: e.x, y: e.y })
    const keep = Math.ceil(((e.body.length + 1) * SNAKE_GAP) / SNAKE_SPEED) + 3
    if (e.trail.length > keep) e.trail.splice(0, e.trail.length - keep)
    for (let i = 0; i < e.body.length; i++) {
      const p = pointBehind(e.trail, (i + 1) * SNAKE_GAP)
      e.body[i].x = p.x
      e.body[i].y = p.y
    }
  }

  private updateEnemies() {
    for (let i = 0; i < this.live.length; i++) {
      const e = this.live[i]
      if (e.state === 'spawn') {
        e.spawnTimer--
        if (e.spawnTimer <= 0) {
          e.state = 'running'
          this.runningIds.add(e.genId)
        }
        continue
      }
      e.aggression += 0.0002
      e.anim += 0.07
      this.ai(e)
      if (e.state === 'inactive') {
        i--
        continue
      }
      const pace = this.enemyPace()
      e.x += e.vx * pace
      e.y += e.vy * pace
      e.x = clamp(e.x, 1, GRID_W - 1)
      e.y = clamp(e.y, 1, GRID_H - 1)
    }
  }

  private ai(e: Enemy) {
    const hx = this.heroX
    const hy = this.heroY
    const ang = Math.atan2(hy - e.y, hx - e.x)

    switch (e.kind) {
      case 'wanderer': {
        if (Math.random() * 40 < 1) {
          e.heading += (Math.random() - 0.5) * 1.5
        }
        e.vx += Math.cos(e.heading) * 0.01 * UNIT
        e.vy += Math.sin(e.heading) * 0.01 * UNIT
        const sp = Math.hypot(e.vx, e.vy)
        const max = 0.35 * UNIT
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        e.vx *= 0.99
        e.vy *= 0.99
        if (e.x < SPAWN_MARGIN || e.x > GRID_W - SPAWN_MARGIN) e.vx *= -1
        if (e.y < SPAWN_MARGIN || e.y > GRID_H - SPAWN_MARGIN) e.vy *= -1
        break
      }
      case 'grunt':
      case 'tinySpinner':
      case 'proton': {
        e.vx += Math.cos(ang) * 0.01 * UNIT
        e.vy += Math.sin(ang) * 0.01 * UNIT
        const max = 0.4 * UNIT * e.aggression * (e.kind === 'proton' ? 1.4 : 1)
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        e.vx *= 0.99
        e.vy *= 0.99
        if (e.kind === 'tinySpinner') e.angle += 0.16
        break
      }
      case 'spinner': {
        e.vx += Math.cos(ang) * 0.012 * UNIT
        e.vy += Math.sin(ang) * 0.012 * UNIT
        const max = 0.5 * UNIT * e.aggression
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        e.vx *= 0.985
        e.vy *= 0.985
        e.angle += 0.12
        break
      }
      case 'weaver': {
        let dodge = ang
        const dodgeR = 12 * UNIT
        const dodgeR2 = dodgeR * dodgeR
        for (let bi = 0; bi < this.bullets.length; bi++) {
          const b = this.bullets[bi]
          const dx = b.x - e.x
          const dy = b.y - e.y
          if (dx * dx + dy * dy < dodgeR2) {
            dodge = Math.atan2(-dy, -dx)
            break
          }
        }
        e.vx += Math.cos(dodge) * 0.01 * UNIT
        e.vy += Math.sin(dodge) * 0.01 * UNIT
        const max = 0.45 * UNIT * e.aggression
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        e.vx *= 0.99
        e.vy *= 0.99
        break
      }
      case 'mayfly': {
        const jx = hx + (Math.random() - 0.5) * 22 * UNIT
        const jy = hy + (Math.random() - 0.5) * 22 * UNIT
        const a = Math.atan2(jy - e.y, jx - e.x)
        e.vx += Math.cos(a) * 0.015 * UNIT
        e.vy += Math.sin(a) * 0.015 * UNIT
        const max = 0.7 * UNIT
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        break
      }
      case 'snake':
        this.stepSnake(e)
        break
      case 'blackHole': {
        if (e.strength < 2) {
          e.vx += Math.cos(ang) * 0.002 * UNIT
          e.vy += Math.sin(ang) * 0.002 * UNIT
        }
        e.vx *= 0.96
        e.vy *= 0.96
        const pull = 20 * UNIT
        this.eachNear(e.x, e.y, pull, (o) => {
          if (o === e || o.kind === 'blackHole') return false
          let dx = o.x - e.x
          let dy = o.y - e.y
          let d2 = dx * dx + dy * dy
          if (o.kind === 'snake') {
            for (let s = 0; s < o.body.length; s++) {
              const sx = o.body[s].x - e.x
              const sy = o.body[s].y - e.y
              const sd = sx * sx + sy * sy
              if (sd < d2) {
                d2 = sd
                dx = sx
                dy = sy
              }
            }
          }
          if (d2 <= 0.01 || d2 >= pull * pull) return false
          const d = Math.sqrt(d2)
          o.vx += ((e.x - o.x) / d) * 0.02 * UNIT
          o.vy += ((e.y - o.y) / d) * 0.02 * UNIT
          if (d < eRadius(e) + UNIT) {
            e.strength += 0.15
            this.destroyEnemy(o, false)
            if (e.strength > 2.3) {
              for (let k = 0; k < 12; k++) {
                const a = (k / 12) * Math.PI * 2
                this.spawnEnemy(
                  'proton',
                  e.x + Math.cos(a) * 4.5 * UNIT,
                  e.y + Math.sin(a) * 4.5 * UNIT,
                )
              }
              this.destroyEnemy(e, true)
              return true
            }
          }
          return false
        })
        break
      }
      case 'repulsor': {
        e.vx += Math.cos(ang) * 0.008 * UNIT
        e.vy += Math.sin(ang) * 0.008 * UNIT
        const max = 0.28 * UNIT * e.aggression
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        const pushR = 9 * UNIT
        const pushR2 = pushR * pushR
        for (let bi = 0; bi < this.bullets.length; bi++) {
          const b = this.bullets[bi]
          const dx = b.x - e.x
          const dy = b.y - e.y
          if (dx * dx + dy * dy < pushR2) {
            b.vx += dx * 0.03
            b.vy += dy * 0.03
          }
        }
        e.vx *= 0.99
        e.vy *= 0.99
        break
      }
      case 'cruiser': {
        let diff = ang - e.angle
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        e.angle += clamp(diff, -0.006, 0.006)
        e.vx += Math.cos(e.angle) * 0.003 * UNIT
        e.vy += Math.sin(e.angle) * 0.003 * UNIT
        const max = 0.12 * UNIT
        const sp = Math.hypot(e.vx, e.vy) || 1
        if (sp > max) {
          e.vx = (e.vx / sp) * max
          e.vy = (e.vy / sp) * max
        }
        e.vx *= 0.98
        e.vy *= 0.98
        const gun = this.stepBurst(
          e.fireCd,
          e.fireLeft,
          CRUISER_FIRE_COUNT,
          CRUISER_FIRE_GAP,
          CRUISER_FIRE_PAUSE,
          () => this.fireCruiser(e),
        )
        e.fireCd = gun.cd
        e.fireLeft = gun.left
        this.updateCruiserWings(e)
        break
      }
    }
  }

  private updateBombs() {
    for (let i = this.bombRings.length - 1; i >= 0; i--) {
      const r = this.bombRings[i]
      r.radius += r.speed
      r.thickness += 0.04 * UNIT
      r.phase += 0.04
      r.ttl--
      r.alpha -= 0.012
      const band = 3.5 * UNIT
      for (let k = this.live.length - 1; k >= 0; k--) {
        const e = this.live[k]
        if (e.state !== 'running') continue
        const outer = r.radius
        const inner = r.radius - band
        if (this.inRing(e, r.x, r.y, inner, outer)) this.destroyEnemy(e, true)
      }
      for (let j = this.enemyBullets.length - 1; j >= 0; j--) {
        const b = this.enemyBullets[j]
        const d = Math.hypot(b.x - r.x, b.y - r.y)
        if (d > r.radius - 3.5 * UNIT && d < r.radius) {
          this.enemyBullets.splice(j, 1)
        }
      }
      if (r.ttl <= 0 || r.radius > Math.max(MAP_W, MAP_H))
        this.bombRings.splice(i, 1)
    }
  }

  private drawSpinnerMotion(
    ctx: CanvasRenderingContext2D,
    part: { x: number[]; y: number[] },
    size: number,
    alpha: number,
    spin: number,
  ) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (let i = 3; i >= 1; i--) {
      ctx.save()
      ctx.rotate(-i * 0.16)
      ctx.globalAlpha = alpha * (0.3 / i)
      ctx.strokeStyle = 'rgba(255,150,70,0.9)'
      ctx.lineWidth = 1.25
      ctx.beginPath()
      path(ctx, part.x, part.y, size)
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = alpha
    ctx.strokeStyle = 'rgba(255,236,210,0.95)'
    ctx.lineWidth = 1.7
    ctx.setLineDash([3.5, 6.5])
    ctx.lineDashOffset = -spin * 22
    ctx.beginPath()
    path(ctx, part.x, part.y, size)
    ctx.stroke()
    ctx.restore()
  }

  private drawBombRings() {
    const ctx = this.ctx
    ctx.save()
    ctx.lineCap = 'round'
    for (const r of this.bombRings) {
      const a = Math.max(0, r.alpha)
      if (a <= 0) continue

      // Soft outer bloom
      setContextAttribute(ctx, -1, 0, `rgba(72,255,206,${a * 0.18})`)
      setContextAttribute(ctx, -1, 2, Math.max(6, r.thickness * 0.9))
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.stroke()

      // Trailing echo rings
      for (const [scale, alphaMul, w] of [
        [0.86, 0.35, 2.2],
        [0.72, 0.18, 1.4],
      ] as const) {
        const er = r.radius * scale
        if (er < UNIT) continue
        setContextAttribute(ctx, -1, 0, `rgba(120,220,255,${a * alphaMul})`)
        setContextAttribute(ctx, -1, 2, w)
        ctx.beginPath()
        ctx.arc(r.x, r.y, er, 0, Math.PI * 2)
        ctx.stroke()
      }

      // OpenGW-style radial fringe (short spokes on the wavefront)
      const spokes = 48
      const inner = Math.max(0, r.radius - r.thickness * 0.35)
      const outer = r.radius + r.thickness * 0.55
      setContextAttribute(ctx, -1, 0, `rgba(180,255,230,${a * 0.55})`)
      setContextAttribute(ctx, -1, 2, 1.35)
      ctx.beginPath()
      for (let i = 0; i < spokes; i++) {
        const ang = r.phase + (i / spokes) * Math.PI * 2
        const c = Math.cos(ang)
        const s = Math.sin(ang)
        ctx.moveTo(r.x + c * inner, r.y + s * inner)
        ctx.lineTo(r.x + c * outer, r.y + s * outer)
      }
      ctx.stroke()

      // Bright core ring
      setContextAttribute(ctx, -1, 0, `rgba(72,255,206,${a * 0.95})`)
      setContextAttribute(ctx, -1, 2, 2.4)
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.stroke()
      setContextAttribute(ctx, -1, 0, `rgba(255,255,255,${a * 0.75})`)
      setContextAttribute(ctx, -1, 2, 1)
      ctx.beginPath()
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2)
      ctx.stroke()

      // Leading sparkle ticks
      setContextAttribute(ctx, -1, 0, `rgba(255,245,180,${a * 0.7})`)
      setContextAttribute(ctx, -1, 2, 1.6)
      ctx.beginPath()
      for (let i = 0; i < 12; i++) {
        const ang = -r.phase * 1.3 + (i / 12) * Math.PI * 2
        const c = Math.cos(ang)
        const s = Math.sin(ang)
        const mid = r.radius + r.thickness * 0.15
        ctx.moveTo(r.x + c * (mid - 3), r.y + s * (mid - 3))
        ctx.lineTo(r.x + c * (mid + 5), r.y + s * (mid + 5))
      }
      ctx.stroke()
    }
    setContextAttribute(ctx, -1, 2, 1)
    ctx.restore()
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.ttl--
      if (p.ttl <= 0) this.particles.splice(i, 1)
    }
  }

  private spawnGridRipple(x: number, y: number) {
    // Same-area coalesce: one active ripple per neighborhood.
    const nearR = TILESET * 4
    const nearR2 = nearR * nearR
    for (const r of this.gridRipples) {
      const dx = r.x - x
      const dy = r.y - y
      if (dx * dx + dy * dy < nearR2) {
        r.x = (r.x + x) * 0.5
        r.y = (r.y + y) * 0.5
        r.age = 0
        return
      }
    }
    if (this.gridRipples.length >= 5) this.gridRipples.shift()
    this.gridRipples.push({
      x,
      y,
      age: 0,
      life: 44,
      strength: TILESET * 0.85,
      speed: TILESET * 0.26,
    })
  }

  private updateGridRipples() {
    for (let i = this.gridRipples.length - 1; i >= 0; i--) {
      this.gridRipples[i].age++
      if (this.gridRipples[i].age >= this.gridRipples[i].life) {
        this.gridRipples.splice(i, 1)
      }
    }
  }

  /** Geometry Wars–style radial sine warp for grid vertices. */
  private distortGridPoint(x: number, y: number): [number, number] {
    let dx = 0
    let dy = 0
    const wavelength = TILESET * 1.2
    const maxReach = TILESET * 7.5
    const maxReach2 = maxReach * maxReach
    for (const r of this.gridRipples) {
      const ox = x - r.x
      const oy = y - r.y
      const dist2 = ox * ox + oy * oy
      if (dist2 > maxReach2 || dist2 < 1e-6) continue
      const dist = Math.sqrt(dist2)
      const front = Math.min(r.age * r.speed, maxReach)
      const phase = (dist - front) / wavelength
      if (phase < -1.4 || phase > 0.3) continue
      const fade = 1 - r.age / r.life
      const reach = 1 - dist / maxReach
      const envelope = Math.exp(-phase * phase * 1.4) * reach
      const wave = Math.sin(phase * Math.PI * 2)
      const force = r.strength * wave * envelope * fade
      const inv = force / dist
      dx += ox * inv
      dy += oy * inv
    }
    return [x + dx, y + dy]
  }

  private drawMapGrid() {
    const ctx = this.ctx
    const cols = MAP_W / TILESET
    const rows = MAP_H / TILESET
    const gridA = 'rgba(50,90,170,0.38)'
    const gridB = 'rgba(30,70,140,0.24)'

    if (this.gridRipples.length === 0) {
      setContextAttribute(ctx, -1, 0, gridA)
      ctx.beginPath()
      for (let i = 0; i <= cols; i++) {
        drawLine(ctx, i * TILESET - 0.5, 0, MAP_H, true)
      }
      for (let i = 0; i <= rows; i++) {
        drawLine(ctx, 0, i * TILESET - 0.5, MAP_W)
      }
      ctx.stroke()
      setContextAttribute(ctx, -1, 0, gridB)
      ctx.beginPath()
      for (let i = 0; i <= cols; i++) {
        drawLine(ctx, i * TILESET + 0.5, 0, MAP_H, true)
      }
      for (let i = 0; i <= rows; i++) {
        drawLine(ctx, 0, i * TILESET + 0.5, MAP_W)
      }
      ctx.stroke()
    } else {
      // Coarser samples when warping — still smooth, ~half the math.
      const step = UNIT * 2
      const strokeWarped = (ox: number, oy: number, color: string) => {
        setContextAttribute(ctx, -1, 0, color)
        setContextAttribute(ctx, -1, 2, 1)
        ctx.beginPath()
        for (let i = 0; i <= cols; i++) {
          const gx = i * TILESET + ox
          for (let y = 0; y <= MAP_H; y += step) {
            const [px, py] = this.distortGridPoint(gx, y)
            if (y === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
        }
        for (let j = 0; j <= rows; j++) {
          const gy = j * TILESET + oy
          for (let x = 0; x <= MAP_W; x += step) {
            const [px, py] = this.distortGridPoint(x, gy)
            if (x === 0) ctx.moveTo(px, py)
            else ctx.lineTo(px, py)
          }
        }
        ctx.stroke()
      }

      strokeWarped(-0.5, -0.5, gridA)
      strokeWarped(0.5, 0.5, gridB)
      this.drawGridFlash()
    }
    this.drawBombGridFlash()
  }

  /** Local grid lines flare bright at a blast, then fall off from the center. */
  private drawGridFlash() {
    const ctx = this.ctx
    const reach = TILESET * 5.5
    const step = UNIT * 2
    ctx.save()
    ctx.lineCap = 'round'
    for (const r of this.gridRipples) {
      const t = r.age / 18
      if (t >= 1) continue
      const flash = Math.sin((1 - t) * Math.PI * 0.5)
      const minC = Math.max(0, Math.floor((r.x - reach) / TILESET))
      const maxC = Math.min(MAP_W / TILESET, Math.ceil((r.x + reach) / TILESET))
      const minR = Math.max(0, Math.floor((r.y - reach) / TILESET))
      const maxR = Math.min(MAP_H / TILESET, Math.ceil((r.y + reach) / TILESET))
      const strokeSpan = (
        x0: number,
        y0: number,
        x1: number,
        y1: number,
        alpha: number,
      ) => {
        const [ax, ay] = this.distortGridPoint(x0, y0)
        const [bx, by] = this.distortGridPoint(x1, y1)
        ctx.globalAlpha = alpha * 0.28
        ctx.strokeStyle = 'rgba(70,120,190,1)'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
        ctx.globalAlpha = alpha * 0.55
        ctx.strokeStyle = 'rgba(160,200,245,1)'
        ctx.lineWidth = 1.15
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }
      for (let i = minC; i <= maxC; i++) {
        const gx = i * TILESET
        const dx = Math.abs(gx - r.x)
        if (dx >= reach) continue
        const half = Math.sqrt(reach * reach - dx * dx)
        const yStart = Math.max(0, r.y - half)
        const yEnd = Math.min(MAP_H, r.y + half)
        for (let y = yStart; y < yEnd; y += step) {
          const y2 = Math.min(yEnd, y + step)
          const dist = Math.hypot(gx - r.x, (y + y2) / 2 - r.y)
          const u = 1 - dist / reach
          if (u <= 0) continue
          strokeSpan(gx, y, gx, y2, flash * u * u)
        }
      }
      for (let j = minR; j <= maxR; j++) {
        const gy = j * TILESET
        const dy = Math.abs(gy - r.y)
        if (dy >= reach) continue
        const half = Math.sqrt(reach * reach - dy * dy)
        const xStart = Math.max(0, r.x - half)
        const xEnd = Math.min(MAP_W, r.x + half)
        for (let x = xStart; x < xEnd; x += step) {
          const x2 = Math.min(xEnd, x + step)
          const dist = Math.hypot((x + x2) / 2 - r.x, gy - r.y)
          const u = 1 - dist / reach
          if (u <= 0) continue
          strokeSpan(x, gy, x2, gy, flash * u * u)
        }
      }
    }
    ctx.restore()
  }

  /** Grid lines under the bomb wavefront flare, then the bright band moves outward. */
  private drawBombGridFlash() {
    if (this.bombRings.length === 0) return
    const ctx = this.ctx
    const band = TILESET * 1.8
    const step = UNIT * 2
    ctx.save()
    ctx.lineCap = 'round'
    for (const r of this.bombRings) {
      const glow = Math.max(0, r.alpha)
      if (glow < 0.04) continue
      const outer = r.radius + band
      const inner = Math.max(0, r.radius - band * 0.55)
      const minC = Math.max(0, Math.floor((r.x - outer) / TILESET))
      const maxC = Math.min(MAP_W / TILESET, Math.ceil((r.x + outer) / TILESET))
      const minRow = Math.max(0, Math.floor((r.y - outer) / TILESET))
      const maxRow = Math.min(
        MAP_H / TILESET,
        Math.ceil((r.y + outer) / TILESET),
      )
      const strokeSpan = (x0: number, y0: number, x1: number, y1: number) => {
        const dist = Math.hypot((x0 + x1) / 2 - r.x, (y0 + y1) / 2 - r.y)
        const u = 1 - Math.abs(dist - r.radius) / band
        if (u <= 0) return
        const alpha = glow * u
        const [ax, ay] = this.distortGridPoint(x0, y0)
        const [bx, by] = this.distortGridPoint(x1, y1)
        ctx.globalAlpha = alpha * 0.28
        ctx.strokeStyle = 'rgba(70,120,190,1)'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
        ctx.globalAlpha = alpha * 0.55
        ctx.strokeStyle = 'rgba(160,200,245,1)'
        ctx.lineWidth = 1.15
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }
      const sample = (x0: number, y0: number, x1: number, y1: number) => {
        const vertical = x0 === x1
        const span = vertical ? y1 - y0 : x1 - x0
        const n = Math.max(1, Math.ceil(span / step))
        for (let i = 0; i < n; i++) {
          const t0 = i / n
          const t1 = (i + 1) / n
          const xa = vertical ? x0 : x0 + (x1 - x0) * t0
          const xb = vertical ? x0 : x0 + (x1 - x0) * t1
          const ya = vertical ? y0 + (y1 - y0) * t0 : y0
          const yb = vertical ? y0 + (y1 - y0) * t1 : y0
          strokeSpan(xa, ya, xb, yb)
        }
      }
      const bandsAt = (delta: number): [number, number][] => {
        const ad = Math.abs(delta)
        if (ad >= outer) return []
        const outerHalf = Math.sqrt(outer * outer - delta * delta)
        const inner2 = inner * inner - delta * delta
        if (inner2 <= 0) return [[-outerHalf, outerHalf]]
        const innerHalf = Math.sqrt(inner2)
        return [
          [-outerHalf, -innerHalf],
          [innerHalf, outerHalf],
        ]
      }
      for (let i = minC; i <= maxC; i++) {
        const gx = i * TILESET
        for (const [a, b] of bandsAt(gx - r.x)) {
          const y0 = Math.max(0, r.y + a)
          const y1 = Math.min(MAP_H, r.y + b)
          if (y1 - y0 < 2) continue
          sample(gx, y0, gx, y1)
        }
      }
      for (let j = minRow; j <= maxRow; j++) {
        const gy = j * TILESET
        for (const [a, b] of bandsAt(gy - r.y)) {
          const x0 = Math.max(0, r.x + a)
          const x1 = Math.min(MAP_W, r.x + b)
          if (x1 - x0 < 2) continue
          sample(x0, gy, x1, gy)
        }
      }
    }
    ctx.restore()
  }

  private updateFloatMsgs() {
    for (let i = this.floatMsgs.length - 1; i >= 0; i--) {
      this.floatMsgs[i].ttl--
      this.floatMsgs[i].y -= 0.4
      if (this.floatMsgs[i].ttl <= 0) this.floatMsgs.splice(i, 1)
    }
  }

  private burst(x: number, y: number, color: number, n: number, scale = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = (0.4 + Math.random() * 2.2) * (scale > 1 ? 1.4 : 1)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        ttl: 20 + Math.random() * 20,
        color,
        scale,
      })
    }
  }

  private emitThrustParticles(boosting: boolean) {
    const rear = this.heroAngle + Math.PI
    const side = this.heroAngle + Math.PI / 2
    const back = HERO_RADIUS * (1.15 - HERO_ART_FORWARD + Math.random() * 0.15)
    for (const sign of [-1, 1] as const) {
      // Idle: sparse sparks; boosting: denser/faster plume
      if (Math.random() > (boosting ? 0.65 : 0.22)) continue
      const a = rear + (Math.random() - 0.5) * (boosting ? 0.45 : 0.18)
      const sp =
        (boosting ? 1.8 : 0.55) + Math.random() * (boosting ? 3.2 : 0.8)
      const lat = sign * HERO_RADIUS * 0.88
      this.particles.push({
        x:
          this.heroX +
          Math.cos(rear) * back +
          Math.cos(side) * lat +
          (Math.random() - 0.5) * 2,
        y:
          this.heroY +
          Math.sin(rear) * back +
          Math.sin(side) * lat +
          (Math.random() - 0.5) * 2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        ttl: (boosting ? 7 : 10) + Math.random() * (boosting ? 9 : 8),
        color: Math.random() > 0.55 ? 6 : Math.random() > 0.5 ? 15 : 31,
      })
    }
  }

  private drawSplash() {
    const ctx = this.ctx
    const cx = this.screenW / 2
    const cy = this.screenH / 2
    ctx.save()
    setContextAttribute(ctx, 23, 1)
    ctx.fillRect(0, 0, this.screenW, this.screenH)
    this.drawFieldStars()
    this.drawGlitchTitle(
      t('title'),
      cx,
      cy - 80 - this.fade * 50,
      30 * (1 + this.fade),
    )
    displayWord(ctx, t('start'), cx, cy + 80, 12, [0, 13])
    ctx.restore()
  }

  private drawGlitchTitle(word: string, x: number, y: number, size: number) {
    const ctx = this.ctx
    const f = this.frame
    displaySegmentWord(ctx, word, x, y, size, [0, 9, 0, 9])

    const burst = f % 200 < 2
    if (!burst) return

    const ox = (Math.random() - 0.5) * size * 0.9
    const oy = (Math.random() - 0.5) * size * 0.2
    displaySegmentWord(ctx, word, x + ox, y + oy, size, [10, 2])
    displaySegmentWord(ctx, word, x - ox * 0.65, y - oy * 0.5, size, [15, 11])

    const tears = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < tears; i++) {
      const sy = y - size * 0.6 + Math.random() * size * 2.2
      const sh = 2 + Math.random() * Math.max(3, size * 0.18)
      const sx = x + (Math.random() - 0.5) * size * 1.4
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, sy, this.screenW, sh)
      ctx.clip()
      displaySegmentWord(
        ctx,
        word,
        sx,
        y,
        size,
        Math.random() > 0.5 ? [10, 0] : [15, 0],
      )
      ctx.restore()
    }
  }

  private drawFieldStars() {
    const ctx = this.ctx
    for (const star of this.fieldStars) {
      const twinkle =
        0.25 +
        0.75 * (0.5 + 0.5 * Math.sin(this.frame * star.speed + star.phase))
      ctx.fillStyle = `rgba(200,220,255,${Math.min(0.95, twinkle)})`
      const s = star.size * (0.65 + twinkle * 0.55)
      ctx.fillRect(star.x, star.y, s, s)
    }
    this.drawBgLasers()
  }

  private spawnBgLaser() {
    const w = this.screenW
    const h = this.screenH
    // Bias toward far; occasional nearer shots.
    const depth = Math.pow(Math.random(), 1.6)
    const x0 = w * (0.05 + Math.random() * 0.9)
    const y0 = h * (0.05 + Math.random() * 0.9)
    const angle = Math.random() * Math.PI * 2
    const lenScale = 0.06 + depth * 0.22 + Math.random() * (0.04 + depth * 0.12)
    const len = Math.min(w, h) * lenScale
    const farPalette = [
      '80,150,200',
      '180,90,130',
      '70,170,150',
      '130,120,190',
      '170,150,100',
    ]
    const nearPalette = [
      '100,210,255',
      '255,100,160',
      '90,255,200',
      '180,150,255',
      '255,220,120',
    ]
    const palette = depth > 0.55 ? nearPalette : farPalette
    this.bgLasers.push({
      x0,
      y0,
      x1: x0 + Math.cos(angle) * len,
      y1: y0 + Math.sin(angle) * len,
      age: 0,
      life: 8 + Math.floor(Math.random() * 10) + Math.floor(depth * 8),
      rgb: palette[Math.floor(Math.random() * palette.length)],
      width: 0.3 + depth * 1.1 + Math.random() * 0.35,
      depth,
    })
  }

  private updateBgLasers() {
    if (this.bgLasers.length < 6 && Math.random() < 0.014) {
      this.spawnBgLaser()
      if (Math.random() < 0.4) this.spawnBgLaser()
    }
    for (let i = this.bgLasers.length - 1; i >= 0; i--) {
      this.bgLasers[i].age++
      if (this.bgLasers[i].age >= this.bgLasers[i].life) {
        this.bgLasers.splice(i, 1)
      }
    }
  }

  private drawBgLasers() {
    if (!this.bgLasers.length) return
    const ctx = this.ctx
    ctx.save()
    ctx.lineCap = 'round'
    for (const beam of this.bgLasers) {
      const t = beam.age / beam.life
      const alpha = t < 0.2 ? t / 0.2 : t > 0.5 ? Math.max(0, (1 - t) / 0.5) : 1
      const a = alpha * (0.14 + beam.depth * 0.38)
      ctx.globalAlpha = a * 0.4
      ctx.strokeStyle = `rgb(${beam.rgb})`
      ctx.lineWidth = beam.width * (2.2 + beam.depth * 1.4)
      ctx.beginPath()
      ctx.moveTo(beam.x0, beam.y0)
      ctx.lineTo(beam.x1, beam.y1)
      ctx.stroke()
      ctx.globalAlpha = a
      ctx.lineWidth = beam.width
      ctx.beginPath()
      ctx.moveTo(beam.x0, beam.y0)
      ctx.lineTo(beam.x1, beam.y1)
      ctx.stroke()
      if (beam.depth > 0.6) {
        ctx.globalAlpha = a * 0.55
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.lineWidth = Math.max(0.3, beam.width * 0.28)
        ctx.beginPath()
        ctx.moveTo(beam.x0, beam.y0)
        ctx.lineTo(beam.x1, beam.y1)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private strokeHull(
    ctx: CanvasRenderingContext2D,
    pts: [number, number][],
    scale: number,
    close = true,
  ) {
    ctx.beginPath()
    ctx.moveTo(pts[0][0] * scale, pts[0][1] * scale)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale)
    }
    if (close) ctx.closePath()
    ctx.stroke()
  }

  /** Steady ring; arcs orbit so the field reads as energy without flashing the hull. */
  private drawShield() {
    if (this.shield <= 0) return
    const ctx = this.ctx
    const r = HERO_RADIUS * 2.45
    const spin = this.frame * 0.045
    ctx.save()
    ctx.translate(this.heroX, this.heroY)
    ctx.lineCap = 'round'

    const ring = (radius: number, color: string, width: number) => {
      setContextAttribute(ctx, -1, 0, color)
      setContextAttribute(ctx, -1, 2, width)
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    const arc = (
      radius: number,
      a0: number,
      sweep: number,
      color: string,
      width: number,
    ) => {
      setContextAttribute(ctx, -1, 0, color)
      setContextAttribute(ctx, -1, 2, width)
      ctx.beginPath()
      ctx.arc(0, 0, radius, a0, a0 + sweep)
      ctx.stroke()
    }

    ring(r, 'rgba(110,220,255,0.16)', 1)
    ring(r, 'rgba(72,255,206,0.05)', 6)

    const bands = 3
    const sweep = Math.PI * 0.28
    for (let i = 0; i < bands; i++) {
      const a0 = spin + (i / bands) * Math.PI * 2
      arc(r, a0, sweep, 'rgba(170,255,240,0.42)', 1.25)
      arc(
        r * 0.9,
        -spin * 1.35 + (i / bands) * Math.PI * 2,
        sweep * 0.55,
        'rgba(130,200,255,0.28)',
        0.85,
      )
    }

    ctx.restore()
  }

  private drawHero() {
    const ctx = this.ctx
    const s = HERO_RADIUS
    const thrusting = this.keys.a || this.keys.w || this.keys.s || this.keys.d
    // Per-part palette: hull cyan · pods mint · fins violet · accents warm
    const hullCol = 'rgb(100,215,255)'
    const podCol = 'rgb(90,255,200)'
    const finCol = 'rgb(180,165,255)'
    const accentCol = 'rgb(255,230,170)'
    const strutCol = 'rgba(140,190,220,0.75)'
    const spineCol = 'rgba(160,230,255,0.8)'

    ctx.save()
    ctx.translate(this.heroX, this.heroY)
    ctx.rotate(this.heroAngle + Math.PI / 2)
    ctx.translate(0, -HERO_ART_FORWARD * s)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    const strokePart = (
      pts: [number, number][],
      width: number,
      color: string,
      alpha = 1,
    ) => {
      ctx.globalAlpha = alpha
      setContextAttribute(ctx, -1, 2, width)
      setContextAttribute(ctx, -1, 0, color)
      this.strokeHull(ctx, pts, s)
      ctx.globalAlpha = 1
    }

    {
      // Idle: short pilot flame; boosting: long plume.
      const flare = 0.35 + 0.45 * Math.abs(Math.sin(this.frame * 0.9))
      const len = thrusting
        ? (0.85 + flare * 0.65) * s
        : (0.28 + flare * 0.14) * s
      const drawJet = (x: number, y0: number) => {
        ctx.globalAlpha = thrusting ? 0.2 : 0.22
        setContextAttribute(ctx, -1, 0, 'rgba(80,255,190,1)')
        setContextAttribute(ctx, -1, 2, thrusting ? 5 : 3.2)
        ctx.beginPath()
        ctx.moveTo(x - (thrusting ? 0.12 : 0.08) * s, y0)
        ctx.lineTo(x, y0 + len)
        ctx.lineTo(x + (thrusting ? 0.12 : 0.08) * s, y0)
        ctx.stroke()
        ctx.globalAlpha = thrusting ? 0.7 : 0.7
        setContextAttribute(ctx, -1, 0, 'rgba(255,245,200,1)')
        setContextAttribute(ctx, -1, 2, thrusting ? 1.55 : 1.3)
        ctx.beginPath()
        ctx.moveTo(x - (thrusting ? 0.06 : 0.04) * s, y0)
        ctx.lineTo(x, y0 + len * 0.9)
        ctx.lineTo(x + (thrusting ? 0.06 : 0.04) * s, y0)
        ctx.stroke()
      }
      drawJet(0.88 * s, 1.22 * s)
      drawJet(-0.88 * s, 1.22 * s)
      ctx.globalAlpha = 1
    }

    // Soft bloom per part color
    strokePart(this.heroHull, 3.6, hullCol, 0.22)
    strokePart(this.heroPylonR, 3.0, strutCol, 0.18)
    strokePart(this.heroPylonL, 3.0, strutCol, 0.18)
    strokePart(this.heroPodR, 3.2, podCol, 0.2)
    strokePart(this.heroPodL, 3.2, podCol, 0.2)
    strokePart(this.heroFinR, 2.8, finCol, 0.18)
    strokePart(this.heroFinL, 2.8, finCol, 0.18)

    // Body outlines
    strokePart(this.heroHull, 1.75, hullCol)
    strokePart(this.heroPylonR, 1.45, strutCol)
    strokePart(this.heroPylonL, 1.45, strutCol)
    strokePart(this.heroPodR, 1.55, podCol)
    strokePart(this.heroPodL, 1.55, podCol)
    strokePart(this.heroFinR, 1.4, finCol)
    strokePart(this.heroFinL, 1.4, finCol)

    // Fuselage stern bar
    setContextAttribute(ctx, -1, 2, 1.3)
    setContextAttribute(ctx, -1, 0, accentCol)
    ctx.beginPath()
    ctx.moveTo(-0.26 * s, 0.78 * s)
    ctx.lineTo(0.26 * s, 0.78 * s)
    ctx.stroke()

    // Winglet leading edges
    setContextAttribute(ctx, -1, 2, 1.15)
    setContextAttribute(ctx, -1, 0, accentCol)
    ctx.beginPath()
    ctx.moveTo(1.02 * s, 0.16 * s)
    ctx.lineTo(1.5 * s, 0.44 * s)
    ctx.moveTo(-1.02 * s, 0.16 * s)
    ctx.lineTo(-1.5 * s, 0.44 * s)
    ctx.stroke()

    // Pod nozzle bells + intake lips
    setContextAttribute(ctx, -1, 2, 1.25)
    setContextAttribute(ctx, -1, 0, accentCol)
    for (const x of [0.88, -0.88]) {
      ctx.beginPath()
      ctx.ellipse(x * s, 1.18 * s, 0.13 * s, 0.09 * s, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x * s - 0.1 * s, 0.05 * s)
      ctx.lineTo(x * s + 0.1 * s, 0.05 * s)
      ctx.stroke()
    }

    // Pod seam lines
    setContextAttribute(ctx, -1, 2, 0.95)
    setContextAttribute(ctx, -1, 0, spineCol)
    ctx.beginPath()
    ctx.moveTo(0.78 * s, 0.12 * s)
    ctx.lineTo(0.86 * s, 0.95 * s)
    ctx.moveTo(-0.78 * s, 0.12 * s)
    ctx.lineTo(-0.86 * s, 0.95 * s)
    ctx.stroke()

    // Pylon cross-braces
    setContextAttribute(ctx, -1, 2, 1)
    setContextAttribute(ctx, -1, 0, accentCol)
    ctx.beginPath()
    ctx.moveTo(0.32 * s, 0.12 * s)
    ctx.lineTo(0.56 * s, 0.36 * s)
    ctx.moveTo(0.32 * s, 0.3 * s)
    ctx.lineTo(0.56 * s, 0.18 * s)
    ctx.moveTo(-0.32 * s, 0.12 * s)
    ctx.lineTo(-0.56 * s, 0.36 * s)
    ctx.moveTo(-0.32 * s, 0.3 * s)
    ctx.lineTo(-0.56 * s, 0.18 * s)
    ctx.stroke()

    ctx.restore()
  }

  /** Quiet readout on the same row as the side numbers. */
  private drawLevel(cx: number) {
    const n = this.spawner.getLevel()
    const ctx = this.ctx
    const size = 9
    const y = 60 + size * 1.05
    ctx.save()
    ctx.font = `300 18px ${getFontFamily()}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.letterSpacing = '0.06em'
    ctx.fillStyle = 'rgba(255, 186, 96, 0.55)'
    ctx.fillText(`${t('level')} ${n}`, cx, y)
    ctx.restore()
  }

  private drawPointer() {
    if (this.pad.hideCursor) return
    const ctx = this.ctx
    const x = this.pointer[0]
    const y = this.pointer[1]
    ctx.save()
    ctx.beginPath()
    setContextAttribute(ctx, this.pointer[2] ? 2 : 1)
    drawLine(ctx, x - 10, y, 20)
    drawLine(ctx, x, y - 10, 20, true)
    ctx.stroke()
    ctx.beginPath()
    setContextAttribute(ctx, 0)
    drawLine(ctx, x - 8, y, 16)
    drawLine(ctx, x, y - 8, 16, true)
    ctx.stroke()
    ctx.restore()
  }

  private drawBolts(bolts: Bolt[], glow: string, core: string) {
    const ctx = this.ctx
    for (const b of bolts) {
      const sp = Math.hypot(b.vx, b.vy) || 1
      const ux = b.vx / sp
      const uy = b.vy / sp
      const half = 7
      const x0 = b.x - ux * half
      const y0 = b.y - uy * half
      const x1 = b.x + ux * half
      const y1 = b.y + uy * half
      ctx.globalAlpha = 0.35
      setContextAttribute(ctx, -1, 0, glow)
      setContextAttribute(ctx, -1, 2, 4)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      ctx.globalAlpha = 1
      setContextAttribute(ctx, -1, 0, core)
      setContextAttribute(ctx, -1, 2, 1.8)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
  }

  private drawCruiserGlitch(
    parts: { x: number[]; y: number[] }[],
    size: number,
    arrive: number,
  ) {
    const ctx = this.ctx
    const kick = (1 - arrive) * size * 0.28
    const ox = (Math.random() - 0.5) * kick * 2
    const oy = (Math.random() - 0.5) * kick * 0.35
    const ghost = 0.28 + 0.35 * (1 - arrive)
    const strokeShift = (
      dx: number,
      dy: number,
      color: string,
      alpha: number,
    ) => {
      ctx.save()
      ctx.translate(dx, dy)
      ctx.globalAlpha = alpha
      setContextAttribute(ctx, -1, 0, color)
      setContextAttribute(ctx, -1, 2, 1.6)
      for (const part of parts) {
        ctx.beginPath()
        path(ctx, part.x, part.y, size)
        ctx.closePath()
        ctx.stroke()
      }
      ctx.restore()
    }
    strokeShift(ox, oy, 'rgba(80,220,255,0.95)', ghost)
    strokeShift(-ox * 0.65, -oy * 0.4, 'rgba(255,60,130,0.95)', ghost)

    const tears = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < tears; i++) {
      const sy = (Math.random() - 0.5) * size * 1.7
      const sh = 2 + Math.random() * size * 0.1
      const sx = (Math.random() - 0.5) * kick * 1.4
      ctx.save()
      ctx.beginPath()
      ctx.rect(-size * 2, sy, size * 4, sh)
      ctx.clip()
      strokeShift(
        sx,
        0,
        Math.random() > 0.5 ? 'rgba(80,220,255,1)' : 'rgba(255,70,140,1)',
        0.75,
      )
      ctx.restore()
    }
  }

  private onScreen(
    e: Enemy,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) {
    const inside = (x: number, y: number) =>
      x >= left && x <= right && y >= top && y <= bottom
    if (inside(e.x, e.y)) return true
    if (e.kind !== 'snake') return false
    for (let i = 0; i < e.body.length; i++) {
      if (inside(e.body[i].x, e.body[i].y)) return true
    }
    return false
  }

  private drawSnake(e: Enemy) {
    const ctx = this.ctx
    const def = DEFS.snake
    const size = def.radius * 0.9
    const parts = def.parts ?? [{ x: def.shapeX, y: def.shapeY }]
    const head = parts[0]
    const tail = parts[1] ?? head
    const baseAlpha = e.state === 'spawn' ? 0.35 : 1
    const glowPulse = 0.22 + 0.08 * Math.sin(e.anim * 2.1)
    const segs: {
      x: number
      y: number
      part: { x: number[]; y: number[] }
    }[] = [{ x: e.x, y: e.y, part: head }]
    for (let i = 0; i < e.body.length; i++) {
      segs.push({
        x: e.body[i].x,
        y: e.body[i].y,
        part: i === e.body.length - 1 ? tail : head,
      })
    }
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    setContextAttribute(ctx, def.color)
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i]
      const ahead =
        i === 0
          ? {
              x: e.x + Math.cos(e.heading),
              y: e.y + Math.sin(e.heading),
            }
          : segs[i - 1]
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(Math.atan2(ahead.y - s.y, ahead.x - s.x) - Math.PI / 2)
      ctx.globalAlpha = baseAlpha * glowPulse
      setContextAttribute(ctx, -1, 2, 4.2)
      ctx.beginPath()
      path(ctx, s.part.x, s.part.y, size)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = baseAlpha
      setContextAttribute(ctx, -1, 2, 1.55)
      ctx.beginPath()
      path(ctx, s.part.x, s.part.y, size)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  private draw() {
    const ctx = this.ctx
    // Semi-transparent clear leaves short neon motion trails.
    setContextAttribute(ctx, 7, 1)
    ctx.fillRect(0, 0, this.screenW, this.screenH)
    this.drawFieldStars()

    const vp = this.viewPort
    ctx.save()
    ctx.translate(vp[0], vp[1])

    setContextAttribute(
      ctx,
      -1,
      1,
      `rgba(8,14,24,${0.28 - (this.shield > 0 ? 0.06 : 0)})`,
    )
    ctx.fillRect(0, 0, MAP_W, MAP_H)

    this.drawMapGrid()

    this.drawBombRings()

    const viewLeft = -vp[0] - 80
    const viewTop = -vp[1] - 80
    const viewRight = -vp[0] + this.screenW + 80
    const viewBottom = -vp[1] + this.screenH + 80
    for (let i = 0; i < this.live.length; i++) {
      const e = this.live[i]
      if (!this.onScreen(e, viewLeft, viewTop, viewRight, viewBottom)) continue
      if (e.kind === 'snake') {
        this.drawSnake(e)
        continue
      }
      const def = DEFS[e.kind]
      ctx.save()
      ctx.translate(e.x, e.y)
      const spawning = e.kind === 'cruiser' && e.state === 'spawn'
      const arrive = spawning
        ? 1 - (e.spawnTimer / CRUISER_SPAWN_FRAMES) ** 2
        : 1
      const spin =
        e.kind === 'spinner' || e.kind === 'tinySpinner'
          ? 1
          : e.kind === 'cruiser'
            ? 0
            : 0.2
      ctx.rotate(e.angle + e.anim * spin)
      const pulse = e.kind === 'grunt' ? 1 + Math.sin(e.anim) * 0.15 : 1
      const size = def.radius * (e.kind === 'cruiser' ? 1 : 0.9) * pulse
      const parts = def.parts ?? [{ x: def.shapeX, y: def.shapeY }]
      const baseAlpha = spawning ? arrive : e.state === 'spawn' ? 0.35 : 1
      const glowPulse = 0.22 + 0.08 * Math.sin(e.anim * 2.1)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      setContextAttribute(ctx, def.color)
      if (e.kind === 'cruiser') {
        setContextAttribute(ctx, -1, 1, 'rgba(235,118,71,0.32)')
        ctx.globalAlpha = baseAlpha * 0.9
        for (const part of parts) {
          ctx.beginPath()
          path(ctx, part.x, part.y, size)
          ctx.closePath()
          ctx.fill()
        }
      }
      ctx.globalAlpha = baseAlpha * glowPulse
      setContextAttribute(ctx, -1, 2, 4.2)
      for (const part of parts) {
        ctx.beginPath()
        path(ctx, part.x, part.y, size)
        ctx.closePath()
        ctx.stroke()
      }
      ctx.globalAlpha = baseAlpha
      setContextAttribute(ctx, -1, 2, 1.55)
      for (const part of parts) {
        ctx.beginPath()
        path(ctx, part.x, part.y, size)
        ctx.closePath()
        ctx.stroke()
      }
      if (e.kind === 'blackHole') {
        ctx.globalAlpha = baseAlpha
        ctx.fillStyle = '#000'
        ctx.beginPath()
        path(ctx, parts[0].x, parts[0].y, size)
        ctx.fill()
      }
      if (e.kind === 'spinner') {
        this.drawSpinnerMotion(ctx, parts[0], size, baseAlpha, e.angle + e.anim)
      }
      if (spawning) this.drawCruiserGlitch(parts, size, arrive)
      ctx.globalAlpha = 1
      ctx.restore()
    }

    ctx.save()
    ctx.lineCap = 'round'
    this.drawBolts(this.bullets, 'rgba(255,210,60,1)', 'rgba(255,240,140,1)')
    this.drawBolts(
      this.enemyBullets,
      'rgba(255,70,50,0.95)',
      'rgba(255,176,120,1)',
    )
    ctx.globalAlpha = 1
    ctx.restore()

    ctx.save()
    for (const p of this.particles) {
      if (
        p.x < viewLeft ||
        p.x > viewRight ||
        p.y < viewTop ||
        p.y > viewBottom
      )
        continue
      const life = Math.min(1, p.ttl / 28)
      const sz = p.scale ?? 1
      setContextAttribute(ctx, p.color, 1)
      ctx.globalAlpha = 0.1 * life
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4.5 * sz, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.55 * life
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2 * sz, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = Math.min(1, 0.4 + life * 0.4)
      setContextAttribute(ctx, 0, 1)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 0.9 * sz, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.restore()

    this.drawFieldItems()
    if (this.heroAlive) {
      this.drawShield()
      this.drawHero()
    }

    ctx.restore()

    this.drawWeaponPickup()

    const cx = this.screenW / 2
    const cy = this.screenH / 2
    const hudRight = this.screenW - 50
    ctx.save()
    displaySegmentWord(ctx, this.score.toFixed(0), hudRight, 60, 18, [9, 0], 1)
    displaySegmentWord(ctx, `x${this.multiplier}`, hudRight, 110, 9, [24, 0], 1)
    displayWord(ctx, `${t('lives')} ${this.lives}`, 80, 60, 9, [0, 13])
    displayWord(ctx, `${t('bombs')} ${this.bombs}`, 80, 100, 9, [0, 9])
    this.drawLevel(cx)

    for (const m of this.floatMsgs) {
      const sx = m.x + vp[0]
      const sy = m.y + vp[1]
      if (
        sx < 20 ||
        sx > this.screenW - 20 ||
        sy < 20 ||
        sy > this.screenH - 20
      )
        continue
      displayWord(ctx, m.text, sx, sy, 9, [0, 6])
    }

    if (this.gameOver) {
      setContextAttribute(ctx, 22, 1)
      ctx.fillRect(0, 0, this.screenW, this.screenH)
      if (this.newRecord) {
        displayWord(ctx, t('newRecord'), cx, cy - 60, 22, [10, 18])
      } else {
        displayWord(ctx, t('gameOver'), cx, cy - 60, 20, [0, 13])
      }
      displaySegmentWord(ctx, this.score.toFixed(0), cx, cy - 140, 18, [0, 9])
      displayWord(ctx, t('start'), cx, cy + 100, 12, [0, 13])
    } else {
      this.drawPointer()
    }
    if (this.paused) {
      // Canvas CJK words are drawn size*1.05 below y so they line up with segment glyphs.
      const pauseSize = 18
      displayWord(
        ctx,
        t('paused'),
        cx,
        cy - pauseSize * 1.05,
        pauseSize,
        [0, 13],
      )
    }
    ctx.restore()
  }
}

const GRID_CELL = 96

/** Visible pieces, including the head. */
const SNAKE_MIN = 4
const SNAKE_MAX = 9
const SNAKE_SPEED = 0.34 * UNIT
const SNAKE_GAP = 20

function pointBehind(trail: { x: number; y: number }[], dist: number) {
  let remain = dist
  for (let i = trail.length - 1; i > 0; i--) {
    const a = trail[i]
    const b = trail[i - 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.hypot(dx, dy)
    if (d >= remain && d > 0) {
      const t = remain / d
      return { x: a.x + dx * t, y: a.y + dy * t }
    }
    remain -= d
  }
  const tail = trail[0]
  return tail ? { x: tail.x, y: tail.y } : { x: 0, y: 0 }
}

function eRadius(e: Enemy) {
  const base = DEFS[e.kind].radius
  if (e.kind === 'blackHole') return base * e.strength
  if (e.kind === 'cruiser') return base * 1.2
  return base
}
