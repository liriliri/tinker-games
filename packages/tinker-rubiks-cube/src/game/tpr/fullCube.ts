import { dx1, move2str, u0, d0 } from './moves'
import { centerFacelet, edgeFacelet, cornerFacelet444 } from './facelets'
import { CenterCube } from './centerCube'
import { CornerCube } from './cornerCube'
import { EdgeCube } from './edgeCube'
import { symmove, symmult } from './center1'

const move2rot = [35, 1, 34, 2, 4, 6, 22, 5, 19]
const u0n = u0 >>> 4
const d0n = d0 >>> 4

export class FullCube {
  edge: EdgeCube
  center: CenterCube
  corner: CornerCube

  value = 0
  add1 = false
  length1 = 0
  length2 = 0
  length3 = 0
  sym = 0

  moveBuffer = new Uint8Array(60)
  moveLength = 0
  edgeAvail = 0
  centerAvail = 0
  cornerAvail = 0

  constructor(fOrCopy?: Uint8Array | FullCube) {
    this.edge = new EdgeCube()
    this.center = new CenterCube()
    this.corner = new CornerCube()
    if (fOrCopy instanceof Uint8Array) {
      this.fromFacelets(fOrCopy)
    } else if (fOrCopy instanceof FullCube) {
      this.copy(fOrCopy)
    }
  }

  fromFacelets(f: Uint8Array): void {
    for (let i = 0; i < 24; i++) {
      this.center.ct[i] = f[centerFacelet[i]]
    }
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 24; j++) {
        if (
          f[edgeFacelet[i][0]] === edgeFacelet[j][0] >>> 4 &&
          f[edgeFacelet[i][1]] === edgeFacelet[j][1] >>> 4
        ) {
          this.edge.ep[i] = j
        }
      }
    }
    for (let i = 0; i < 8; i++) {
      let ori = 0
      for (; ori < 3; ori++) {
        if (
          f[cornerFacelet444[i][ori]] === u0n ||
          f[cornerFacelet444[i][ori]] === d0n
        )
          break
      }
      const col1 = f[cornerFacelet444[i][(ori + 1) % 3]]
      const col2 = f[cornerFacelet444[i][(ori + 2) % 3]]
      for (let j = 0; j < 8; j++) {
        if (
          col1 === cornerFacelet444[j][1] >>> 4 &&
          col2 === cornerFacelet444[j][2] >>> 4
        ) {
          this.corner.cp[i] = j
          this.corner.co[i] = ori % 3
          break
        }
      }
    }
  }

  copy(c: FullCube): void {
    this.edge.copy(c.edge)
    this.center.copy(c.center)
    this.corner.copy(c.corner)
    this.value = c.value
    this.add1 = c.add1
    this.length1 = c.length1
    this.length2 = c.length2
    this.length3 = c.length3
    this.sym = c.sym
    this.moveBuffer.set(c.moveBuffer.subarray(0, c.moveLength))
    this.moveLength = c.moveLength
    this.edgeAvail = c.edgeAvail
    this.centerAvail = c.centerAvail
    this.cornerAvail = c.cornerAvail
  }

  checkEdge(): boolean {
    return this.getEdge().checkEdge()
  }

  /** Forward alg only (no inverse / cube-rotation suffixes). */
  getMoveString(): string {
    const fixedMoves = new Int32Array(this.moveLength - (this.add1 ? 2 : 0))
    let idx = 0
    for (let i = 0; i < this.length1; i++) {
      fixedMoves[idx++] = this.moveBuffer[i]
    }
    let sym = this.sym
    for (let i = this.length1 + (this.add1 ? 2 : 0); i < this.moveLength; i++) {
      const mv = symmove[sym * 36 + this.moveBuffer[i]]
      if (mv >= dx1) {
        fixedMoves[idx++] = mv - 9
        const rot = move2rot[mv - dx1]
        sym = symmult[sym * 48 + rot]
      } else {
        fixedMoves[idx++] = mv
      }
    }
    let sb = ''
    for (let i = 0; i < idx; i++) {
      sb += move2str[fixedMoves[i]] + ' '
    }
    return sb
  }

  to333Facelet(): string {
    const ret = new Array<string>(54)
    this.getEdge().fill333Facelet(ret)
    this.getCenter().fill333Facelet(ret)
    this.getCorner().fill333Facelet(ret)
    return ret.join('')
  }

  move(m: number): void {
    this.moveBuffer[this.moveLength++] = m
  }

  getEdge(): EdgeCube {
    while (this.edgeAvail < this.moveLength) {
      this.edge.move(this.moveBuffer[this.edgeAvail++])
    }
    return this.edge
  }

  getCenter(): CenterCube {
    while (this.centerAvail < this.moveLength) {
      this.center.move(this.moveBuffer[this.centerAvail++])
    }
    return this.center
  }

  getCorner(): CornerCube {
    while (this.cornerAvail < this.moveLength) {
      this.corner.move(this.moveBuffer[this.cornerAvail++] % 18)
    }
    return this.corner
  }
}
