import clamp from 'licia/clamp'
import contain from 'licia/contain'
import each from 'licia/each'
import filter from 'licia/filter'
import find from 'licia/find'
import map from 'licia/map'
import pluck from 'licia/pluck'
import random from 'licia/random'
import remove from 'licia/remove'
import sample from 'licia/sample'
import some from 'licia/some'
import sum from 'licia/sum'
import trim from 'licia/trim'
import { AudioManager } from '../lib/audio'
import { GameInput } from '../lib/input'
import { Hud } from '../ui/hud'
import { BotBrain, type AiContext } from './ai'
import {
  Battlefield,
  bulletRect,
  isInField,
  isTerrainBlocking,
  tankRect,
  testCollide,
} from './battlefield'
import {
  AI_SPAWN_SPEED,
  BOT_FREEZE_DURATION,
  BOT_SPAWN_X,
  BOT_SPAWN_Y,
  BULLET_EXPLOSION_SPREAD,
  BULLET_EXPLOSION_THRESHOLD,
  BULLET_SIZE,
  COLLIDE_THRESHOLD,
  FIELD_SIZE,
  GAME_OVER_DELAY,
  HELMET_DURATION,
  LIFE_BONUS_SCORE,
  MAX_BOTS_MULTI,
  MAX_BOTS_SINGLE,
  PLAYER_FREEZE_DURATION,
  PLAYER_RESPAWN_DELAY,
  PLAYER_SPAWNS,
  PLAYER_START_LIVES,
  POWER_UP_BLINK_INTERVAL,
  POWER_UP_NAMES,
  POWER_UP_SCORE,
  POWER_UP_TANK_INDEXES,
  SHOVEL_DURATION,
  SHOVEL_FLASH_COUNT,
  SHOVEL_FLASH_INTERVAL,
  SPAWN_FLICKER_DURATION,
  SPAWN_HELMET_DURATION,
  STAGE_CLEAR_DELAY,
  STAR_PICKED_BY_ARMOR_TANK_SCORE,
  STEEL_POWER,
  TANK_KILL_SCORE,
} from './constants'
import { STAGES } from './stages'
import { BattleScene } from './scene'
import type {
  Bullet,
  Direction,
  PlayerState,
  PowerUp,
  PowerUpName,
  Rect,
  Tank,
  TankLevel,
} from './types'
import {
  bulletInterval,
  bulletLimit,
  bulletPower,
  bulletSpeed,
  isMaxLevel,
  moveSpeed,
  nextTankLevel,
  tankHp,
} from './values'

type Phase =
  | 'menu'
  | 'stage-intro'
  | 'playing'
  | 'stage-clear'
  | 'game-over'
  | 'paused'
  | 'preview'

/** Why the run ended. */
type GameOverReason = 'eagle' | 'dead' | 'victory'

const STAGE_INTRO_DURATION = 1400
const BULLET_SUBSTEP = 0.05
const TOTAL_BOTS_PER_STAGE = 20

interface ShovelState {
  timer: number
  flashing: boolean
  flashTimer: number
  flashCount: number
  /** Whether the surrounding walls are currently steel. */
  asSteel: boolean
}

export class Game {
  private readonly scene: BattleScene
  private readonly input: GameInput
  private readonly audio: AudioManager
  private readonly hud: Hud

  private phase: Phase = 'menu'
  private phaseTimer = 0
  private stageIndex = 0
  /** Stage chosen on the menu — restart returns here. */
  private startStageIndex = 0
  private playerCount: 1 | 2 = 1

  private field = new Battlefield()
  private tanks: Tank[] = []
  private bullets: Bullet[] = []
  private powerUps: PowerUp[] = []
  private players: PlayerState[] = []

  private readonly botBrains = new Map<number, BotBrain>()
  private remainingBots: TankLevel[] = []
  private pendingSpawns = 0
  private botSpawnTimer = 0
  private botFrozenTimer = 0
  private shovel: ShovelState | null = null

  private nextId = 1
  private clock = 0
  private lastFrame = 0
  private readonly removedBullets = new Set<number>()
  private gameOverReason: GameOverReason = 'dead'
  private gameOverShown = false

  constructor() {
    const canvas = document.getElementById('stage') as HTMLCanvasElement
    this.scene = new BattleScene(canvas)
    this.input = new GameInput()
    this.audio = new AudioManager()
    this.hud = new Hud({
      onStart: (count, stageIndex) => this.startGame(count, stageIndex),
      onPreview: (stageIndex) => this.startPreview(stageIndex),
      onRestart: () => this.startGame(this.playerCount, this.startStageIndex),
      onMenu: () => this.toMenu(),
      onResume: () => this.resume(),
    })

    this.hud.showMenu()
  }

  start() {
    this.lastFrame = performance.now()
    requestAnimationFrame(this.loop)
  }

  /** A snapshot of the current game state, used by the development build. */
  debugState() {
    return {
      phase: this.phase,
      stage: this.stageIndex + 1,
      mapRows: STAGES[this.stageIndex]?.map ?? [],
      enemiesLeft: this.remainingBots.length + this.countAliveBots(),
      bullets: this.bullets.length,
      powerUps: this.powerUps.map((powerUp) => powerUp.name),
      players: this.players.map((player) => ({
        lives: player.lives,
        score: player.score,
        level:
          this.tanks.find((tank) => tank.id === player.activeTankId)?.level ??
          'basic',
      })),
      tanks: this.tanks.map((tank) => ({
        id: tank.id,
        side: tank.side,
        x: Number(tank.x.toFixed(2)),
        y: Number(tank.y.toFixed(2)),
        direction: tank.direction,
        hp: tank.hp,
        level: tank.level,
        alive: tank.alive,
        spawn: Number(tank.spawnProgress.toFixed(2)),
      })),
    }
  }

  // ---------------------------------------------------------------- lifecycle

