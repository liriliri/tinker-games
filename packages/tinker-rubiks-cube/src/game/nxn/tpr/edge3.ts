import { EdgeCube } from './edgeCube'

const N_SYM = 1538
export const N_RAW = 20160
const N_EPRUN = N_SYM * N_RAW
const MAX_DEPTH = 10

const eprun = new Int32Array(N_EPRUN / 16)
const sym2raw = new Int32Array(N_SYM)
const symstate = new Uint8Array(N_SYM)
export const raw2sym = new Int32Array(11880)
const syminv = [0, 1, 6, 3, 4, 5, 2, 7]

const mvrot = new Int32Array(20 * 8 * 12)
const mvroto = new Int32Array(20 * 8 * 12)

const factX = [
  1, 1, 1, 3, 12, 60, 360, 2520, 20160, 181440, 1814400, 19958400, 239500800,
]

const MASK64 = (1n << 64n) - 1n
const VAL_INIT = 0xba9876543210n
const VAL_STEP = 0x111111111110n

/** Java Edge3 64-bit get/set (IS_64BIT_PLATFORM). */
function decodePerm(ep: Int32Array, end: number): number {
  let idx = 0
  let val = VAL_INIT
  for (let i = 0; i < end; i++) {
    const v = BigInt(ep[i] << 2)
    idx *= 12 - i
    idx += Number((val >> v) & 0xfn)
    val = BigInt.asIntN(64, val - (VAL_STEP << v))
  }
  return idx
}

function encodePerm(edge: Int32Array, idx: number): void {
  let val = VAL_INIT
  let parity = 0
  for (let i = 0; i < 11; i++) {
    const p = factX[11 - i]
    let v = Math.floor(idx / p)
    idx = idx % p
    parity ^= v
    const sh = BigInt(v << 2)
    edge[i] = Number((val >> sh) & 0xfn)
    const m = (1n << sh) - 1n
    const notM = ~m & MASK64
    val = BigInt.asIntN(64, (val & m) + ((val >> 4n) & notM))
  }
  if ((parity & 1) === 0) {
    edge[11] = Number(val)
  } else {
    edge[11] = edge[10]
    edge[10] = Number(val)
  }
}

let done = 0

export function initEdge3Mvrot(): void {
  const e = new Edge3()
  for (let m = 0; m < 20; m++) {
    for (let r = 0; r < 8; r++) {
      e.setIdx(0)
      e.move(m)
      e.rotate(r)
      for (let i = 0; i < 12; i++) {
        mvrot[((m << 3) | r) * 12 + i] = e.edge[i]
      }
      e.std()
      for (let i = 0; i < 12; i++) {
        mvroto[((m << 3) | r) * 12 + i] = e.temp![i]
      }
    }
  }
}

export function initEdge3Raw2Sym(): void {
  const e = new Edge3()
  const occ = new Uint8Array(11880 / 8)
  let count = 0
  for (let i = 0; i < 11880; i++) {
    if ((occ[i >>> 3] & (1 << (i & 7))) === 0) {
      e.setIdx(i * factX[8])
      for (let j = 0; j < 8; j++) {
        const idx = e.get(4)
        if (idx === i) {
          symstate[count] |= 1 << j
        }
        occ[idx >> 3] |= 1 << (idx & 7)
        raw2sym[idx] = (count << 3) | syminv[j]
        e.rot(0)
        if (j % 2 === 1) {
          e.rot(1)
          e.rot(2)
        }
      }
      sym2raw[count++] = i
    }
  }
  if (count !== 1538) {
    throw new Error(`initEdge3Raw2Sym: expected 1538 sym classes, got ${count}`)
  }
}

function setPruning(table: Int32Array, index: number, value: number): void {
  table[index >> 4] ^= (0x3 ^ value) << ((index & 0xf) << 1)
}

function getPruning(table: Int32Array, index: number): number {
  return (table[index >> 4] >> ((index & 0xf) << 1)) & 0x3
}

