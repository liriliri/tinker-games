import { swap } from './util'
import { centerFacelet } from './facelets'

export class CenterCube {
  ct = new Uint8Array(24)

  constructor() {
    for (let i = 0; i < 24; i++) {
      this.ct[i] = centerFacelet[i] >>> 4
    }
  }

  copy(c: CenterCube): void {
    this.ct.set(c.ct)
  }

  static center333Map = [0, 4, 2, 1, 5, 3]

  fill333Facelet(facelet: string[]): void {
    const firstIdx = 4
    const inc = 9
    for (let i = 0; i < 6; i++) {
      const idx = CenterCube.center333Map[i] << 2
      if (
        this.ct[idx] !== this.ct[idx + 1] ||
        this.ct[idx + 1] !== this.ct[idx + 2] ||
        this.ct[idx + 2] !== this.ct[idx + 3]
      ) {
        throw new Error('Unsolved Center')
      }
      facelet[firstIdx + i * inc] = 'URFDLB'.charAt(this.ct[idx])
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
}
