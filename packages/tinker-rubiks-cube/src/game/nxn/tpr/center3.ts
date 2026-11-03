import { Cnk, swap } from './util'
import { CenterCube } from './centerCube'

export const ctmove = new Uint16Array(35 * 35 * 12 * 2 * 20)
export const prun = new Int8Array(35 * 35 * 12 * 2)

const pmove = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]

const rl2std = [0, 9, 14, 23, 27, 28, 41, 42, 46, 55, 60, 69]
const std2rl = new Int32Array(70)

export class Center3 {
  ud = new Int32Array(8)
  rl = new Int32Array(8)
  fb = new Int32Array(8)
  parity = 0

  set(c: CenterCube, eXc_parity: number): void {
    const par =
      Number(c.ct[0] % 3 > c.ct[8] % 3) ^
      Number(c.ct[8] % 3 > c.ct[16] % 3) ^
      Number(c.ct[0] % 3 > c.ct[16] % 3)
        ? 0
        : 1
    for (let i = 0; i < 8; i++) {
      this.ud[i] = (Math.floor(c.ct[i] / 3) ^ 1) >>> 0
      this.fb[i] = (Math.floor(c.ct[i + 8] / 3) ^ 1) >>> 0
      this.rl[i] = (Math.floor(c.ct[i + 16] / 3) ^ 1 ^ par) >>> 0
    }
    this.parity = par ^ eXc_parity
  }

  getct(): number {
    let idx = 0
    let r = 4
    for (let i = 6; i >= 0; i--) {
      if (this.ud[i] !== this.ud[7]) {
        idx += Cnk[i][r--]
      }
    }
    idx *= 35
    r = 4
    for (let i = 6; i >= 0; i--) {
      if (this.fb[i] !== this.fb[7]) {
        idx += Cnk[i][r--]
      }
    }
    idx *= 12
    const check = this.fb[7] ^ this.ud[7]
    let idxrl = 0
    r = 4
    for (let i = 7; i >= 0; i--) {
      if (this.rl[i] !== check) {
        idxrl += Cnk[i][r--]
      }
    }
    return this.parity + 2 * (idx + std2rl[idxrl])
  }

  setct(idx: number): void {
    this.parity = idx & 1
    idx >>>= 1
    let idxrl = rl2std[idx % 12]
    idx = Math.floor(idx / 12)
    let r = 4
    for (let i = 7; i >= 0; i--) {
      this.rl[i] = 0
      if (idxrl >= Cnk[i][r]) {
        idxrl -= Cnk[i][r--]
        this.rl[i] = 1
      }
    }
    let idxfb = idx % 35
    idx = Math.floor(idx / 35)
    r = 4
    this.fb[7] = 0
    for (let i = 6; i >= 0; i--) {
      if (idxfb >= Cnk[i][r]) {
        idxfb -= Cnk[i][r--]
        this.fb[i] = 1
      } else {
        this.fb[i] = 0
      }
    }
    r = 4
    this.ud[7] = 0
    for (let i = 6; i >= 0; i--) {
      if (idx >= Cnk[i][r]) {
        idx -= Cnk[i][r--]
        this.ud[i] = 1
      } else {
        this.ud[i] = 0
      }
    }
  }

  move(i: number): void {
    this.parity ^= pmove[i]
    switch (i) {
      case 0:
      case 1:
      case 2:
        swap(this.ud, 0, 1, 2, 3, i % 3)
        break
      case 3:
        swap(this.rl, 0, 1, 2, 3, 1)
        break
      case 4:
      case 5:
      case 6:
        swap(this.fb, 0, 1, 2, 3, (i - 1) % 3)
        break
      case 7:
      case 8:
      case 9:
        swap(this.ud, 4, 5, 6, 7, (i - 1) % 3)
        break
      case 10:
        swap(this.rl, 4, 5, 6, 7, 1)
        break
      case 11:
      case 12:
      case 13:
        swap(this.fb, 4, 5, 6, 7, (i + 1) % 3)
        break
      case 14:
        swap(this.ud, 0, 1, 2, 3, 1)
        swap(this.rl, 0, 5, 4, 1, 1)
        swap(this.fb, 0, 5, 4, 1, 1)
        break
      case 15:
        swap(this.rl, 0, 1, 2, 3, 1)
        swap(this.fb, 1, 4, 7, 2, 1)
        swap(this.ud, 1, 6, 5, 2, 1)
        break
      case 16:
        swap(this.fb, 0, 1, 2, 3, 1)
        swap(this.ud, 3, 2, 5, 4, 1)
        swap(this.rl, 0, 3, 6, 5, 1)
        break
      case 17:
        swap(this.ud, 4, 5, 6, 7, 1)
        swap(this.rl, 3, 2, 7, 6, 1)
        swap(this.fb, 3, 2, 7, 6, 1)
        break
      case 18:
        swap(this.rl, 4, 5, 6, 7, 1)
        swap(this.fb, 0, 3, 6, 5, 1)
        swap(this.ud, 0, 3, 4, 7, 1)
        break
      case 19:
        swap(this.fb, 4, 5, 6, 7, 1)
        swap(this.ud, 0, 7, 6, 1, 1)
        swap(this.rl, 1, 4, 7, 2, 1)
        break
    }
  }
}

export function initCenter3(): void {
  for (let i = 0; i < 12; i++) {
    std2rl[rl2std[i]] = i
  }

  const c = new Center3()
  const n = 35 * 35 * 12 * 2
  for (let i = 0; i < n; i++) {
    for (let m = 0; m < 20; m++) {
      c.setct(i)
      c.move(m)
      ctmove[i * 20 + m] = c.getct()
    }
  }

  prun.fill(-1)
  prun[0] = 0
  let depth = 0
  let done = 1
  while (done !== 29400) {
    for (let i = 0; i < 29400; i++) {
      if (prun[i] !== depth) continue
      for (let m = 0; m < 17; m++) {
        const next = ctmove[i * 20 + m]
        if (prun[next] === -1) {
          prun[next] = depth + 1
          done++
        }
      }
    }
    depth++
  }
}