export function getprun(edge: number, prun?: number): number {
  if (prun === undefined) {
    let depth = 0
    let depm3 = getPruning(eprun, edge)
    if (depm3 === 0x3) return MAX_DEPTH
    const e = new Edge3()
    while (edge !== 0) {
      if (depm3 === 0) depm3 = 2
      else depm3--

      const symcord1 = Math.floor(edge / N_RAW)
      const cord1 = sym2raw[symcord1]
      const cord2 = edge % N_RAW
      e.setIdx(cord1 * N_RAW + cord2)

      for (let m = 0; m < 17; m++) {
        const cord1x = getmvrot(e.edge, m << 3, 4)
        let symcord1x = raw2sym[cord1x]
        const symx = symcord1x & 0x7
        symcord1x >>= 3
        const cord2x = getmvrot(e.edge, (m << 3) | symx, 10) % N_RAW
        const idx = symcord1x * N_RAW + cord2x
        if (getPruning(eprun, idx) === depm3) {
          depth++
          edge = idx
          break
        }
      }
    }
    return depth
  }
  const depm3 = getPruning(eprun, edge)
  if (depm3 === 0x3) return MAX_DEPTH
  return ((depm3 - prun + 16) % 3) + prun - 1
}

export function createEdge3Prun(): void {
  const e = new Edge3()
  const f = new Edge3()
  const g = new Edge3()

  eprun.fill(-1)
  let depth = 0
  done = 1
  setPruning(eprun, 0, 0)

  while (done !== N_EPRUN) {
    const inv = depth > 9
    const depm3 = depth % 3
    const dep1m3 = (depth + 1) % 3
    const find = inv ? 0x3 : depm3
    const chk = inv ? depm3 : 0x3

    if (depth >= MAX_DEPTH - 1) break

    for (let i_ = 0; i_ < N_EPRUN; i_ += 16) {
      let val = eprun[i_ >> 4]
      if (!inv && val === -1) continue
      for (let i = i_, end = i_ + 16; i < end; i++, val >>= 2) {
        if ((val & 0x3) !== find) continue
        const symcord1 = Math.floor(i / N_RAW)
        const cord1 = sym2raw[symcord1]
        const cord2 = i % N_RAW
        e.setIdx(cord1 * N_RAW + cord2)

        for (let m = 0; m < 17; m++) {
          const cord1x = getmvrot(e.edge, m << 3, 4)
          let symcord1x = raw2sym[cord1x]
          const symx = symcord1x & 0x7
          symcord1x >>= 3
          const cord2x = getmvrot(e.edge, (m << 3) | symx, 10) % N_RAW
          const idx = symcord1x * N_RAW + cord2x
          if (getPruning(eprun, idx) !== chk) continue
          setPruning(eprun, inv ? i : idx, dep1m3)
          done++
          if (inv) break
          let symState = symstate[symcord1x]
          if (symState === 1) continue
          f.setFrom(e)
          f.move(m)
          f.rotate(symx)
          for (let j = 1; (symState >>= 1); j++) {
            if ((symState & 1) !== 1) continue
            g.setFrom(f)
            g.rotate(j)
            const idxx = symcord1x * N_RAW + (g.get(10) % N_RAW)
            if (getPruning(eprun, idxx) === chk) {
              setPruning(eprun, idxx, dep1m3)
              done++
            }
          }
        }
      }
    }
    depth++
  }
}

const FullEdgeMap = [0, 2, 4, 6, 1, 3, 7, 5, 8, 9, 10, 11]

export function getmvrot(ep: Int32Array, mrIdx: number, end: number): number {
  const movo = mvroto.subarray(mrIdx * 12, mrIdx * 12 + 12)
  const mov = mvrot.subarray(mrIdx * 12, mrIdx * 12 + 12)
  const buf = new Int32Array(end)
  for (let i = 0; i < end; i++) {
    buf[i] = movo[ep[mov[i]]]
  }
  return decodePerm(buf, end)
}

export class Edge3 {
  edge = new Int32Array(12)
  edgeo = new Int32Array(12)
  temp: Int32Array | null = null
  isStd = true

