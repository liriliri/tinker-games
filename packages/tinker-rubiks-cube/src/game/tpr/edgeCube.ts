import { F, U, L, B, R, D } from './moves'
import { parity, swap } from './util'

const EdgeColor = [
  [F, U],
  [L, U],
  [B, U],
  [R, U],
  [B, D],
  [L, D],
  [F, D],
  [R, D],
  [F, L],
  [B, L],
  [B, R],
  [F, R],
]

import {
  F2,
  L2,
  B2,
  R2,
  B8,
  L8,
  F8,
  R8,
  F4,
  B6,
  B4,
  F6,
  U8,
  U4,
  U2,
  U6,
  D8,
  D4,
  D2,
  D6,
  L6,
  L4,
  R6,
  R4,
} from './moves'

const EdgeMap = [
  F2,
  L2,
  B2,
  R2,
  B8,
  L8,
  F8,
  R8,
  F4,
  B6,
  B4,
  F6,
  U8,
  U4,
  U2,
  U6,
  D8,
  D4,
  D2,
  D6,
  L6,
  L4,
  R6,
  R4,
]

export class EdgeCube {
  ep = new Uint8Array(24)

  constructor() {
    for (let i = 0; i < 24; i++) {
      this.ep[i] = i
    }
  }

  copy(c: EdgeCube): void {
    this.ep.set(c.ep)
  }

  getParity(): number {
    return parity(this.ep)
  }

  fill333Facelet(facelet: string[]): void {
    for (let i = 0; i < 24; i++) {
      facelet[EdgeMap[i]] = 'URFDLB'.charAt(
        EdgeColor[this.ep[i] % 12][Math.floor(this.ep[i] / 12)],
      )
    }
  }

  checkEdge(): boolean {
    let ck = 0
    let par = false
    for (let i = 0; i < 12; i++) {
      ck |= 1 << this.ep[i]
      par = par !== this.ep[i] >= 12
    }
    ck &= ck >> 12
    return ck === 0 && !par
  }

  move(m: number): void {
    const key = m % 3
    m = Math.floor(m / 3)
    const ep = this.ep
    switch (m) {
      case 0:
        swap(ep, 0, 1, 2, 3, key)
        swap(ep, 12, 13, 14, 15, key)
        break
      case 1:
        swap(ep, 11, 15, 10, 19, key)
        swap(ep, 23, 3, 22, 7, key)
        break
      case 2:
        swap(ep, 0, 11, 6, 8, key)
        swap(ep, 12, 23, 18, 20, key)
        break
      case 3:
        swap(ep, 4, 5, 6, 7, key)
        swap(ep, 16, 17, 18, 19, key)
        break
      case 4:
        swap(ep, 1, 20, 5, 21, key)
        swap(ep, 13, 8, 17, 9, key)
        break
      case 5:
        swap(ep, 2, 9, 4, 10, key)
        swap(ep, 14, 21, 16, 22, key)
        break
      case 6:
        swap(ep, 0, 1, 2, 3, key)
        swap(ep, 12, 13, 14, 15, key)
        swap(ep, 9, 22, 11, 20, key)
        break
      case 7:
        swap(ep, 11, 15, 10, 19, key)
        swap(ep, 23, 3, 22, 7, key)
        swap(ep, 2, 16, 6, 12, key)
        break
      case 8:
        swap(ep, 0, 11, 6, 8, key)
        swap(ep, 12, 23, 18, 20, key)
        swap(ep, 3, 19, 5, 13, key)
        break
      case 9:
        swap(ep, 4, 5, 6, 7, key)
        swap(ep, 16, 17, 18, 19, key)
        swap(ep, 8, 23, 10, 21, key)
        break
      case 10:
        swap(ep, 1, 20, 5, 21, key)
        swap(ep, 13, 8, 17, 9, key)
        swap(ep, 14, 0, 18, 4, key)
        break
      case 11:
        swap(ep, 2, 9, 4, 10, key)
        swap(ep, 14, 21, 16, 22, key)
        swap(ep, 7, 15, 1, 17, key)
        break
    }
  }
}
