export type FaceId = number

export type FaceMove = 'F' | 'B' | 'U' | 'D' | 'L' | 'R'

export type TurnCallback = (
  move: FaceMove,
  dist: number,
  layer: number,
  width: number,
) => void

export interface RawMove {
  move: FaceMove
  dist: number
  layer: number
  width: number
  n: number
}

export type Rel2Abs = Record<FaceMove, FaceMove>

export interface PieceLookup {
  c2f: Record<number, FaceId>
  f2c: Record<FaceId, number>
}