  getsym(): number {
    const cord1x = this.get(4)
    let symcord1x = raw2sym[cord1x]
    const symx = symcord1x & 0x7
    symcord1x >>= 3
    this.rotate(symx)
    const cord2x = this.get(10) % N_RAW
    return symcord1x * N_RAW + cord2x
  }

  setFromEdgeCube(c: EdgeCube): number {
    if (this.temp === null) this.temp = new Int32Array(12)
    for (let i = 0; i < 12; i++) {
      this.temp[i] = i
      this.edge[i] = c.ep[FullEdgeMap[i] + 12] % 12
    }
    let parity = 1
    for (let i = 0; i < 12; i++) {
      while (this.edge[i] !== i) {
        const t = this.edge[i]
        this.edge[i] = this.edge[t]
        this.edge[t] = t
        const s = this.temp[i]
        this.temp[i] = this.temp[t]
        this.temp[t] = s
        parity ^= 1
      }
    }
    for (let i = 0; i < 12; i++) {
      this.edge[i] = this.temp[c.ep[FullEdgeMap[i]] % 12]
      this.edgeo[i] = i
    }
    this.isStd = true
    return parity
  }

  setFrom(e: Edge3): void {
    this.edge.set(e.edge)
    this.edgeo.set(e.edgeo)
    this.isStd = e.isStd
  }

  setIdx(idx: number): void {
    encodePerm(this.edge, idx)
    for (let i = 0; i < 12; i++) {
      this.edgeo[i] = i
    }
    this.isStd = true
  }

  std(): void {
    if (this.temp === null) this.temp = new Int32Array(12)
    for (let i = 0; i < 12; i++) {
      this.temp[this.edgeo[i]] = i
    }
    for (let i = 0; i < 12; i++) {
      this.edge[i] = this.temp[this.edge[i]]
      this.edgeo[i] = i
    }
    this.isStd = true
  }

  get(end: number): number {
    if (!this.isStd) this.std()
    return decodePerm(this.edge, end)
  }

  move(i: number): void {
    this.isStd = false
    switch (i) {
      case 0:
        this.circle(this.edge, 0, 4, 1, 5)
        this.circle(this.edgeo, 0, 4, 1, 5)
        break
      case 1:
        this.swap4(this.edge, 0, 4, 1, 5)
        this.swap4(this.edgeo, 0, 4, 1, 5)
        break
      case 2:
        this.circle(this.edge, 0, 5, 1, 4)
        this.circle(this.edgeo, 0, 5, 1, 4)
        break
      case 3:
        this.swap4(this.edge, 5, 10, 6, 11)
        this.swap4(this.edgeo, 5, 10, 6, 11)
        break
      case 4:
        this.circle(this.edge, 0, 11, 3, 8)
        this.circle(this.edgeo, 0, 11, 3, 8)
        break
      case 5:
        this.swap4(this.edge, 0, 11, 3, 8)
        this.swap4(this.edgeo, 0, 11, 3, 8)
        break
      case 6:
        this.circle(this.edge, 0, 8, 3, 11)
        this.circle(this.edgeo, 0, 8, 3, 11)
        break
      case 7:
        this.circle(this.edge, 2, 7, 3, 6)
        this.circle(this.edgeo, 2, 7, 3, 6)
        break
      case 8:
        this.swap4(this.edge, 2, 7, 3, 6)
        this.swap4(this.edgeo, 2, 7, 3, 6)
        break
      case 9:
        this.circle(this.edge, 2, 6, 3, 7)
        this.circle(this.edgeo, 2, 6, 3, 7)
        break
      case 10:
        this.swap4(this.edge, 4, 8, 7, 9)
        this.swap4(this.edgeo, 4, 8, 7, 9)
        break
      case 11:
        this.circle(this.edge, 1, 9, 2, 10)
        this.circle(this.edgeo, 1, 9, 2, 10)
        break
      case 12:
        this.swap4(this.edge, 1, 9, 2, 10)
        this.swap4(this.edgeo, 1, 9, 2, 10)
        break
      case 13:
        this.circle(this.edge, 1, 10, 2, 9)
        this.circle(this.edgeo, 1, 10, 2, 9)
        break
      case 14:
        this.swap4(this.edge, 0, 4, 1, 5)
        this.swap4(this.edgeo, 0, 4, 1, 5)
        this.swap2(this.edge, 9, 11)
        this.swap2(this.edgeo, 8, 10)
        break
      case 15:
        this.swap4(this.edge, 5, 10, 6, 11)
        this.swap4(this.edgeo, 5, 10, 6, 11)
        this.swap2(this.edge, 1, 3)
        this.swap2(this.edgeo, 0, 2)
        break
      case 16:
        this.swap4(this.edge, 0, 11, 3, 8)
        this.swap4(this.edgeo, 0, 11, 3, 8)
        this.swap2(this.edge, 5, 7)
        this.swap2(this.edgeo, 4, 6)
        break
      case 17:
        this.swap4(this.edge, 2, 7, 3, 6)
        this.swap4(this.edgeo, 2, 7, 3, 6)
        this.swap2(this.edge, 8, 10)
        this.swap2(this.edgeo, 9, 11)
        break
      case 18:
        this.swap4(this.edge, 4, 8, 7, 9)
        this.swap4(this.edgeo, 4, 8, 7, 9)
        this.swap2(this.edge, 0, 2)
        this.swap2(this.edgeo, 1, 3)
        break
      case 19:
        this.swap4(this.edge, 1, 9, 2, 10)
        this.swap4(this.edgeo, 1, 9, 2, 10)
        this.swap2(this.edge, 4, 6)
        this.swap2(this.edgeo, 5, 7)
        break
    }
  }

