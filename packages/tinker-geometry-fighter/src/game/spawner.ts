import clamp from 'licia/clamp'
import find from 'licia/find'
import {
  GRID_H,
  GRID_W,
  MAX_SPAWN_INDEX,
  RUSH_RADIUS,
  RUSH_RADIUS_BH,
  SPAWN_CLEAR_RADIUS,
  SPAWN_INDEX_RATE,
  SPAWN_MARGIN,
  SWARM_MARGIN,
  UNIT,
} from './constants'
import { POOL, type EnemyKind } from './enemyTypes'

type WaveType = 'unused' | 'swarm' | 'rush'

interface WaveItem {
  genId: number
  alive: boolean
}

interface WaveData {
  type: WaveType
  kind: EnemyKind
  spawnCount: number
  timer: number
  trackers: WaveItem[]
}

interface SpawnerHost {
  playerAlive: boolean
  playerX: number
  playerY: number
  bombing: boolean
  countActive: (kind: EnemyKind) => number
  spawnEnemy: (
    kind: EnemyKind,
    x: number,
    y: number,
  ) => { genId: number } | null
  isEnemyAlive: (genId: number) => boolean
}

const NUM_WAVES = 80
/** OpenGW sized each wave for one or two at a time. Several run together now. */
const WAVE_SCALE = 1 / 3

const INTRO: readonly { kind: EnemyKind; level: number; keep: number }[] = [
  { kind: 'spinner', level: 3, keep: 2 },
  { kind: 'weaver', level: 6, keep: 2 },
  { kind: 'blackHole', level: 10, keep: 1 },
  { kind: 'snake', level: 16, keep: 1 },
  { kind: 'repulsor', level: 23, keep: 1 },
  { kind: 'mayfly', level: 30, keep: 1 },
]

export class Spawner {
  private spawnIndex = 0
  private lastSpawnIndex = 0
  private spawnProgress = 0
  private spawnCheckTimer = 100
  private spawnWaitTimer = 50
  private waveStartTimer = 0
  private numWavesAllowed = 0
  private waves: WaveData[] = []
  private swarmCorner = 0

  init() {
    this.spawnIndex = 0
    this.lastSpawnIndex = 0
    this.spawnProgress = 0
    this.spawnCheckTimer = 100
    this.spawnWaitTimer = 50
    this.waveStartTimer = 0
    this.numWavesAllowed = 0
    this.waves = []
    for (let i = 0; i < NUM_WAVES; i++) {
      this.waves.push({
        type: 'unused',
        kind: 'grunt',
        spawnCount: 0,
        timer: 0,
        trackers: [],
      })
    }
  }

  getSpawnIndex() {
    return Math.floor(this.spawnIndex)
  }

  /** HUD level: 1 at the start, 40 when the spawn index is maxed. */
  getLevel() {
    return clamp(Math.ceil(this.spawnIndex), 1, MAX_SPAWN_INDEX)
  }

  onPlayerDied() {
    this.spawnWaitTimer = 50
  }

  run(host: SpawnerHost) {
    if (this.getSpawnIndex() < MAX_SPAWN_INDEX) {
      this.spawnIndex = clamp(
        this.spawnIndex + SPAWN_INDEX_RATE,
        0,
        MAX_SPAWN_INDEX,
      )
      if (this.getSpawnIndex() > this.lastSpawnIndex) {
        this.lastSpawnIndex = this.getSpawnIndex()
        this.spawnProgress = clamp(this.spawnIndex / MAX_SPAWN_INDEX, 0, 1)
      }
    }

    if (this.spawnWaitTimer > 0) this.spawnWaitTimer--
    if (!host.playerAlive) {
      this.waveStartTimer = 0
      return
    }

    if (this.spawnWaitTimer > 0 || host.bombing) {
      this.spawnCheckTimer = 0
      return
    }

    const index = this.getSpawnIndex()
    const level = this.getLevel()

    if (++this.spawnCheckTimer > 100 || index > 10) {
      this.spawnCheckTimer = 0
      if (index <= 1) this.topUp(host, 'wanderer', 2)
      else if (index > 1 && index < 3) this.topUp(host, 'wanderer', 4)
      this.topUp(host, 'grunt', index <= 1 ? 2 : 4)
      for (const row of INTRO) {
        this.topUpIntro(host, level, row.kind, row.level, row.keep)
      }
    }

    this.numWavesAllowed = this.waveCap(level)

    if (
      ++this.waveStartTimer >= 20 &&
      this.numActiveWaves() < this.numWavesAllowed
    ) {
      this.waveStartTimer = 0
      this.rollWave(level)
    }

    this.runWaves(host)
  }