  private startGame(playerCount: 1 | 2, stageIndex = 0) {
    this.playerCount = playerCount
    const clamped = clamp(stageIndex, 0, STAGES.length - 1)
    this.startStageIndex = clamped
    this.stageIndex = clamped
    this.players = []
    for (let index = 0; index < playerCount; index += 1) {
      this.players.push({
        index: index as 0 | 1,
        lives: PLAYER_START_LIVES,
        score: 0,
        kills: { basic: 0, fast: 0, power: 0, armor: 0 },
        activeTankId: -1,
        respawnTimer: 0,
        isSpawning: false,
        reservedLevel: null,
        lifeBonusMilestones: 0,
      })
    }
    this.hud.setPlayerCount(playerCount)
    this.input.createTouchControls(playerCount)
    this.input.setEnabled(true)
    this.hud.hideOverlay()
    this.hud.showHud()
    this.scene.setViewZoom(1)
    this.loadStage(clamped)
  }

  /** Dev-only: show stage terrain / materials with no tanks or AI. */
  private startPreview(stageIndex = 0) {
    const clamped = clamp(stageIndex, 0, STAGES.length - 1)
    this.stageIndex = clamped
    this.players = []
    this.remainingBots = []
    this.pendingSpawns = 0
    this.botSpawnTimer = 0
    this.botFrozenTimer = 0
    this.shovel = null
    this.input.setEnabled(true)
    this.input.removeTouchControls()
    this.hud.hideOverlay()
    this.hud.hideCurtain()
    this.hud.showHud({ preview: true })
    this.hud.setStage(clamped + 1)
    this.hud.setEnemyCount(0)

    this.teardownStage()
    this.scene.setViewZoom(1)
    const stage = STAGES[clamped]
    this.field = Battlefield.fromStage(stage)
    this.scene.buildTerrain(this.field)
    this.scene.setEagleAlive(true)
    this.scene.reshuffleWetGround()
    this.phase = 'preview'
  }

  private toMenu() {
    this.phase = 'menu'
    this.input.setEnabled(false)
    this.input.removeTouchControls()
    this.teardownStage()
    this.scene.setViewZoom(1)
    this.hud.hideHud()
    this.hud.hideCurtain()
    this.hud.showMenu()
  }

  private teardownStage() {
    this.scene.clearEntities()
    this.tanks = []
    this.bullets = []
    this.powerUps = []
    this.botBrains.clear()
    this.shovel = null
  }

  private loadStage(index: number) {
    this.teardownStage()

    const stage = STAGES[index]
    this.stageIndex = index
    this.field = Battlefield.fromStage(stage)
    this.scene.buildTerrain(this.field)
    this.scene.setEagleAlive(true)
    this.scene.reshuffleWetGround()

    this.remainingBots = parseBotWave(stage.bots)
    this.botSpawnTimer = 0
    this.botFrozenTimer = 0
    this.shovel = null

    for (const player of this.players) {
      player.respawnTimer = 0
      player.isSpawning = false
      this.spawnPlayer(player)
    }

    // Reference fills the field up to the concurrent bot cap at stage start.
    this.pendingSpawns = clamp(this.remainingBots.length, 0, this.maxBotCount())
    this.hud.setStage(index + 1)
    this.hud.setEnemyCount(this.remainingBots.length)

    this.phase = 'stage-intro'
    this.phaseTimer = STAGE_INTRO_DURATION
    this.hud.showCurtain(`STAGE ${index + 1}`)
    this.audio.play('stage_start')
  }

  private beginStage() {
    this.phase = 'playing'
    this.hud.hideCurtain()
    this.hud.setEnemyCount(this.remainingBots.length)
  }

  private resume() {
    if (this.phase !== 'paused') return
    this.phase = 'playing'
    this.hud.hideOverlay()
    this.audio.play('pause')
  }

  private pause() {
    if (this.phase !== 'playing') return
    this.phase = 'paused'
    this.hud.showPause()
    this.audio.play('pause')
  }

  // ------------------------------------------------------------------- update

  private loop = (now: number) => {
    requestAnimationFrame(this.loop)
    const dt = clamp(now - this.lastFrame, 0, 60)
    this.lastFrame = now
    this.clock += dt

    if (this.input.consumePauseRequest()) {
      if (this.phase === 'playing') this.pause()
      else if (this.phase === 'paused') this.resume()
      else if (this.phase === 'preview') this.toMenu()
    }

    this.update(dt)
    this.scene.render(dt, this.clock)
  }

  private update(dt: number) {
    switch (this.phase) {
      case 'stage-intro':
        this.phaseTimer -= dt
        if (this.phaseTimer <= 0) this.beginStage()
        break
      case 'playing':
        this.updatePlaying(dt)
        break
      case 'stage-clear':
        this.phaseTimer -= dt
        if (this.phaseTimer <= 0) this.advanceStage()
        break
      case 'game-over':
        this.phaseTimer -= dt
        if (this.phaseTimer <= 0) this.showGameOver()
        break
      default:
        break
    }

    // Keep the visuals in sync even while paused or in menus.
    for (const tank of this.tanks) {
      this.scene.updateTank(tank, this.clock)
    }
    for (const powerUp of this.powerUps) {
      this.scene.updatePowerUp(powerUp, this.clock / 1000)
    }
  }

  private updatePlaying(dt: number) {
    this.updateShovel(dt)
    this.updateTankTimers(dt)
    this.updatePlayers(dt)
    this.updateBots(dt)
    this.updateSpawning(dt)
    this.updateBullets(dt)
    this.updatePowerUps(dt)
    this.checkStageEnd()
  }

  /** Runs the per-tank timers: reload, shield and the friendly-fire freeze. */
  private updateTankTimers(dt: number) {
    for (const tank of this.tanks) {
      if (tank.cooldown > 0) tank.cooldown -= dt
      if (tank.helmetDuration > 0) tank.helmetDuration -= dt
      if (tank.frozenTimeout > 0) {
        tank.frozenTimeout -= dt
        // Blink while the tank is frozen by friendly fire.
        tank.visible = Math.floor(this.clock / 110) % 2 === 0
        if (tank.frozenTimeout <= 0) tank.visible = true
      }
    }
  }

  // ------------------------------------------------------------------ players

