import type { FaceId, FaceMove } from './types'

export const Faces = {
  Front: 0,
  Left: 1,
  Back: 2,
  Right: 3,
  Top: 4,
  Bottom: 5,
  length: 6,
} as const

export const Colors = {
  Green: 0,
  Orange: 1,
  Blue: 2,
  Red: 3,
  Yellow: 4,
  White: 5,
  length: 6,
} as const

export const FACE_COUNT = 6

export const SideFaces: FaceId[] = [
  Faces.Front,
  Faces.Right,
  Faces.Back,
  Faces.Left,
]

export const SideEdges: [FaceId, FaceId][] = [
  [Faces.Left, Faces.Front],
  [Faces.Front, Faces.Right],
  [Faces.Right, Faces.Back],
  [Faces.Back, Faces.Left],
]

export const EdgeMap: Record<
  FaceId,
  Partial<Record<FaceId, [number, number]>>
> = {
  [Faces.Front]: {
    [Faces.Top]: [1, 0],
    [Faces.Bottom]: [1, 2],
    [Faces.Left]: [0, 1],
    [Faces.Right]: [2, 1],
  },
  [Faces.Back]: {
    [Faces.Top]: [1, 0],
    [Faces.Bottom]: [1, 2],
    [Faces.Left]: [2, 1],
    [Faces.Right]: [0, 1],
  },
  [Faces.Right]: {
    [Faces.Top]: [1, 0],
    [Faces.Bottom]: [1, 2],
    [Faces.Front]: [0, 1],
    [Faces.Back]: [2, 1],
  },
  [Faces.Left]: {
    [Faces.Top]: [1, 0],
    [Faces.Bottom]: [1, 2],
    [Faces.Front]: [2, 1],
    [Faces.Back]: [0, 1],
  },
  [Faces.Top]: {
    [Faces.Front]: [1, 2],
    [Faces.Back]: [1, 0],
    [Faces.Left]: [0, 1],
    [Faces.Right]: [2, 1],
  },
  [Faces.Bottom]: {
    [Faces.Front]: [1, 0],
    [Faces.Back]: [1, 2],
    [Faces.Left]: [0, 1],
    [Faces.Right]: [2, 1],
  },
}

export const CornerMap: Record<
  string,
  [[number, number], [number, number], [number, number]]
> = {
  [`${Faces.Front},${Faces.Top},${Faces.Left}`]: [
    [0, 0],
    [0, 2],
    [2, 0],
  ],
  [`${Faces.Front},${Faces.Top},${Faces.Right}`]: [
    [2, 0],
    [2, 2],
    [0, 0],
  ],
  [`${Faces.Front},${Faces.Bottom},${Faces.Left}`]: [
    [0, 2],
    [0, 0],
    [2, 2],
  ],
  [`${Faces.Front},${Faces.Bottom},${Faces.Right}`]: [
    [2, 2],
    [2, 0],
    [0, 2],
  ],
  [`${Faces.Back},${Faces.Top},${Faces.Left}`]: [
    [2, 0],
    [0, 0],
    [0, 0],
  ],
  [`${Faces.Back},${Faces.Top},${Faces.Right}`]: [
    [0, 0],
    [2, 0],
    [2, 0],
  ],
  [`${Faces.Back},${Faces.Bottom},${Faces.Left}`]: [
    [2, 2],
    [0, 2],
    [0, 2],
  ],
  [`${Faces.Back},${Faces.Bottom},${Faces.Right}`]: [
    [0, 2],
    [2, 2],
    [2, 2],
  ],
}

export const AxisMoves: Record<string, FaceMove> = {
  x: 'R',
  y: 'U',
  z: 'F',
}