  private waveCap(level: number) {
    if (level <= 1) return 0
    if (level <= 3) return 1
    if (level <= 7) return 2
    if (level <= 10) return 3
    if (level <= 16) return 4
    if (level <= 22) return 5
    if (level <= 28) return 6
    if (level <= 34) return 7
    return 8
  }

  /** 0 means the kind is present from the opening, not on the intro schedule. */
  private kindLevel(kind: EnemyKind) {
    return find(INTRO, (row) => row.kind === kind)?.level ?? 0
  }

  private topUpIntro(
    host: SpawnerHost,
    level: number,
    kind: EnemyKind,
    at: number,
    wanted: number,
  ) {
    if (level < at) return
    this.topUp(host, kind, level === at ? 1 : wanted)
  }

  /** Debut level spawns a single enemy; crowds start on the following level. */
  private waveSize(level: number, kind: EnemyKind, count: number) {
    if (level < this.kindLevel(kind)) return 0
    if (level === this.kindLevel(kind)) return 1
    return count
  }

  private rollWave(level: number) {
    const p = this.spawnProgress
    const scaled = (n: number) => Math.max(1, Math.ceil(n * WAVE_SCALE))
    const max = (n: number, floor: number) =>
      Math.max(scaled(floor), Math.ceil(n * p * WAVE_SCALE))
    const rush = (n: number, floor: number) =>
      Math.max(scaled(floor), Math.ceil((n * p * WAVE_SCALE) / 2))
    const roll = Math.floor(Math.random() * 13)
    const wave = (type: WaveType, kind: EnemyKind, count: number) => {
      const n = this.waveSize(level, kind, count)
      if (n > 0) this.newWave(type, kind, n)
    }

    switch (roll) {
      case 0:
        wave('swarm', 'grunt', max(POOL.grunt, 20))
        break
      case 1:
        wave('swarm', 'weaver', max(POOL.weaver, 20))
        break
      case 2:
        wave('swarm', 'snake', max(POOL.snake, 8))
        break
      case 3:
        wave('swarm', 'spinner', max(POOL.spinner, 20))
        break
      case 4:
        wave(
          'swarm',
          'blackHole',
          Math.max(
            scaled(4),
            Math.ceil(Math.random() * POOL.blackHole * p * WAVE_SCALE),
          ),
        )
        break
      case 5:
        wave('swarm', 'mayfly', max(POOL.mayfly, 50))
        break
      case 6:
        wave('rush', 'grunt', rush(POOL.grunt, 20))
        break
      case 7:
        wave('rush', 'weaver', rush(POOL.weaver, 20))
        break
      case 8:
        wave('rush', 'snake', rush(POOL.snake, 8))
        break
      case 9:
        wave('rush', 'spinner', rush(POOL.spinner, 20))
        break
      case 11: {
        const n = Math.ceil(
          (Math.random() * POOL.repulsor * p * WAVE_SCALE) / 2,
        )
        wave('rush', 'repulsor', Math.max(1, n))
        break
      }
      default:
        break
    }
  }