  private updatePlayers(dt: number) {
    for (const player of this.players) {
      const tank = this.tanks.find((t) => t.id === player.activeTankId)
      if (!tank || !tank.alive) {
        if (player.respawnTimer > 0) {
          player.respawnTimer -= dt
          if (player.respawnTimer <= 0) {
            this.spawnPlayer(player)
          }
        } else if (
          this.playerCount === 2 &&
          player.lives === 0 &&
          !player.isSpawning
        ) {
          // Reference: a defeated player can borrow a life by pressing fire.
          const input = this.input.getInput(player.index)
          if (input.fire) this.tryBorrowLife(player)
        }
        continue
      }

      const input = this.input.getInput(player.index)
      this.moveTank(tank, dt, input.direction)
      if (input.fire) this.tryFire(tank)
    }
  }

  private tryBorrowLife(player: PlayerState) {
    const lender = this.players.find(
      (other) => other.index !== player.index && other.lives > 0,
    )
    if (!lender) return
    lender.lives -= 1
    player.lives += 1
    this.updatePlayerHud(lender)
    this.spawnPlayer(player)
  }

  /**
   * Spawns a player tank. Life is spent here (not on death), matching the
   * reference. A reserved level from a cleared stage is reused without cost.
   */
  private spawnPlayer(player: PlayerState) {
    if (player.isSpawning) return

    let level: TankLevel = 'basic'
    let consumeLife = true
    if (player.reservedLevel) {
      level = player.reservedLevel
      player.reservedLevel = null
      consumeLife = false
    } else if (player.lives > 0) {
      level = 'basic'
    } else {
      return
    }

    if (consumeLife) {
      player.lives -= 1
    }

    const spawn = PLAYER_SPAWNS[player.index]
    const tank: Tank = {
      id: this.nextId++,
      side: 'player',
      playerIndex: player.index,
      level,
      hp: 1,
      x: spawn.x,
      y: spawn.y,
      direction: 'up',
      moving: false,
      cooldown: 0,
      frozenTimeout: 0,
      helmetDuration: SPAWN_HELMET_DURATION,
      withPowerUp: false,
      alive: true,
      reservedX: spawn.x,
      reservedY: spawn.y,
      spawnProgress: 0,
      visible: true,
    }
    player.activeTankId = tank.id
    player.isSpawning = true
    this.tanks.push(tank)
    this.scene.addTank(tank)
    this.updatePlayerHud(player)
  }

  // --------------------------------------------------------------------- bots

  private updateBots(dt: number) {
    if (this.botFrozenTimer > 0) {
      this.botFrozenTimer -= dt
      if (this.botFrozenTimer < 0) this.botFrozenTimer = 0
    }

    const frozen = this.botFrozenTimer > 0
    const context: AiContext = {
      field: this.field,
      tanks: this.tanks,
      bullets: this.bullets,
    }

    for (const tank of this.tanks) {
      if (tank.side !== 'bot' || !tank.alive) continue
      if (tank.spawnProgress < 1) continue

      // Timer power-up freezes both movement and firing.
      if (frozen) {
        tank.moving = false
        continue
      }

      const brain = this.botBrains.get(tank.id)
      if (!brain) continue

      const command = brain.update(dt, context)
      this.moveTank(tank, dt, command.direction)
      if (command.fire) this.tryFire(tank)
    }
  }

  private maxBotCount() {
    return this.playerCount === 2 ? MAX_BOTS_MULTI : MAX_BOTS_SINGLE
  }

  private botSpawnDuration() {
    const difficulty = STAGES[this.stageIndex]?.difficulty ?? 1
    const speed = AI_SPAWN_SPEED[difficulty] ?? 1
    return SPAWN_FLICKER_DURATION / speed
  }

  private updateSpawning(dt: number) {
    for (const tank of this.tanks) {
      if (tank.spawnProgress < 1) {
        const duration =
          tank.side === 'bot' ? this.botSpawnDuration() : SPAWN_FLICKER_DURATION
        tank.spawnProgress = clamp(tank.spawnProgress + dt / duration, 0, 1)
        if (tank.spawnProgress >= 1 && tank.side === 'player') {
          const player = this.players[tank.playerIndex]
          if (player) player.isSpawning = false
        }
      }
    }

    if (this.pendingSpawns <= 0 || this.remainingBots.length === 0) return

    // Only one enemy materialises at a time.
    const spawning = some(
      this.tanks,
      (t) => t.side === 'bot' && t.spawnProgress < 1,
    )
    if (spawning) return

    this.botSpawnTimer -= dt
    if (this.botSpawnTimer > 0) return

    const position = this.findSpawnPosition()
    if (!position) {
      this.botSpawnTimer = 200
      return
    }

    this.botSpawnTimer = 0
    this.spawnBot(position)
  }

  private findSpawnPosition() {
    const options = map(BOT_SPAWN_X, (x) => ({ x, y: BOT_SPAWN_Y }))
    const free = filter(options, (option) => {
      const rect = tankRect(option.x, option.y)
      return !some(
        this.tanks,
        (tank) => tank.alive && testCollide(tankRect(tank.x, tank.y), rect),
      )
    })
    if (free.length === 0) return null
    return sample(free, 1)[0]
  }

  private spawnBot(position: { x: number; y: number }) {
    const level = this.remainingBots.shift()!
    // Reference indexes power-up tanks from the start of the wave (0-based).
    const index = TOTAL_BOTS_PER_STAGE - this.remainingBots.length - 1
    const withPowerUp = contain(POWER_UP_TANK_INDEXES, index)

    // Spawning a power-up carrier clears any power-up still on the field.
    if (withPowerUp) {
      this.clearAllPowerUps()
    }

    const tank: Tank = {
      id: this.nextId++,
      side: 'bot',
      playerIndex: -1,
      level,
      hp: tankHp(level),
      x: position.x,
      y: position.y,
      direction: 'down',
      moving: false,
      cooldown: 0,
      frozenTimeout: 0,
      helmetDuration: 0,
      withPowerUp,
      alive: true,
      reservedX: position.x,
      reservedY: position.y,
      spawnProgress: 0,
      visible: true,
    }
    this.tanks.push(tank)
    this.botBrains.set(tank.id, new BotBrain(tank))
    this.scene.addTank(tank)
    this.pendingSpawns = Math.max(0, this.pendingSpawns - 1)
    this.hud.setEnemyCount(this.remainingBots.length + this.countAliveBots())
  }

