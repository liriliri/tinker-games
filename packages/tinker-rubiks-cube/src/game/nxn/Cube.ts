import cloneDeep from 'licia/cloneDeep'
import trim from 'licia/trim'
import { AxisMoves, CornerMap, EdgeMap, FACE_COUNT, Faces } from './constants'
import type { FaceId, FaceMove, PieceLookup, TurnCallback } from './types'

export class Cube {
  size: number
  matrix: number[][][]
  onTurn: TurnCallback | null = null

  constructor(size = 3) {
    this.size = size
    this.matrix = []
    for (let i = 0; i < FACE_COUNT; i++) {
      this.matrix[i] = []
      for (let y = 0; y < this.size; y++) {
        this.matrix[i][y] = []
        for (let x = 0; x < this.size; x++) this.matrix[i][y][x] = i
      }
    }
  }

  isSolved(): boolean {
    for (let i = 0; i < FACE_COUNT; i++) {
      const color = this.matrix[i][0][0]
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          if (this.matrix[i][y][x] !== color) return false
        }
      }
    }
    return true
  }

  copy(): number[][][] {
    return cloneDeep(this.matrix)
  }

  turnFace(face: FaceId, dist = 1): void {
    const array = this.matrix[face]
    const old = cloneDeep(array)
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let nx: number
        let ny: number
        if (dist === 1) {
          nx = this.size - 1 - y
          ny = x
        } else if (dist === 2) {
          nx = this.size - 1 - x
          ny = this.size - 1 - y
        } else if (dist === 3) {
          nx = y
          ny = this.size - 1 - x
        } else {
          continue
        }
        array[ny][nx] = old[y][x]
      }
    }
  }

  turnRight(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Right, dist)
    if (layer === this.size) this.turnFace(Faces.Left, (4 - dist) % 4)
    const faceList = [Faces.Front, Faces.Top, Faces.Back, Faces.Bottom]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const x = this.size - layer + i
        for (let y = 0; y < this.size; y++) {
          let tx = x
          let ty = y
          let fx = x
          let fy = y
          if (to === Faces.Back) {
            tx = this.size - 1 - x
            ty = this.size - 1 - y
          }
          if (from === Faces.Back) {
            fx = this.size - 1 - x
            fy = this.size - 1 - y
          }
          this.matrix[to][ty][tx] = old[from][fy][fx]
        }
      }
    }
  }

  turnLeft(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Left, dist)
    if (layer === this.size) this.turnFace(Faces.Right, (4 - dist) % 4)
    const faceList = [Faces.Front, Faces.Bottom, Faces.Back, Faces.Top]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const x = layer - 1 - i
        for (let y = 0; y < this.size; y++) {
          let tx = x
          let ty = y
          let fx = x
          let fy = y
          if (to === Faces.Back) {
            tx = this.size - 1 - x
            ty = this.size - 1 - y
          }
          if (from === Faces.Back) {
            fx = this.size - 1 - x
            fy = this.size - 1 - y
          }
          this.matrix[to][ty][tx] = old[from][fy][fx]
        }
      }
    }
  }

  turnTop(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Top, dist)
    if (layer === this.size) this.turnFace(Faces.Bottom, (4 - dist) % 4)
    const faceList = [Faces.Front, Faces.Left, Faces.Back, Faces.Right]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const y = layer - 1 - i
        for (let x = 0; x < this.size; x++)
          this.matrix[to][y][x] = old[from][y][x]
      }
    }
  }

  turnBottom(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Bottom, dist)
    if (layer === this.size) this.turnFace(Faces.Top, (4 - dist) % 4)
    const faceList = [Faces.Front, Faces.Right, Faces.Back, Faces.Left]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const y = this.size - layer + i
        for (let x = 0; x < this.size; x++)
          this.matrix[to][y][x] = old[from][y][x]
      }
    }
  }

  turnFront(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Front, dist)
    if (layer === this.size) this.turnFace(Faces.Back, (4 - dist) % 4)
    const faceList = [Faces.Left, Faces.Top, Faces.Right, Faces.Bottom]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const x = this.size - layer + i
        for (let y = 0; y < this.size; y++) {
          let tx = x
          let ty = y
          let fx = x
          let fy = y
          if (from === Faces.Left) fy = this.size - 1 - y
          else if (from === Faces.Top) {
            fx = y
            fy = x
          } else if (from === Faces.Right) fx = this.size - 1 - x
          else if (from === Faces.Bottom) {
            fx = this.size - 1 - y
            fy = this.size - 1 - x
          }

          if (to === Faces.Top) {
            tx = y
            ty = x
          } else if (to === Faces.Right) tx = this.size - 1 - x
          else if (to === Faces.Bottom) {
            tx = this.size - 1 - y
            ty = this.size - 1 - x
          } else if (to === Faces.Left) ty = this.size - 1 - y
          this.matrix[to][ty][tx] = old[from][fy][fx]
        }
      }
    }
  }

  turnBack(dist: number, layer: number, width: number): void {
    if (layer - width === 0) this.turnFace(Faces.Back, dist)
    if (layer === this.size) this.turnFace(Faces.Front, (4 - dist) % 4)
    const faceList = [Faces.Left, Faces.Bottom, Faces.Right, Faces.Top]
    const old = this.copy()
    for (let j = 0; j < faceList.length; j++) {
      const from = faceList[j]
      const to = faceList[(j + dist) % faceList.length]
      for (let i = 0; i < width; i++) {
        const x = layer - 1 - i
        for (let y = 0; y < this.size; y++) {
          let tx = x
          let ty = y
          let fx = x
          let fy = y
          if (from === Faces.Bottom) {
            fx = y
            fy = this.size - 1 - x
          } else if (from === Faces.Right) {
            fx = this.size - 1 - x
            fy = this.size - 1 - y
          } else if (from === Faces.Top) {
            fx = this.size - 1 - y
            fy = x
          }

          if (to === Faces.Bottom) {
            tx = y
            ty = this.size - 1 - x
          } else if (to === Faces.Right) {
            tx = this.size - 1 - x
            ty = this.size - 1 - y
          } else if (to === Faces.Top) {
            tx = this.size - 1 - y
            ty = x
          }
          this.matrix[to][ty][tx] = old[from][fy][fx]
        }
      }
    }
  }

  turn(move: FaceMove | string, dist = 1, layer = 1, width = 1): void {
    dist = ((dist % 4) + 4) % 4
    if (dist === 0) return
    switch (move) {
      case 'F':
        this.turnFront(dist, layer, width)
        break
      case 'B':
        this.turnBack(dist, layer, width)
        break
      case 'U':
        this.turnTop(dist, layer, width)
        break
      case 'D':
        this.turnBottom(dist, layer, width)
        break
      case 'L':
        this.turnLeft(dist, layer, width)
        break
      case 'R':
        this.turnRight(dist, layer, width)
        break
    }
    this.onTurn?.(move as FaceMove, dist, layer, width)
  }

  parse(text: string): void {
    const list = text.split(' ')
    for (let t of list) {
      t = trim(t)
      if (!t) continue
      let dist = 1
      const last = t[t.length - 1]
      if (last === "'") {
        dist = 3
        t = t.slice(0, -1)
      } else if (last === '2') {
        dist = 2
        t = t.slice(0, -1)
      }
      let move: string = t[t.length - 1]
      t = t.slice(0, -1)
      let layer: number
      let width: number
      if (move in AxisMoves) {
        move = AxisMoves[move]
        width = layer = this.size
      } else {
        const items = t.split(':')
        layer = parseInt(items.pop()!) || 1
        width = parseInt(items.pop()!) || 1
      }
      this.turn(move as FaceMove, dist, layer, width)
    }
  }

  getEdge(a: FaceId, b: FaceId): PieceLookup {
    const coordA = EdgeMap[a]?.[b]!
    const coordB = EdgeMap[b]?.[a]!
    return {
      c2f: {
        [this.matrix[a][coordA[1]][coordA[0]]]: a,
        [this.matrix[b][coordB[1]][coordB[0]]]: b,
      },
      f2c: {
        [a]: this.matrix[a][coordA[1]][coordA[0]],
        [b]: this.matrix[b][coordB[1]][coordB[0]],
      },
    }
  }

  getCorner(a: FaceId, b: FaceId, c: FaceId): PieceLookup {
    let fa = a
    let fb = b
    let fc = c
    if (fa !== Faces.Front && fa !== Faces.Back) {
      if (fb === Faces.Front || fb === Faces.Back) {
        ;[fa, fb] = [fb, fa]
      } else {
        ;[fa, fc] = [fc, fa]
      }
    }
    if (fb !== Faces.Top && fb !== Faces.Bottom) [fb, fc] = [fc, fb]
    const corner = CornerMap[`${fa},${fb},${fc}`]
    const [cA, cB, cC] = corner
    return {
      c2f: {
        [this.matrix[fa][cA[1]][cA[0]]]: fa,
        [this.matrix[fb][cB[1]][cB[0]]]: fb,
        [this.matrix[fc][cC[1]][cC[0]]]: fc,
      },
      f2c: {
        [fa]: this.matrix[fa][cA[1]][cA[0]],
        [fb]: this.matrix[fb][cB[1]][cB[0]],
        [fc]: this.matrix[fc][cC[1]][cC[0]],
      },
    }
  }

  getCenterColor(face: FaceId): number {
    return this.matrix[face][Math.floor(this.size / 2)][
      Math.floor(this.size / 2)
    ]
  }

  turnToText(
    move: FaceMove | string,
    dist: number,
    layer: number,
    width: number,
  ): string {
    let out = move
    if (layer === width && width === this.size) {
      if (move === 'F' || move === 'B') out = 'z'
      else if (move === 'R' || move === 'L') out = 'x'
      else if (move === 'U' || move === 'D') out = 'y'
    } else if (layer > 1) out = layer + out
    if (width > 1 && width < this.size) out = `${width}:${out}`
    if (dist === 3 || dist === -1) out += "'"
    else if (dist === 2) out += '2'
    return out
  }
}