  private pickAwayFromPlayer(
    host: SpawnerHost,
    margin: number,
    minDist = SPAWN_CLEAR_RADIUS,
  ): [number, number] {
    for (let i = 0; i < 24; i++) {
      const x = margin + Math.random() * (GRID_W - margin * 2)
      const y = margin + Math.random() * (GRID_H - margin * 2)
      if (Math.hypot(x - host.playerX, y - host.playerY) >= minDist) {
        return [x, y]
      }
    }
    const ang = Math.random() * Math.PI * 2
    const dist = minDist + 4 * UNIT
    return [
      clamp(host.playerX + Math.cos(ang) * dist, margin, GRID_W - margin),
      clamp(host.playerY + Math.sin(ang) * dist, margin, GRID_H - margin),
    ]
  }

  private topUp(host: SpawnerHost, kind: EnemyKind, wanted: number) {
    if (host.countActive(kind) >= wanted) return
    const [x, y] = this.pickAwayFromPlayer(host, SPAWN_MARGIN)
    host.spawnEnemy(kind, x, y)
  }

  private newWave(type: WaveType, kind: EnemyKind, spawnCount: number) {
    const wd = this.waves.find((w) => w.type === 'unused')
    if (!wd || spawnCount <= 0) return
    wd.type = type
    wd.kind = kind
    wd.spawnCount = spawnCount
    wd.timer = 0
    wd.trackers = []
  }

  private numActiveWaves() {
    return this.waves.filter((w) => w.type !== 'unused').length
  }

  private runWaves(host: SpawnerHost) {
    const margin = SWARM_MARGIN
    for (const wd of this.waves) {
      if (wd.type === 'unused') continue

      if (wd.type === 'rush') {
        while (wd.spawnCount-- > 0) {
          const ang = Math.random() * Math.PI * 2
          const dist = wd.kind === 'blackHole' ? RUSH_RADIUS_BH : RUSH_RADIUS
          const jitter = 3 * UNIT
          const x =
            host.playerX +
            Math.cos(ang) * dist +
            (Math.random() * 2 - 1) * jitter
          const y =
            host.playerY +
            Math.sin(ang) * dist +
            (Math.random() * 2 - 1) * jitter
          const e = host.spawnEnemy(
            wd.kind,
            clamp(x, margin, GRID_W - margin),
            clamp(y, margin, GRID_H - margin),
          )
          if (e) wd.trackers.push({ genId: e.genId, alive: true })
        }
      } else if (wd.timer === 0) {
        for (let n = 0; n < 4; n++) {
          if (wd.spawnCount-- <= 0) break
          const rx = (Math.random() * 2 - 1) * 5 * UNIT
          const ry = (Math.random() * 2 - 1) * 5 * UNIT
          let x = margin
          let y = margin
          switch (this.swarmCorner % 4) {
            case 0:
              x = margin + rx
              y = GRID_H - margin + ry
              break
            case 1:
              x = GRID_W - margin + rx
              y = GRID_H - margin + ry
              break
            case 2:
              x = GRID_W - margin + rx
              y = margin + ry
              break
            case 3:
              x = margin + rx
              y = margin + ry
              break
          }
          this.swarmCorner++
          x = clamp(x, margin, GRID_W - margin)
          y = clamp(y, margin, GRID_H - margin)
          // Corner may land near the fighter — push out if too close.
          if (
            Math.hypot(x - host.playerX, y - host.playerY) < SPAWN_CLEAR_RADIUS
          ) {
            ;[x, y] = this.pickAwayFromPlayer(host, margin)
          }
          const e = host.spawnEnemy(wd.kind, x, y)
          if (e) wd.trackers.push({ genId: e.genId, alive: true })
        }
      }

      if (wd.type === 'swarm') {
        wd.timer++
        if (wd.timer > 10) wd.timer = 0
      }

      if (wd.spawnCount <= 0) {
        let running = false
        for (const t of wd.trackers) {
          if (host.isEnemyAlive(t.genId)) {
            running = true
            break
          }
        }
        if (!running) wd.type = 'unused'
      }
    }
  }
}