  private clearAllPowerUps() {
    for (const powerUp of this.powerUps) {
      this.scene.removePowerUp(powerUp.id)
    }
    this.powerUps = []
  }

  private countAliveBots() {
    return filter(this.tanks, (tank) => tank.side === 'bot' && tank.alive)
      .length
  }

  // ------------------------------------------------------------------ movement

  /**
   * Moves a tank. Perpendicular turns snap onto a half-cell that still leaves
   * room to drive in the new direction — blind reserved snaps often wedge the
   * tank against a wall column so it can neither move nor usefully re-turn.
   */
  private moveTank(tank: Tank, dt: number, desired: Direction | null) {
    if (tank.spawnProgress < 1) return

    if (!desired) {
      tank.moving = false
      return
    }

    if (isPerpendicular(desired, tank.direction)) {
      const snapped = this.pickTurnPosition(tank, desired)
      if (snapped) {
        tank.x = snapped.x
        tank.y = snapped.y
      } else if (
        this.canTankMove(tank, tank.reservedX, tank.reservedY, tank.id)
      ) {
        tank.x = tank.reservedX
        tank.y = tank.reservedY
      }
      tank.direction = desired
      tank.moving = false
      tank.reservedX = tank.x
      tank.reservedY = tank.y
      return
    }

    if (desired !== tank.direction) {
      tank.direction = desired
    }

    // Frozen tanks can turn but cannot drive (friendly-fire freeze).
    if (tank.frozenTimeout > 0) {
      tank.moving = false
      return
    }

    const distance = (moveSpeed(tank) * dt) / 1000
    const next = this.stepPosition(
      { x: tank.x, y: tank.y },
      tank.direction,
      distance,
    )

    if (!this.canTankMove(tank, next.x, next.y, tank.id)) {
      tank.moving = false
      return
    }

    tank.x = next.x
    tank.y = next.y
    tank.moving = true

    const reserved = this.computeReserved(tank)
    tank.reservedX = reserved.x
    tank.reservedY = reserved.y
  }

  /**
   * Picks a half-cell snap for a perpendicular turn that the tank fits in and
   * can step forward from in the new direction.
   */
  private pickTurnPosition(tank: Tank, desired: Direction) {
    const horizontal = tank.direction === 'left' || tank.direction === 'right'
    const coordinate = horizontal ? tank.x : tank.y
    const step = Math.max((moveSpeed(tank) * 16) / 1000, 0.05)
    const candidates = [
      Math.round(coordinate / 0.5) * 0.5,
      Math.floor(coordinate / 0.5) * 0.5,
      Math.ceil(coordinate / 0.5) * 0.5,
      horizontal ? tank.reservedX : tank.reservedY,
    ]

    for (const candidate of candidates) {
      const position = horizontal
        ? { x: candidate, y: tank.y }
        : { x: tank.x, y: candidate }
      if (!this.canTankMove(tank, position.x, position.y, tank.id)) continue
      const ahead = this.stepPosition(position, desired, step)
      if (!this.canTankMove(tank, ahead.x, ahead.y, tank.id)) continue
      return position
    }
    return null
  }

  private stepPosition(
    position: { x: number; y: number },
    direction: Direction,
    distance: number,
  ) {
    switch (direction) {
      case 'up':
        return { x: position.x, y: position.y - distance }
      case 'down':
        return { x: position.x, y: position.y + distance }
      case 'left':
        return { x: position.x - distance, y: position.y }
      default:
        return { x: position.x + distance, y: position.y }
    }
  }

  /**
   * Snaps the travelling axis to the nearest half cell (reference floor8 /
   * ceil8 / round8), picking a candidate the tank still fits into.
   */
  private computeReserved(tank: Tank) {
    const horizontal = tank.direction === 'left' || tank.direction === 'right'
    const coordinate = horizontal ? tank.x : tank.y
    const floor = Math.floor(coordinate / 0.5) * 0.5
    const ceil = Math.ceil(coordinate / 0.5) * 0.5
    const round = Math.round(coordinate / 0.5) * 0.5

    const atFloor = horizontal
      ? { x: floor, y: tank.y }
      : { x: tank.x, y: floor }
    const atCeil = horizontal ? { x: ceil, y: tank.y } : { x: tank.x, y: ceil }
    const atRound = horizontal
      ? { x: round, y: tank.y }
      : { x: tank.x, y: round }

    const floorOk = this.canTankMove(tank, atFloor.x, atFloor.y, tank.id)
    const ceilOk = this.canTankMove(tank, atCeil.x, atCeil.y, tank.id)
    const roundOk = this.canTankMove(tank, atRound.x, atRound.y, tank.id)

    if (roundOk) return atRound
    if (floorOk) return atFloor
    if (ceilOk) return atCeil
    // Fall back to the current pose rather than a snap inside a wall.
    return { x: tank.x, y: tank.y }
  }

  /** Checks whether a tank may occupy the given position. */
  private canTankMove(tank: Tank, x: number, y: number, ignoreId: number) {
    const rect = tankRect(x, y)
    if (!isInField(rect)) return false

    const eagle = this.field.eagleRect()
    if (eagle && testCollide(eagle, rect, COLLIDE_THRESHOLD)) return false

    if (isTerrainBlocking(this.field, rect, COLLIDE_THRESHOLD)) return false

    for (const other of this.tanks) {
      if (!other.alive || other.id === ignoreId) continue
      if (!isInFront(other, tank)) continue
      const otherRect = tankRect(other.reservedX, other.reservedY)
      if (testCollide(otherRect, rect, COLLIDE_THRESHOLD)) return false
    }

    return true
  }

  // -------------------------------------------------------------------- firing