  rot(r: number): void {
    this.isStd = false
    switch (r) {
      case 0:
        this.move(14)
        this.move(17)
        break
      case 1:
        this.circlex(11, 5, 10, 6)
        this.circlex(5, 10, 6, 11)
        this.circlex(1, 2, 3, 0)
        this.circlex(4, 9, 7, 8)
        this.circlex(8, 4, 9, 7)
        this.circlex(0, 1, 2, 3)
        break
      case 2:
        this.swapx(4, 5)
        this.swapx(5, 4)
        this.swapx(11, 8)
        this.swapx(8, 11)
        this.swapx(7, 6)
        this.swapx(6, 7)
        this.swapx(9, 10)
        this.swapx(10, 9)
        this.swapx(1, 1)
        this.swapx(0, 0)
        this.swapx(3, 3)
        this.swapx(2, 2)
        break
    }
  }

  rotate(r: number): void {
    while (r >= 2) {
      r -= 2
      this.rot(1)
      this.rot(2)
    }
    if (r !== 0) this.rot(0)
  }

  circle(arr: Int32Array, a: number, b: number, c: number, d: number): void {
    const temp = arr[d]
    arr[d] = arr[c]
    arr[c] = arr[b]
    arr[b] = arr[a]
    arr[a] = temp
  }

  swap4(arr: Int32Array, a: number, b: number, c: number, d: number): void {
    let temp = arr[a]
    arr[a] = arr[c]
    arr[c] = temp
    temp = arr[b]
    arr[b] = arr[d]
    arr[d] = temp
  }

  swap2(arr: Int32Array, x: number, y: number): void {
    const temp = arr[x]
    arr[x] = arr[y]
    arr[y] = temp
  }

  swapx(x: number, y: number): void {
    const temp = this.edge[x]
    this.edge[x] = this.edgeo[y]
    this.edgeo[y] = temp
  }

  circlex(a: number, b: number, c: number, d: number): void {
    const temp = this.edgeo[d]
    this.edgeo[d] = this.edge[c]
    this.edge[c] = this.edgeo[b]
    this.edgeo[b] = this.edge[a]
    this.edge[a] = temp
  }

  set(src: Edge3 | EdgeCube | number): number | void {
    if (typeof src === 'number') {
      this.setIdx(src)
      return
    }
    if (src instanceof EdgeCube) {
      return this.setFromEdgeCube(src)
    }
    this.setFrom(src)
  }
}
