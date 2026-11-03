import { ux1, ux2, ux3, rx1, rx3, lx3, fx1, bx3, dx2, dx3 } from './moves'
import { Cnk, swap, binarySearch } from './util'
import { CenterCube } from './centerCube'

export const ctsmv = new Int32Array(15582 * 36)
const sym2raw = new Int32Array(15582)
export const csprun = new Int8Array(15582)
export const symmult = new Int32Array(48 * 48)
export const symmove = new Int32Array(48 * 36)
const syminv = new Int32Array(48)
export const finish = new Int32Array(48)

let raw2sym: Int32Array | null = null

export function allocRaw2sym(): void {
  raw2sym = new Int32Array(735471)
}

export function clearRaw2sym(): void {
  raw2sym = null
}

export class Center1 {
  ct = new Uint8Array(24)

  constructor(ctOrUrf?: Uint8Array | CenterCube | number, urf?: number) {
    if (ctOrUrf instanceof CenterCube && urf !== undefined) {
      for (let i = 0; i < 24; i++) {
        this.ct[i] = ctOrUrf.ct[i] % 3 === urf ? 1 : 0
      }
      return
    }
    if (ctOrUrf instanceof Uint8Array) {
      this.ct.set(ctOrUrf)
      return
    }
    for (let i = 0; i < 8; i++) {
      this.ct[i] = 1
    }
    for (let i = 8; i < 24; i++) {
      this.ct[i] = 0
    }
  }

  move(m: number): void {
    const key = m % 3
    m = Math.floor(m / 3)
    const ct = this.ct
    switch (m) {
      case 0:
        swap(ct, 0, 1, 2, 3, key)
        break
      case 1:
        swap(ct, 16, 17, 18, 19, key)
        break
      case 2:
        swap(ct, 8, 9, 10, 11, key)
        break
      case 3:
        swap(ct, 4, 5, 6, 7, key)
        break
      case 4:
        swap(ct, 20, 21, 22, 23, key)
        break
      case 5:
        swap(ct, 12, 13, 14, 15, key)
        break
      case 6:
        swap(ct, 0, 1, 2, 3, key)
        swap(ct, 8, 20, 12, 16, key)
        swap(ct, 9, 21, 13, 17, key)
        break
      case 7:
        swap(ct, 16, 17, 18, 19, key)
        swap(ct, 1, 15, 5, 9, key)
        swap(ct, 2, 12, 6, 10, key)
        break
      case 8:
        swap(ct, 8, 9, 10, 11, key)
        swap(ct, 2, 19, 4, 21, key)
        swap(ct, 3, 16, 5, 22, key)
        break
      case 9:
        swap(ct, 4, 5, 6, 7, key)
        swap(ct, 10, 18, 14, 22, key)
        swap(ct, 11, 19, 15, 23, key)
        break
      case 10:
        swap(ct, 20, 21, 22, 23, key)
        swap(ct, 0, 8, 4, 14, key)
        swap(ct, 3, 11, 7, 13, key)
        break
      case 11:
        swap(ct, 12, 13, 14, 15, key)
        swap(ct, 1, 20, 7, 18, key)
        swap(ct, 0, 23, 6, 17, key)
        break
    }
  }

  set(idx: number): void {
    let r = 8
    for (let i = 23; i >= 0; i--) {
      this.ct[i] = 0
      if (idx >= Cnk[i][r]) {
        idx -= Cnk[i][r--]
        this.ct[i] = 1
      }
    }
  }

  get(): number {
    let idx = 0
    let r = 8
    for (let i = 23; i >= 0; i--) {
      if (this.ct[i] === 1) {
        idx += Cnk[i][r--]
      }
    }
    return idx
  }

  getsym(): number {
    if (raw2sym !== null) {
      return raw2sym[this.get()]
    }
    for (let j = 0; j < 48; j++) {
      const cord = Center1.raw2symIndex(this.get())
      if (cord !== -1) return cord * 64 + j
      this.rot(0)
      if (j % 2 === 1) this.rot(1)
      if (j % 8 === 7) this.rot(2)
      if (j % 16 === 15) this.rot(3)
    }
    return -1
  }

  static raw2symIndex(n: number): number {
    const m = binarySearch(sym2raw, n)
    return m >= 0 ? m : -1
  }

  setFrom(c: Center1): void {
    this.ct.set(c.ct)
  }

