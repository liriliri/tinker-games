import Cube from 'cubejs'
import fill from 'licia/fill'
import map from 'licia/map'
import max from 'licia/max'
import min from 'licia/min'
import range from 'licia/range'
import sortBy from 'licia/sortBy'
import {
  ckmv2,
  ckmv3,
  move2std,
  move3std,
  skipAxis2,
  skipAxis3,
  fx1,
  bx3,
  ux1,
  dx3,
  initMoves,
} from './moves'
import { tomove, initUtil } from './util'
import { initCornerMove } from './cornerCube'
import {
  csprun,
  ctsmv,
  symmove,
  symmult,
  finish,
  allocRaw2sym,
  clearRaw2sym,
  initCenter1Sym,
  initSym2Raw,
  createCenter1MoveTable,
  createCenter1Prun,
  Center1,
} from './center1'
import { ctprun, ctmv, rlmv, initCenter2, Center2 } from './center2'
import { prun as center3prun, ctmove, initCenter3, Center3 } from './center3'
import {
  getprun,
  getmvrot,
  N_RAW,
  raw2sym as edgeRaw2sym,
  initEdge3Mvrot,
  initEdge3Raw2Sym,
  createEdge3Prun,
  Edge3,
} from './edge3'
import { FullCube } from './fullCube'

const PHASE1_SOLUTIONS = 10000
const PHASE2_ATTEMPTS = 500
const PHASE2_SOLUTIONS = 100
const PHASE3_ATTEMPTS = 100

let inited = false

/** Ascending by value; poll() pops the worst (matches Java max-heap PQ). */
class Phase1Sols {
  private items: FullCube[] = []

  clear(): void {
    this.items.length = 0
  }

  get size(): number {
    return this.items.length
  }

  toArray(): FullCube[] {
    return this.items.slice()
  }

  add(c: FullCube): void {
    let lo = 0
    let hi = this.items.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.items[mid].value <= c.value) lo = mid + 1
      else hi = mid
    }
    this.items.splice(lo, 0, c)
  }

  poll(): FullCube {
    return this.items.pop()!
  }
}

export function initTpr(): void {
  if (inited) return
  Cube.initSolver()
  initUtil()
  initMoves()
  initCornerMove()

  initCenter1Sym()
  allocRaw2sym()
  initSym2Raw()
  createCenter1MoveTable()
  clearRaw2sym()
  createCenter1Prun()

  initCenter2()
  initCenter3()

  initEdge3Mvrot()
  initEdge3Raw2Sym()
  createEdge3Prun()

  inited = true
}

export function solveFacelets(facelets: string): string {
  const search = new Search()
  return search.solution(facelets)
}

class Search {
  p1sols = new Phase1Sols()
  move1 = new Int32Array(15)
  move2 = new Int32Array(20)
  move3 = new Int32Array(20)
  length1 = 0
  length2 = 0
  add1 = false
  c!: FullCube
  c1 = new FullCube()
  c2 = new FullCube()
  ct2 = new Center2()
  ct3 = new Center3()
  e12 = new Edge3()
  tempe: Edge3[] = map(range(20), () => new Edge3())

  solutionOut = ''
  p1SolsCnt = 0
  arr2: (FullCube | null)[] = fill(new Array(PHASE2_SOLUTIONS), null)
  arr2idx = 0

  solution(facelet: string): string {
    const f = new Uint8Array(96)
    for (let i = 0; i < 96; i++) {
      f[i] = 'URFDLB'.indexOf(facelet.charAt(i))
    }
    this.c = new FullCube(f)
    this.doSearch()
    return this.solutionOut
  }