  private tryFire(tank: Tank) {
    if (tank.spawnProgress < 1) return
    if (tank.cooldown > 0) return
    if (tank.side === 'bot' && this.botFrozenTimer > 0) return

    const owned = filter(this.bullets, (bullet) => bullet.ownerId === tank.id)
    if (owned.length >= bulletLimit(tank)) return

    const { x, y } = bulletStartPosition(tank)
    const bullet: Bullet = {
      id: this.nextId++,
      ownerId: tank.id,
      side: tank.side,
      x,
      y,
      lastX: x,
      lastY: y,
      direction: tank.direction,
      speed: bulletSpeed(tank),
      power: bulletPower(tank),
    }

    this.bullets.push(bullet)
    // Sync the mesh before sampling the gun tip so flash / shot height match.
    this.scene.updateTank(tank, this.clock)
    this.scene.addBullet(bullet)
    this.scene.spawnMuzzleFlash(tank.id, tank.direction)
    tank.cooldown = bulletInterval(tank)

    if (tank.side === 'player') {
      this.audio.play('bullet_shot')
    }
  }

  // ------------------------------------------------------------------- bullets

  private updateBullets(dt: number) {
    const survivors: Bullet[] = []

    for (const bullet of this.bullets) {
      if (this.removedBullets.has(bullet.id)) continue

      // Bullets keep flying after their owner dies (reference TankRecord note).
      const travelled = (bullet.speed * dt) / 1000
      const steps = Math.max(1, Math.ceil(travelled / BULLET_SUBSTEP))
      const stepLength = travelled / steps

      let exploded = false
      for (let step = 0; step < steps && !exploded; step += 1) {
        bullet.lastX = bullet.x
        bullet.lastY = bullet.y
        const next = { x: bullet.x, y: bullet.y }
        switch (bullet.direction) {
          case 'up':
            next.y -= stepLength
            break
          case 'down':
            next.y += stepLength
            break
          case 'left':
            next.x -= stepLength
            break
          case 'right':
            next.x += stepLength
            break
        }
        bullet.x = next.x
        bullet.y = next.y

        exploded = this.resolveBulletCollision(bullet)
      }

      if (exploded) {
        this.removedBullets.add(bullet.id)
        continue
      }

      this.scene.updateBullet(bullet, this.clock)
      survivors.push(bullet)
    }

    this.bullets = survivors
    each([...this.removedBullets], (id) => this.scene.removeBullet(id))
    this.removedBullets.clear()
  }

  /** Returns true when the bullet was consumed by a collision. */
  private resolveBulletCollision(bullet: Bullet) {
    const current = bulletRect(bullet.x, bullet.y)
    const previous = bulletRect(bullet.lastX, bullet.lastY)
    const swept = mergeRects(current, previous)

    // Leaving the battlefield.
    if (!isInField(current)) {
      this.detonateBullet(bullet, bullet.x, bullet.y, 0xffcf7a, 0.5, 'border')
      return true
    }

    // Bricks.
    let hitBrick = false
    this.field.forEachBrick(swept, (index) => {
      if (hitBrick || !this.field.bricks[index]) return
      if (testCollide(this.field.brickRect(index), swept)) hitBrick = true
    })
    if (hitBrick) {
      this.detonateBullet(bullet, bullet.x, bullet.y, 0xd97b52, 0.7, 'brick')
      return true
    }

    // Steel before eagle so shovel walls can stop a shot (splash may still
    // reach the eagle via spread, matching the reference).
    let hitSteel = false
    this.field.forEachSteel(swept, (index) => {
      if (hitSteel || !this.field.steels[index]) return
      if (testCollide(this.field.steelRect(index), swept)) hitSteel = true
    })
    if (hitSteel) {
      this.detonateBullet(bullet, bullet.x, bullet.y, 0xdfe7f2, 0.7, 'steel')
      return true
    }

    // Direct eagle hit.
    const eagle = this.field.eagleRect()
    if (eagle && testCollide(eagle, swept)) {
      this.detonateBullet(bullet, bullet.x, bullet.y, 0xffd98a, 1)
      return true
    }

    // Tanks.
    for (const tank of this.tanks) {
      if (!tank.alive || tank.id === bullet.ownerId) continue
      if (tank.spawnProgress < 1) continue
      if (!testCollide(tankRect(tank.x, tank.y), swept, -0.02 / 16)) continue

      if (bullet.side === 'player' && tank.side === 'player') {
        this.freezePlayerTank(tank)
        this.detonateBullet(bullet, bullet.x, bullet.y, 0x9fd8ff, 0.5)
        return true
      }

      if (bullet.side === 'bot' && tank.side === 'bot') {
        continue
      }

      // Helmet absorbs bot bullets without an explosion or terrain splash.
      if (
        bullet.side === 'bot' &&
        tank.side === 'player' &&
        tank.helmetDuration > 0
      ) {
        return true
      }

      this.damageTank(tank, bullet)
      this.detonateBullet(bullet, bullet.x, bullet.y, 0xffb347, 0.6)
      return true
    }

    // Bullet-bullet: both vanish without exploding (reference shouldExplode).
    for (const other of this.bullets) {
      if (other.id === bullet.id) continue
      if (this.removedBullets.has(other.id)) continue
      if (!testCollide(bulletRect(other.x, other.y), swept)) continue
      this.removedBullets.add(other.id)
      return true
    }

    return false
  }

  /**
   * Explodes a bullet and applies the reference splash: bricks always, steels
   * when power is high enough, eagle when the spread overlaps it.
   */
  private detonateBullet(
    bullet: Bullet,
    x: number,
    y: number,
    color: number,
    scale: number,
    surface?: 'brick' | 'steel' | 'border',
  ) {
    this.destroyBricksAround(bullet)
    if (bullet.power >= STEEL_POWER) {
      this.destroySteelsAround(bullet)
    }
    this.destroyEagleIfSpreadHits(bullet)

    // Bullet x/y is the hitbox corner; centre it to match the missile mesh.
    this.scene.spawnExplosion(
      x + BULLET_SIZE / 2,
      y + BULLET_SIZE / 2,
      color,
      scale,
      0.4,
    )
    if (bullet.side !== 'player') return
    if (surface === 'brick') {
      this.audio.play('bullet_hit_2', 0.7)
    } else if (surface === 'steel' || surface === 'border') {
      this.audio.play('bullet_hit_1', 0.7)
    }
  }

