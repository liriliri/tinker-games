import contain from 'licia/contain'
import isArr from 'licia/isArr'
import isFinite from 'licia/isFinite'
import isNum from 'licia/isNum'
import isObj from 'licia/isObj'
import LocalStore from 'licia/LocalStore'
import max from 'licia/max'
import min from 'licia/min'
import {
  CUBE_SIZES,
  type CubeSize,
  type CubeState,
  deserializeColors,
  serializeColors,
} from '../game/model'

const store = new LocalStore('tinker-rubiks-cube')
const RECENT_LIMIT = 25

interface SolveRecord {
  at: number
  time: number
  moves: number
}

interface Stats {
  solves: number
  total: number
  best: number
  worst: number
  recent: SolveRecord[]
}

export interface GameSnapshot {
  state: CubeState
  scrambled: boolean
  elapsed: number
  moves: number
}

interface Prefs {
  order: CubeSize
}

function emptyStats(): Stats {
  return { solves: 0, total: 0, best: 0, worst: 0, recent: [] }
}

function normalizeTime(value: unknown): number {
  return isNum(value) && isFinite(value) && value >= 0 ? value : 0
}

function normalizeRecord(value: unknown): SolveRecord | null {
  if (!isObj(value)) return null
  const rec = value as Record<string, unknown>
  if (!isNum(rec.at) || !isFinite(rec.at)) return null
  const time = normalizeTime(rec.time)
  if (!(time > 0)) return null
  return { at: rec.at, time, moves: normalizeTime(rec.moves) }
}

function normalizeStats(value: unknown): Stats {
  if (!isObj(value)) return emptyStats()
  const raw = value as Record<string, unknown>
  const recent: SolveRecord[] = []
  if (isArr(raw.recent)) {
    for (const item of raw.recent) {
      const rec = normalizeRecord(item)
      if (rec) recent.push(rec)
    }
  }
  return {
    solves: normalizeTime(raw.solves),
    total: normalizeTime(raw.total),
    best: normalizeTime(raw.best),
    worst: normalizeTime(raw.worst),
    recent: recent.sort((a, b) => b.at - a.at).slice(0, RECENT_LIMIT),
  }
}

export function loadPrefs(): Prefs {
  const prefs = store.get('prefs') as { order?: number } | undefined
  const order = prefs?.order
  return {
    order: contain(CUBE_SIZES, order) ? (order as CubeSize) : 3,
  }
}

export function savePrefs(prefs: Prefs): void {
  store.set('prefs', prefs)
}

export function loadSnapshot(size: CubeSize): GameSnapshot | null {
  const entry = store.get('game') as Record<string, unknown> | undefined
  if (!entry || !isObj(entry) || entry.colors === undefined) return null

  const snapSize = normalizeTime(entry.size) || size
  if (snapSize !== size) return null

  const state = deserializeColors(size, String(entry.colors))
  if (!state) return null

  return {
    state,
    scrambled: entry.scrambled === true,
    elapsed: normalizeTime(entry.elapsed),
    moves: normalizeTime(entry.moves),
  }
}

export function saveSnapshot(size: CubeSize, snap: GameSnapshot | null): void {
  if (!snap) {
    store.remove('game')
    return
  }
  store.set('game', {
    size,
    colors: serializeColors(snap.state),
    scrambled: snap.scrambled,
    elapsed: Math.round(snap.elapsed),
    moves: snap.moves,
  })
}

function loadStats(): Stats {
  return normalizeStats(store.get('stats'))
}

export function recordSolve(record: SolveRecord): { isRecord: boolean } {
  const prev = loadStats()
  const prevBest = prev.best
  store.set('stats', {
    solves: prev.solves + 1,
    total: prev.total + record.time,
    best: prev.best ? min(prev.best, record.time) : record.time,
    worst: max(prev.worst, record.time),
    recent: [record, ...prev.recent].slice(0, RECENT_LIMIT),
  })
  return { isRecord: !prevBest || record.time < prevBest }
}

export function getBest(): number {
  return loadStats().best
}
