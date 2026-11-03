import { move2std } from './moves'
import { Cnk, swap } from './util'
import { CenterCube } from './centerCube'

export const rlmv = new Int32Array(70 * 28)
export const ctmv = new Uint16Array(6435 * 28)
export const ctprun = new Int8Array(6435 * 35 * 2)

const pmv = new Int32Array([
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0,
  0, 0, 0, 0, 1, 0, 1, 0, 0, 0,
])

export class Center2 {
  rl = new Int32Array(8)
  ct = new Int32Array(16)
  parity = 0

  set(c: CenterCube, edgeParity: number): void {
    for (let i = 0; i < 16; i++) {
      this.ct[i] = c.ct[i] % 3
    }
    for (let i = 0; i < 8; i++) {
      this.rl[i] = c.ct[i + 16]
    }
    this.parity = edgeParity
  }

  getrl(): number {
    let idx = 0
    let r = 4
    for (let i = 6; i >= 0; i--) {
      if (this.rl[i] !== this.rl[7]) {
        idx += Cnk[i][r--]
      }
    }
    return idx * 2 + this.parity
  }

  setrl(idx: number): void {
    this.parity = idx & 1
    idx >>>= 1
    let r = 4
    this.rl[7] = 0
    for (let i = 6; i >= 0; i--) {
      if (idx >= Cnk[i][r]) {
        idx -= Cnk[i][r--]
        this.rl[i] = 1
      } else {
        this.rl[i] = 0
      }
    }
  }

  getct(): number {
    let idx = 0
    let r = 8
    for (let i = 14; i >= 0; i--) {
      if (this.ct[i] !== this.ct[15]) {
        idx += Cnk[i][r--]
      }
    }
    return idx
  }

  setct(idx: number): void {
    let r = 8
    this.ct[15] = 0
    for (let i = 14; i >= 0; i--) {
      if (idx >= Cnk[i][r]) {
        idx -= Cnk[i][r--]
        this.ct[i] = 1
      } else {
        this.ct[i] = 0
      }
    }
  }

  move(m: number): void {
    this.parity ^= pmv[m]
    const key = m % 3
    m = Math.floor(m / 3)
    switch (m) {
      case 0:
        swap(this.ct, 0, 1, 2, 3, key)
        break
      case 1:
        swap(this.rl, 0, 1, 2, 3, key)
        break
      case 2:
        swap(this.ct, 8, 9, 10, 11, key)
        break
      case 3:
        swap(this.ct, 4, 5, 6, 7, key)
        break
      case 4:
        swap(this.rl, 4, 5, 6, 7, key)
        break
      case 5:
        swap(this.ct, 12, 13, 14, 15, key)
        break
      case 6:
        swap(this.ct, 0, 1, 2, 3, key)
        swap(this.rl, 0, 5, 4, 1, key)
        swap(this.ct, 8, 9, 12, 13, key)
        break
      case 7:
        swap(this.rl, 0, 1, 2, 3, key)
        swap(this.ct, 1, 15, 5, 9, key)
        swap(this.ct, 2, 12, 6, 10, key)
        break
      case 8:
        swap(this.ct, 8, 9, 10, 11, key)
        swap(this.rl, 0, 3, 6, 5, key)
        swap(this.ct, 3, 2, 5, 4, key)
        break
      case 9:
        swap(this.ct, 4, 5, 6, 7, key)
        swap(this.rl, 3, 2, 7, 6, key)
        swap(this.ct, 11, 10, 15, 14, key)
        break
      case 10:
        swap(this.rl, 4, 5, 6, 7, key)
        swap(this.ct, 0, 8, 4, 14, key)
        swap(this.ct, 3, 11, 7, 13, key)
        break
      case 11:
        swap(this.ct, 12, 13, 14, 15, key)
        swap(this.rl, 1, 4, 7, 2, key)
        swap(this.ct, 1, 0, 7, 6, key)
        break
    }
  }
}

export function initCenter2(): void {
  const c = new Center2()

  for (let i = 0; i < 35 * 2; i++) {
    for (let m = 0; m < 28; m++) {
      c.setrl(i)
      c.move(move2std[m])
      rlmv[i * 28 + m] = c.getrl()
    }
  }

  for (let i = 0; i < 6435; i++) {
    for (let m = 0; m < 28; m++) {
      c.setct(i)
      c.move(move2std[m])
      ctmv[i * 28 + m] = c.getct()
    }
  }

  ctprun.fill(-1)
  ctprun[0] = 0
  ctprun[18] = 0
  ctprun[28] = 0
  ctprun[46] = 0
  ctprun[54] = 0
  ctprun[56] = 0
  let depth = 0
  let done = 6
  while (done !== 6435 * 35 * 2) {
    for (let i = 0; i < 6435 * 35 * 2; i++) {
      if (ctprun[i] !== depth) continue
      const ct = Math.floor(i / 70)
      const rl = i % 70
      for (let m = 0; m < 23; m++) {
        const ctx = ctmv[ct * 28 + m]
        const rlx = rlmv[rl * 28 + m]
        const idx = ctx * 70 + rlx
        if (ctprun[idx] === -1) {
          ctprun[idx] = depth + 1
          done++
        }
      }
    }
    depth++
  }
}