  private destroyBricksAround(bullet: Bullet) {
    const spread = spreadBulletRect(bullet)
    this.field.forEachBrick(spread, (index) => {
      if (!this.field.bricks[index]) return
      this.field.destroyBrick(index)
      this.scene.hideBrick(index)
    })
  }

  private destroySteelsAround(bullet: Bullet) {
    const spread = spreadBulletRect(bullet)
    this.field.forEachSteel(spread, (index) => {
      if (!this.field.steels[index]) return
      this.field.steels[index] = 0
      this.scene.hideSteel(index)
    })
  }

  // --------------------------------------------------------------------- tanks

  private damageTank(tank: Tank, bullet: Bullet) {
    // Power-up carriers drop their item on the first hit, even if they survive.
    if (tank.side === 'bot' && tank.withPowerUp) {
      tank.withPowerUp = false
      this.spawnPowerUp()
    }

    if (tank.side === 'player') {
      this.killTank(tank, bullet, 'bullet')
      return
    }

    tank.hp -= 1
    if (tank.hp > 0) {
      return
    }
    this.killTank(tank, bullet, 'bullet')
  }

  private killTank(
    tank: Tank,
    bullet: Bullet | null,
    method: 'bullet' | 'grenade',
    creditedPlayer?: PlayerState,
  ) {
    tank.alive = false
    tank.moving = false
    this.scene.removeTank(tank.id)
    this.botBrains.delete(tank.id)

    const palette = tank.side === 'player' ? 0xf5b642 : 0xff9a3c
    this.scene.spawnExplosion(tank.x + 0.5, tank.y + 0.5, palette, 1.2, 0.35)
    this.audio.play('explosion_1')

    if (tank.side === 'bot') {
      if (this.remainingBots.length > 0) {
        this.pendingSpawns += 1
      }
      this.hud.setEnemyCount(this.remainingBots.length + this.countAliveBots())

      const player =
        creditedPlayer ??
        (bullet
          ? (() => {
              const owner = this.tanks.find((t) => t.id === bullet.ownerId)
              return owner && owner.side === 'player'
                ? this.players[owner.playerIndex]
                : undefined
            })()
          : undefined)
      if (!player) return

      // Reference always increments kill counts; score only for bullet kills.
      player.kills[tank.level] += 1
      if (method === 'bullet') {
        player.score += TANK_KILL_SCORE[tank.level]
        this.checkLifeBonus(player)
      }
      this.updatePlayerHud(player)
      return
    }

    // A player tank was destroyed — life was already spent at spawn time.
    const player = this.players[tank.playerIndex]
    if (!player) return
    player.activeTankId = -1
    player.isSpawning = false
    if (player.lives > 0) {
      player.respawnTimer = PLAYER_RESPAWN_DELAY
    } else {
      player.respawnTimer = 0
    }
    this.updatePlayerHud(player)
  }

  private freezePlayerTank(tank: Tank) {
    tank.frozenTimeout = PLAYER_FREEZE_DURATION
    tank.visible = false
  }

  // ---------------------------------------------------------------- power-ups

  private spawnPowerUp() {
    const name = this.choosePowerUp()
    const position = this.findPowerUpPosition()
    if (!position) return

    const powerUp: PowerUp = {
      id: this.nextId++,
      name,
      x: position.x,
      y: position.y,
      visible: true,
      lifetime: Number.POSITIVE_INFINITY,
    }
    this.powerUps.push(powerUp)
    this.scene.addPowerUp(powerUp)
    this.audio.play('powerup_appear')
  }

  private choosePowerUp(): PowerUpName {
    const eagle = this.field.eagle
    if (eagle && this.eagleCanBeHitDirectly()) {
      if (random(0, 1, true) < 0.5) return 'shovel'
    }
    const hasBasicTank = some(this.players, (player) => {
      const active = find(this.tanks, (tank) => tank.id === player.activeTankId)
      return !!(active && active.level === 'basic')
    })
    if (hasBasicTank && random(0, 1, true) < 0.4) return 'star'
    return sample(POWER_UP_NAMES, 1)[0]
  }

  /**
   * True when any cardinal approach to the eagle has a clear firing lane —
   * approximates the reference fire-resist check around the eagle spot.
   */
  private eagleCanBeHitDirectly() {
    const eagle = this.field.eagle
    if (!eagle) return false
    const centre = { x: eagle.x + 0.5, y: eagle.y + 0.5 }
    const rays: [number, number][] = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]

    for (const [vx, vy] of rays) {
      let clear = true
      for (let step = 1; step < 40; step += 1) {
        const x = centre.x + vx * step * 0.25
        const y = centre.y + vy * step * 0.25
        if (x < 0 || y < 0 || x >= FIELD_SIZE || y >= FIELD_SIZE) break
        const rect = { x: x - 0.02, y: y - 0.02, width: 0.04, height: 0.04 }
        let blocked = false
        this.field.forEachBrick(rect, (index) => {
          if (this.field.bricks[index]) blocked = true
        })
        this.field.forEachSteel(rect, (index) => {
          if (this.field.steels[index]) blocked = true
        })
        if (blocked) {
          clear = false
          break
        }
      }
      if (clear) return true
    }