  doSearch(): void {
    initTpr()
    this.solutionOut = ''
    const ud = new Center1(this.c.getCenter(), 0).getsym()
    const fb = new Center1(this.c.getCenter(), 1).getsym()
    const rl = new Center1(this.c.getCenter(), 2).getsym()
    const udprun = csprun[ud >>> 6]
    const fbprun = csprun[fb >>> 6]
    const rlprun = csprun[rl >>> 6]

    this.p1SolsCnt = 0
    this.arr2idx = 0
    this.p1sols.clear()

    for (
      this.length1 = min(udprun, fbprun, rlprun);
      this.length1 < 100;
      this.length1++
    ) {
      if (
        (rlprun <= this.length1 &&
          this.search1(rl >>> 6, rl & 0x3f, this.length1, -1, 0)) ||
        (udprun <= this.length1 &&
          this.search1(ud >>> 6, ud & 0x3f, this.length1, -1, 0)) ||
        (fbprun <= this.length1 &&
          this.search1(fb >>> 6, fb & 0x3f, this.length1, -1, 0))
      ) {
        break
      }
    }

    const p1SolsArr = this.p1sols.toArray()

    let MAX_LENGTH2 = 9
    let length12 = 100
    do {
      length12 = p1SolsArr[0].value
      outer: for (; length12 < 100; length12++) {
        for (let i = 0; i < p1SolsArr.length; i++) {
          if (p1SolsArr[i].value > length12) break
          if (length12 - p1SolsArr[i].length1 > MAX_LENGTH2) continue
          this.c1.copy(p1SolsArr[i])
          this.ct2.set(this.c1.getCenter(), this.c1.getEdge().getParity())
          const s2ct = this.ct2.getct()
          const s2rl = this.ct2.getrl()
          this.length1 = p1SolsArr[i].length1
          this.length2 = length12 - p1SolsArr[i].length1

          if (this.search2(s2ct, s2rl, this.length2, 28, 0)) {
            break outer
          }
        }
      }
      MAX_LENGTH2++
    } while (length12 === 100)

    const phase2Sols = sortBy(
      this.arr2.slice(0, this.arr2idx) as FullCube[],
      'value',
    )
    let length123 = 100
    let index = 0
    let MAX_LENGTH3 = 13
    do {
      length123 = phase2Sols[0].value
      outer2: for (; length123 < 100; length123++) {
        for (let i = 0; i < min(this.arr2idx, PHASE3_ATTEMPTS); i++) {
          if (phase2Sols[i].value > length123) break
          if (
            length123 - phase2Sols[i].length1 - phase2Sols[i].length2 >
            MAX_LENGTH3
          )
            continue
          const eparity = this.e12.set(phase2Sols[i].getEdge()) as number
          this.ct3.set(
            phase2Sols[i].getCenter(),
            eparity ^ phase2Sols[i].getCorner().getParity(),
          )
          const ct = this.ct3.getct()
          const edge = this.e12.get(10)
          const prun = getprun(this.e12.getsym())
          const lm = 20

          if (
            prun <= length123 - phase2Sols[i].length1 - phase2Sols[i].length2 &&
            this.search3(
              edge,
              ct,
              prun,
              length123 - phase2Sols[i].length1 - phase2Sols[i].length2,
              lm,
              0,
            )
          ) {
            index = i
            break outer2
          }
        }
      }
      MAX_LENGTH3++
    } while (length123 === 100)

    const solcube = new FullCube(phase2Sols[index])
    this.length1 = solcube.length1
    this.length2 = solcube.length2
    const length = length123 - this.length1 - this.length2

    for (let i = 0; i < length; i++) {
      solcube.move(move3std[this.move3[i]])
    }

    const facelet333 = solcube.to333Facelet()
    const cube333 = Cube.fromString(facelet333)
    const sol333 = cube333.isSolved() ? '' : cube333.solve()
    const sol333moves = tomove(sol333)
    for (let i = 0; i < sol333moves.length; i++) {
      solcube.move(sol333moves[i])
    }

    this.solutionOut = solcube.getMoveString()
  }

  search1(
    ct: number,
    sym: number,
    maxl: number,
    lm: number,
    depth: number,
  ): boolean {
    if (ct === 0 && maxl < 5) {
      return maxl === 0 && this.init2(sym, lm)
    }
    for (let axis = 0; axis < 27; axis += 3) {
      if (axis === lm || axis === lm - 9 || axis === lm - 18) continue
      for (let power = 0; power < 3; power++) {
        const m = axis + power
        let ctx = ctsmv[ct * 36 + symmove[sym * 36 + m]]
        const prun = csprun[ctx >>> 6]
        if (prun >= maxl) {
          if (prun > maxl) break
          continue
        }
        const symx = symmult[sym * 48 + (ctx & 0x3f)]
        ctx >>>= 6
        this.move1[depth] = m
        if (this.search1(ctx, symx, maxl - 1, axis, depth + 1)) return true
      }
    }
    return false
  }

