import {
  U9,
  R1,
  F3,
  U7,
  F1,
  L3,
  U1,
  L1,
  B3,
  U3,
  B1,
  R3,
  D3,
  F9,
  R7,
  D1,
  L9,
  F7,
  D7,
  B9,
  L7,
  D9,
  R9,
  B7,
} from './moves'
import { parity, set8Perm } from './util'

const cornerFacelet = [
  [U9, R1, F3],
  [U7, F1, L3],
  [U1, L1, B3],
  [U3, B1, R3],
  [D3, F9, R7],
  [D1, L9, F7],
  [D7, B9, L7],
  [D9, R9, B7],
]

const moveCube: CornerCube[] = new Array(18)

export class CornerCube {
  cp = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])
  co = new Uint8Array(8)
  temps: CornerCube | null = null

  copy(c: CornerCube): void {
    this.cp.set(c.cp)
    this.co.set(c.co)
  }

  getParity(): number {
    return parity(this.cp)
  }

  fill333Facelet(facelet: string[]): void {
    for (let corn = 0; corn < 8; corn++) {
      const j = this.cp[corn]
      const ori = this.co[corn]
      for (let n = 0; n < 3; n++) {
        facelet[cornerFacelet[corn][(n + ori) % 3]] = 'URFDLB'.charAt(
          Math.floor(cornerFacelet[j][n] / 9),
        )
      }
    }
  }

  static CornMult(a: CornerCube, b: CornerCube, prod: CornerCube): void {
    for (let corn = 0; corn < 8; corn++) {
      prod.cp[corn] = a.cp[b.cp[corn]]
      const oriA = a.co[b.cp[corn]]
      const oriB = b.co[corn]
      let ori = oriA
      ori += oriA < 3 ? oriB : 6 - oriB
      ori %= 3
      if (oriA >= 3 !== oriB >= 3) {
        ori += 3
      }
      prod.co[corn] = ori
    }
  }

  setTwist(idx: number): void {
    let twst = 0
    for (let i = 6; i >= 0; i--) {
      twst += this.co[i] = idx % 3
      idx = Math.floor(idx / 3)
    }
    this.co[7] = (15 - twst) % 3
  }

  setCPerm(idx: number): void {
    set8Perm(this.cp, idx)
  }

  move(idx: number): void {
    if (this.temps === null) {
      this.temps = new CornerCube()
    }
    CornerCube.CornMult(this, moveCube[idx], this.temps)
    this.copy(this.temps)
  }
}

export function initCornerMove(): void {
  moveCube[0] = new CornerCube()
  moveCube[0].setCPerm(15120)
  moveCube[0].setTwist(0)
  moveCube[3] = new CornerCube()
  moveCube[3].setCPerm(21021)
  moveCube[3].setTwist(1494)
  moveCube[6] = new CornerCube()
  moveCube[6].setCPerm(8064)
  moveCube[6].setTwist(1236)
  moveCube[9] = new CornerCube()
  moveCube[9].setCPerm(9)
  moveCube[9].setTwist(0)
  moveCube[12] = new CornerCube()
  moveCube[12].setCPerm(1230)
  moveCube[12].setTwist(412)
  moveCube[15] = new CornerCube()
  moveCube[15].setCPerm(224)
  moveCube[15].setTwist(137)
  for (let a = 0; a < 18; a += 3) {
    for (let p = 0; p < 2; p++) {
      moveCube[a + p + 1] = new CornerCube()
      CornerCube.CornMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1])
    }
  }
}
