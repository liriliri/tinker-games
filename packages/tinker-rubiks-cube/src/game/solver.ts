import type { CubeState, Move } from './model'
import type { SolverRequest, SolverResponse } from './solverProtocol'

type PendingSolve = {
  resolve: (moves: Move[] | null) => void
  reject: (err: Error) => void
}

let worker: Worker | null = null
let preparePromise: Promise<void> | null = null
let prepareResolve: (() => void) | null = null
let prepareReject: ((err: Error) => void) | null = null
let nextSolveId = 1
const pendingSolves = new Map<number, PendingSolve>()

function failPending(err: Error): void {
  if (prepareReject) {
    prepareReject(err)
    prepareResolve = null
    prepareReject = null
    preparePromise = null
  }
  pendingSolves.forEach((pending) => pending.reject(err))
  pendingSolves.clear()
}

function handleResponse(msg: SolverResponse): void {
  if (msg.type === 'prepared') {
    prepareResolve?.()
    prepareResolve = null
    prepareReject = null
    return
  }
  if (msg.type === 'solved') {
    const pending = pendingSolves.get(msg.id)
    if (!pending) return
    pendingSolves.delete(msg.id)
    pending.resolve(msg.moves)
    return
  }
  const err = new Error(msg.message)
  if (msg.id !== undefined) {
    const pending = pendingSolves.get(msg.id)
    if (pending) {
      pendingSolves.delete(msg.id)
      pending.reject(err)
      return
    }
  }
  failPending(err)
}

function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./solver.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.onmessage = (ev: MessageEvent<SolverResponse>) => {
    handleResponse(ev.data)
  }
  worker.onerror = (ev) => {
    worker = null
    failPending(new Error(ev.message || 'Solver worker failed'))
  }
  return worker
}

function post(msg: SolverRequest): void {
  getWorker().postMessage(msg)
}

/** Starts (or reuses) background init of 3×3 + 4×4 tables in the worker. */
export function prepareSolver(): Promise<void> {
  if (!preparePromise) {
    preparePromise = new Promise<void>((resolve, reject) => {
      prepareResolve = resolve
      prepareReject = reject
      post({ type: 'prepare' })
    }).catch((err: unknown) => {
      preparePromise = null
      throw err
    })
  }
  return preparePromise
}

export async function findSolution(state: CubeState): Promise<Move[] | null> {
  try {
    await prepareSolver()
    return await new Promise<Move[] | null>((resolve, reject) => {
      const id = nextSolveId++
      pendingSolves.set(id, { resolve, reject })
      post({ type: 'solve', id, state })
    })
  } catch {
    return null
  }
}