  init2(sym: number, lm: number): boolean {
    void lm
    this.c1.copy(this.c)
    for (let i = 0; i < this.length1; i++) {
      this.c1.move(this.move1[i])
    }

    switch (finish[sym]) {
      case 0:
        this.c1.move(fx1)
        this.c1.move(bx3)
        this.move1[this.length1] = fx1
        this.move1[this.length1 + 1] = bx3
        this.add1 = true
        sym = 19
        break
      case 12869:
        this.c1.move(ux1)
        this.c1.move(dx3)
        this.move1[this.length1] = ux1
        this.move1[this.length1 + 1] = dx3
        this.add1 = true
        sym = 34
        break
      case 735470:
        this.add1 = false
        sym = 0
        break
    }
    this.ct2.set(this.c1.getCenter(), this.c1.getEdge().getParity())
    const s2ct = this.ct2.getct()
    const s2rl = this.ct2.getrl()
    const ctp = ctprun[s2ct * 70 + s2rl]

    this.c1.value = ctp + this.length1
    this.c1.length1 = this.length1
    this.c1.add1 = this.add1
    this.c1.sym = sym
    this.p1SolsCnt++

    let next: FullCube
    if (this.p1sols.size < PHASE2_ATTEMPTS) {
      next = new FullCube(this.c1)
    } else {
      next = this.p1sols.poll()
      if (next.value > this.c1.value) {
        next.copy(this.c1)
      }
    }
    this.p1sols.add(next)

    return this.p1SolsCnt === PHASE1_SOLUTIONS
  }

  search2(
    ct: number,
    rl: number,
    maxl: number,
    lm: number,
    depth: number,
  ): boolean {
    if (ct === 0 && ctprun[rl] === 0 && maxl === 0) {
      return this.init3()
    }
    for (let m = 0; m < 23; m++) {
      if (ckmv2[lm][m]) {
        m = skipAxis2[m]
        continue
      }
      const ctx = ctmv[ct * 28 + m]
      const rlx = rlmv[rl * 28 + m]

      const prun = ctprun[ctx * 70 + rlx]
      if (prun >= maxl) {
        if (prun > maxl) {
          m = skipAxis2[m]
        }
        continue
      }

      this.move2[depth] = move2std[m]
      if (this.search2(ctx, rlx, maxl - 1, m, depth + 1)) return true
    }
    return false
  }

  init3(): boolean {
    this.c2.copy(this.c1)
    for (let i = 0; i < this.length2; i++) {
      this.c2.move(this.move2[i])
    }
    if (!this.c2.checkEdge()) return false
    const eparity = this.e12.set(this.c2.getEdge()) as number
    this.ct3.set(this.c2.getCenter(), eparity ^ this.c2.getCorner().getParity())
    const ct = this.ct3.getct()
    const prun = getprun(this.e12.getsym())

    if (this.arr2[this.arr2idx] === null) {
      this.arr2[this.arr2idx] = new FullCube(this.c2)
    } else {
      this.arr2[this.arr2idx]!.copy(this.c2)
    }
    this.arr2[this.arr2idx]!.value =
      this.length1 + this.length2 + max(prun, center3prun[ct])
    this.arr2[this.arr2idx]!.length2 = this.length2
    this.arr2idx++

    return this.arr2idx === this.arr2.length
  }

  search3(
    edge: number,
    ct: number,
    prun: number,
    maxl: number,
    lm: number,
    depth: number,
  ): boolean {
    if (maxl === 0) {
      return edge === 0 && ct === 0
    }
    this.tempe[depth].set(edge)
    for (let m = 0; m < 17; m++) {
      if (ckmv3[lm][m]) {
        m = skipAxis3[m]
        continue
      }
      const ctx = ctmove[ct * 20 + m]
      const prun1 = center3prun[ctx]
      if (prun1 >= maxl) {
        if (prun1 > maxl && m < 14) {
          m = skipAxis3[m]
        }
        continue
      }
      const edgex = getmvrot(this.tempe[depth].edge, m << 3, 10)

      const cord1x = Math.floor(edgex / N_RAW)
      let symcord1x = edgeRaw2sym[cord1x]
      const symx = symcord1x & 0x7
      symcord1x >>= 3
      const cord2x =
        getmvrot(this.tempe[depth].edge, (m << 3) | symx, 10) % N_RAW

      const prunx = getprun(symcord1x * N_RAW + cord2x, prun)
      if (prunx >= maxl) {
        if (prunx > maxl && m < 14) {
          m = skipAxis3[m]
        }
        continue
      }

      if (this.search3(edgex, ctx, prunx, maxl - 1, m, depth + 1)) {
        this.move3[depth] = m
        return true
      }
    }
    return false
  }
}
