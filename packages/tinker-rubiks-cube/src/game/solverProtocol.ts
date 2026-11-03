import type { CubeState, Move } from './model'

export type SolverRequest =
  { type: 'prepare' } | { type: 'solve'; id: number; state: CubeState }

export type SolverResponse =
  | { type: 'prepared' }
  | { type: 'solved'; id: number; moves: Move[] | null }
  | { type: 'error'; id?: number; message: string }