    return false
  }

  /**
   * Picks a power-up spawn like the reference: half-cell steps where 1–3 of
   * the centre quarters overlap solid terrain (not fully clear / fully blocked).
   */
  private findPowerUpPosition() {
    const candidates: { x: number; y: number }[] = []
    const eagle = this.field.eagleRect()

    for (let y = 0; y < FIELD_SIZE - 1; y += 0.5) {
      for (let x = 0; x < FIELD_SIZE - 1; x += 0.5) {
        let collideCount = 0
        const parts = [
          { x: x + 0.25, y: y + 0.25, width: 0.25, height: 0.25 },
          { x: x + 0.5, y: y + 0.25, width: 0.25, height: 0.25 },
          { x: x + 0.25, y: y + 0.5, width: 0.25, height: 0.25 },
          { x: x + 0.5, y: y + 0.5, width: 0.25, height: 0.25 },
        ]

        for (const part of parts) {
          let hit = false
          this.field.forEachBrick(part, (index) => {
            if (!hit && this.field.bricks[index]) hit = true
          })
          if (!hit) {
            this.field.forEachSteel(part, (index) => {
              if (!hit && this.field.steels[index]) hit = true
            })
          }
          if (!hit) {
            this.field.forEachCell(part, (index) => {
              if (!hit && this.field.rivers[index]) hit = true
            })
          }
          if (!hit && eagle && testCollide(eagle, part)) hit = true
          if (hit) collideCount += 1
        }

        if (collideCount >= 1 && collideCount <= 3) {
          // Store the centre of the 1-cell power-up sprite.
          candidates.push({ x: x + 0.5, y: y + 0.5 })
        }
      }
    }

    if (candidates.length === 0) return null
    return sample(candidates, 1)[0]
  }

  private updatePowerUps(dt: number) {
    for (const powerUp of this.powerUps) {
      powerUp.lifetime -= dt
      powerUp.visible =
        Math.floor(this.clock / POWER_UP_BLINK_INTERVAL) % 2 === 0

      for (const tank of this.tanks) {
        if (!tank.alive || tank.side !== 'player') continue
        if (tank.spawnProgress < 1) continue
        // Reference power-up hitbox is the centre half of the 1-cell sprite.
        const rect = {
          x: powerUp.x - 0.25,
          y: powerUp.y - 0.25,
          width: 0.5,
          height: 0.5,
        }
        if (!testCollide(rect, tankRect(tank.x, tank.y))) continue
        this.collectPowerUp(powerUp, tank)
        break
      }
    }

    this.powerUps = filter(this.powerUps, (powerUp) => {
      if (powerUp.lifetime > 0) return true
      this.scene.removePowerUp(powerUp.id)
      return false
    })
  }

  private collectPowerUp(powerUp: PowerUp, tank: Tank) {
    const player = this.players[tank.playerIndex]
    if (!player) return

    this.scene.removePowerUp(powerUp.id)
    remove(this.powerUps, (item) => item.id === powerUp.id)
    this.audio.play('powerup_pick')

    player.score += POWER_UP_SCORE
    this.checkLifeBonus(player)

    switch (powerUp.name) {
      case 'tank':
        player.lives += 1
        break
      case 'star':
        if (isMaxLevel(tank.level)) {
          player.score += STAR_PICKED_BY_ARMOR_TANK_SCORE
        } else {
          tank.level = nextTankLevel(tank.level)
          // Player tanks always have 1 HP; level only changes firepower.
        }
        break
      case 'grenade':
        this.detonateGrenade(player)
        break
      case 'timer':
        this.botFrozenTimer = BOT_FREEZE_DURATION
        break
      case 'helmet':
        tank.helmetDuration = HELMET_DURATION
        break
      case 'shovel':
        this.activateShovel()
        break
    }

    this.updatePlayerHud(player)
  }

  private detonateGrenade(player: PlayerState) {
    for (const tank of [...this.tanks]) {
      if (tank.side !== 'bot' || !tank.alive) continue
      // Grenade bypasses Hit, so carriers do not drop power-ups (reference).
      tank.withPowerUp = false
      this.killTank(tank, null, 'grenade', player)
    }
    this.audio.play('explosion_2')
    this.hud.setEnemyCount(this.remainingBots.length + this.countAliveBots())
  }

  // ------------------------------------------------------------------- shovel

  private activateShovel() {
    if (!this.field.eagle) return

    this.applyShovelSteels()
    this.shovel = {
      timer: SHOVEL_DURATION,
      flashing: false,
      flashTimer: 0,
      flashCount: 0,
      asSteel: true,
    }
  }

  /** Fortify the eagle surround with steel (reference `convertToSteels`). */
  private applyShovelSteels() {
    const box = this.field.eagleSurroundingBox()
    const eagle = this.field.eagleRect()
    if (!box || !eagle) return

    this.field.forEachBrick(box, (index) => {
      if (!this.field.bricks[index]) return
      this.field.bricks[index] = 0
      this.scene.hideBrick(index)
    })

    this.field.forEachSteel(box, (index) => {
      const rect = this.field.steelRect(index)
      // Do not place steel on top of the eagle itself or living tanks.
      if (testCollide(eagle, rect, -0.1)) return
      if (this.anyTankBlocksRect(rect)) return
      this.field.steels[index] = 1
      this.scene.showSteel(index, this.field)
    })
  }

  /** Restore brick walls around the eagle (reference `convertToBricks`). */
  private applyShovelBricks() {
    const box = this.field.eagleSurroundingBox()
    const eagle = this.field.eagleRect()
    if (!box || !eagle) return

    this.field.forEachSteel(box, (index) => {
      if (!this.field.steels[index]) return
      this.field.steels[index] = 0
      this.scene.hideSteel(index)
    })

    this.field.forEachBrick(box, (index) => {
      const rect = this.field.brickRect(index)
      if (testCollide(eagle, rect, -0.1)) return
      if (this.anyTankBlocksRect(rect)) return
      this.field.bricks[index] = 1
      this.scene.showBrick(index)
    })
  }

  private anyTankBlocksRect(rect: Rect) {
    return some(
      this.tanks,
      (tank) => tank.alive && testCollide(tankRect(tank.x, tank.y), rect, -0.1),
    )
  }

  private updateShovel(dt: number) {
    const shovel = this.shovel
    if (!shovel) return

    shovel.timer -= dt

    const flashWindow = SHOVEL_FLASH_COUNT * 2 * SHOVEL_FLASH_INTERVAL
    if (!shovel.flashing && shovel.timer <= flashWindow) {
      shovel.flashing = true
      shovel.flashTimer = 0
    }

    if (shovel.flashing) {
      shovel.flashTimer -= dt
      if (shovel.flashTimer <= 0) {
        shovel.flashTimer = SHOVEL_FLASH_INTERVAL
        shovel.flashCount += 1
        if (shovel.asSteel) {
          this.applyShovelBricks()
          shovel.asSteel = false
        } else {
          this.applyShovelSteels()
          shovel.asSteel = true
        }
      }
    }

    if (shovel.timer > 0) return

    // Reference always ends as brick walls, not the pre-shovel layout.
    this.applyShovelBricks()
    this.shovel = null
  }

  // --------------------------------------------------------------------- eagle

  private destroyEagleIfSpreadHits(bullet: Bullet) {
    const eagle = this.field.eagleRect()
    if (!eagle) return
    if (testCollide(eagle, spreadBulletRect(bullet))) {
      this.destroyEagle()
    }
  }

  private destroyEagle() {
    if (!this.field.eagle) return
    this.field.eagle = null
    this.scene.setEagleAlive(false)
    this.audio.play('explosion_2')
    this.endGame('eagle')
  }

  // ------------------------------------------------------------------ scoring

  private checkLifeBonus(player: PlayerState) {
    const milestones = Math.floor(player.score / LIFE_BONUS_SCORE)
    while (player.lifeBonusMilestones < milestones) {
      player.lifeBonusMilestones += 1
      player.lives += 1
    }
  }

  private updatePlayerHud(player: PlayerState) {
    const tank = this.tanks.find((item) => item.id === player.activeTankId)
    this.hud.setPlayerStats(player.index, {
      lives: player.lives,
      score: player.score,
      level: tank ? tank.level : 'basic',
    })
  }

  // ---------------------------------------------------------------- stage flow

  private checkStageEnd() {
    const botsLeft = this.remainingBots.length + this.countAliveBots()
    this.hud.setEnemyCount(botsLeft)

    const spawningBot = this.tanks.some(
      (tank) => tank.side === 'bot' && tank.alive && tank.spawnProgress < 1,
    )
    if (botsLeft === 0 && !spawningBot) {
      this.reservePlayersForNextStage()
      this.phase = 'stage-clear'
      this.phaseTimer = STAGE_CLEAR_DELAY
      this.audio.play('statistics_1')
      const total = sum(...pluck(this.players, 'score'))
      this.hud.showStageClear(this.stageIndex, total)
      return
    }

    // Match reference isAllPlayerDead: no lives, no active tank, not spawning.
    const allDead = this.players.every((player) =>
      this.isPlayerDefeated(player),
    )
    if (allDead) {
      this.endGame('dead')
    }
  }

  private isPlayerDefeated(player: PlayerState) {
    if (player.lives > 0) return false
    if (player.isSpawning || player.respawnTimer > 0) return false
    const tank = this.tanks.find((item) => item.id === player.activeTankId)
    return !tank || !tank.alive
  }

  /** Carry living tanks' levels into the next stage without spending a life. */
  private reservePlayersForNextStage() {
    for (const player of this.players) {
      const tank = this.tanks.find((item) => item.id === player.activeTankId)
      if (tank && tank.alive) {
        player.reservedLevel = tank.level
        tank.alive = false
        tank.moving = false
        this.scene.removeTank(tank.id)
        player.activeTankId = -1
      }
    }
  }

  private advanceStage() {
    this.hud.hideOverlay()
    if (this.stageIndex + 1 >= STAGES.length) {
      this.endGame('victory')
      return
    }
    this.loadStage(this.stageIndex + 1)
  }

  private endGame(reason: GameOverReason) {
    if (this.phase === 'game-over') return
    this.phase = 'game-over'
    this.phaseTimer = GAME_OVER_DELAY
    this.gameOverReason = reason
    this.gameOverShown = false
    this.audio.play('game_over')
  }

  private showGameOver() {
    if (this.gameOverShown) return
    this.gameOverShown = true
    this.input.setEnabled(false)
    const total = sum(...pluck(this.players, 'score'))
    this.hud.showGameOver(this.gameOverReason, total)
  }
}