  rot(r: number): void {
    switch (r) {
      case 0:
        this.move(ux2)
        this.move(dx2)
        break
      case 1:
        this.move(rx1)
        this.move(lx3)
        break
      case 2:
        swap(this.ct, 0, 3, 1, 2, 1)
        swap(this.ct, 8, 11, 9, 10, 1)
        swap(this.ct, 4, 7, 5, 6, 1)
        swap(this.ct, 12, 15, 13, 14, 1)
        swap(this.ct, 16, 19, 21, 22, 1)
        swap(this.ct, 17, 18, 20, 23, 1)
        break
      case 3:
        this.move(ux1)
        this.move(dx3)
        this.move(fx1)
        this.move(bx3)
        break
    }
  }

  rotate(r: number): void {
    for (let j = 0; j < r; j++) {
      this.rot(0)
      if (j % 2 === 1) this.rot(1)
      if (j % 8 === 7) this.rot(2)
      if (j % 16 === 15) this.rot(3)
    }
  }

  equals(c: Center1): boolean {
    for (let i = 0; i < 24; i++) {
      if (this.ct[i] !== c.ct[i]) return false
    }
    return true
  }
}

export function initSym2Raw(): void {
  const c = new Center1()
  const occLen = Math.floor(735471 / 32) + 1
  const occ = new Int32Array(occLen)
  let count = 0
  for (let i = 0; i < 735471; i++) {
    if ((occ[i >>> 5] & (1 << (i & 0x1f))) === 0) {
      c.set(i)
      for (let j = 0; j < 48; j++) {
        const idx = c.get()
        occ[idx >>> 5] |= 1 << (idx & 0x1f)
        if (raw2sym !== null) {
          raw2sym[idx] = (count << 6) | syminv[j]
        }
        c.rot(0)
        if (j % 2 === 1) c.rot(1)
        if (j % 8 === 7) c.rot(2)
        if (j % 16 === 15) c.rot(3)
      }
      sym2raw[count++] = i
    }
  }
  if (count !== 15582) {
    throw new Error(`initSym2Raw: expected 15582 sym classes, got ${count}`)
  }
}

export function createCenter1Prun(): void {
  csprun.fill(-1)
  csprun[0] = 0
  let depth = 0
  let done = 1

  while (done !== 15582) {
    const inv = depth > 4
    const select = inv ? -1 : depth
    const check = inv ? depth : -1
    depth++
    for (let i = 0; i < 15582; i++) {
      if (csprun[i] !== select) continue
      for (let m = 0; m < 27; m++) {
        const idx = ctsmv[i * 36 + m] >>> 6
        if (csprun[idx] !== check) continue
        done++
        if (inv) {
          csprun[i] = depth
          break
        } else {
          csprun[idx] = depth
        }
      }
    }
  }
}

export function createCenter1MoveTable(): void {
  const c = new Center1()
  const d = new Center1()
  for (let i = 0; i < 15582; i++) {
    d.set(sym2raw[i])
    for (let m = 0; m < 36; m++) {
      c.setFrom(d)
      c.move(m)
      ctsmv[i * 36 + m] = c.getsym()
    }
  }
}

export function initCenter1Sym(): void {
  const c = new Center1()
  for (let i = 0; i < 24; i++) {
    c.ct[i] = i
  }
  const d = new Center1(c.ct)
  const e = new Center1(c.ct)
  const f = new Center1(c.ct)

  for (let i = 0; i < 48; i++) {
    for (let j = 0; j < 48; j++) {
      for (let k = 0; k < 48; k++) {
        if (c.equals(d)) {
          symmult[i * 48 + j] = k
          if (k === 0) {
            syminv[i] = j
          }
        }
        d.rot(0)
        if (k % 2 === 1) d.rot(1)
        if (k % 8 === 7) d.rot(2)
        if (k % 16 === 15) d.rot(3)
      }
      c.rot(0)
      if (j % 2 === 1) c.rot(1)
      if (j % 8 === 7) c.rot(2)
      if (j % 16 === 15) c.rot(3)
    }
    c.rot(0)
    if (i % 2 === 1) c.rot(1)
    if (i % 8 === 7) c.rot(2)
    if (i % 16 === 15) c.rot(3)
  }

  for (let i = 0; i < 48; i++) {
    c.setFrom(e)
    c.rotate(syminv[i])
    for (let j = 0; j < 36; j++) {
      d.setFrom(c)
      d.move(j)
      d.rotate(i)
      for (let k = 0; k < 36; k++) {
        f.setFrom(e)
        f.move(k)
        if (f.equals(d)) {
          symmove[i * 36 + j] = k
          break
        }
      }
    }
  }

  c.set(0)
  for (let i = 0; i < 48; i++) {
    finish[syminv[i]] = c.get()
    c.rot(0)
    if (i % 2 === 1) c.rot(1)
    if (i % 8 === 7) c.rot(2)
    if (i % 16 === 15) c.rot(3)
  }
}