// ------------------------------------------------------------------- helpers

function parseBotWave(descriptors: string[]): TankLevel[] {
  const wave: TankLevel[] = []
  for (const descriptor of descriptors) {
    const [count, level] = map(descriptor.split('*'), (part) => trim(part))
    const total = Number(count)
    for (let i = 0; i < total; i += 1) {
      wave.push(level as TankLevel)
    }
  }
  return wave
}

function isPerpendicular(a: Direction, b: Direction) {
  const aVertical = a === 'up' || a === 'down'
  const bVertical = b === 'up' || b === 'down'
  return aVertical !== bVertical
}

/** True when `other` sits in front of `tank`. */
function isInFront(other: Tank, tank: Tank) {
  switch (tank.direction) {
    case 'left':
      return other.x < tank.x
    case 'right':
      return other.x > tank.x
    case 'up':
      return other.y < tank.y
    default:
      return other.y > tank.y
  }
}

/** The position a bullet leaves its tank from, in cells. */
function bulletStartPosition(tank: Tank) {
  // Centre on the tank cell — 6/16 was a half-pixel short and read as left-biased.
  const mid = (1 - BULLET_SIZE) / 2
  switch (tank.direction) {
    case 'up':
      return { x: tank.x + mid, y: tank.y }
    case 'down':
      return { x: tank.x + mid, y: tank.y + 1 - BULLET_SIZE }
    case 'left':
      return { x: tank.x, y: tank.y + mid }
    default:
      return { x: tank.x + 1 - BULLET_SIZE, y: tank.y + mid }
  }
}

/** The area a bullet clears when it breaks through terrain. */
function spreadBulletRect(bullet: Bullet) {
  const rect = bulletRect(bullet.x, bullet.y)
  const value = BULLET_EXPLOSION_SPREAD + BULLET_EXPLOSION_THRESHOLD
  if (bullet.direction === 'up' || bullet.direction === 'down') {
    rect.x -= value
    rect.width += 2 * value
    rect.y -= BULLET_EXPLOSION_THRESHOLD
    rect.height += BULLET_EXPLOSION_THRESHOLD
  } else {
    rect.x -= BULLET_EXPLOSION_THRESHOLD
    rect.width += 2 * BULLET_EXPLOSION_THRESHOLD
    rect.y -= value
    rect.height += 2 * value
  }
  return rect
}

/** Smallest rectangle covering both inputs. */
function mergeRects(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const right = Math.max(a.x + a.width, b.x + b.width)
  const bottom = Math.max(a.y + a.height, b.y + b.height)
  return { x: left, y: top, width: right - left, height: bottom - top }
}
