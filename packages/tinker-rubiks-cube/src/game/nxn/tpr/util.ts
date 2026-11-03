import fill from 'licia/fill'
import map from 'licia/map'
import range from 'licia/range'

export const Cnk: number[][] = map(range(25), () => fill(new Array(25), 0))
const fact = new Int32Array(13)

let utilInited = false

export function initUtil(): void {
  if (utilInited) return
  utilInited = true
  for (let i = 0; i < 25; i++) {
    Cnk[i][i] = 1
    Cnk[i][0] = 1
  }
  for (let i = 1; i < 25; i++) {
    for (let j = 1; j <= i; j++) {
      Cnk[i][j] = Cnk[i - 1][j] + Cnk[i - 1][j - 1]
    }
  }
  fact[0] = 1
  for (let i = 0; i < 12; i++) {
    fact[i + 1] = fact[i] * (i + 1)
  }
}

export function tomove(s: string): Int32Array {
  const arr = new Int32Array(s.length)
  let j = 0
  let axis = -1
  for (let i = 0, length = s.length; i < length; i++) {
    switch (s.charAt(i)) {
      case 'U':
        axis = 0
        break
      case 'R':
        axis = 3
        break
      case 'F':
        axis = 6
        break
      case 'D':
        axis = 9
        break
      case 'L':
        axis = 12
        break
      case 'B':
        axis = 15
        break
      case 'u':
        axis = 18
        break
      case 'r':
        axis = 21
        break
      case 'f':
        axis = 24
        break
      case 'd':
        axis = 27
        break
      case 'l':
        axis = 30
        break
      case 'b':
        axis = 33
        break
      case ' ':
        if (axis !== -1) {
          arr[j++] = axis
        }
        axis = -1
        break
      case '2':
        axis++
        break
      case "'":
        axis += 2
        break
      case 'w':
        axis += 18
        break
      default:
        continue
    }
  }
  if (axis !== -1) arr[j++] = axis
  const ret = new Int32Array(j)
  while (--j >= 0) {
    ret[j] = arr[j]
  }
  return ret
}

export function swap(
  arr: Int32Array | Uint8Array | number[],
  a: number,
  b: number,
  c: number,
  d: number,
  key: number,
): void {
  let temp: number
  switch (key) {
    case 0:
      temp = arr[d]
      arr[d] = arr[c]
      arr[c] = arr[b]
      arr[b] = arr[a]
      arr[a] = temp
      return
    case 1:
      temp = arr[a]
      arr[a] = arr[c]
      arr[c] = temp
      temp = arr[b]
      arr[b] = arr[d]
      arr[d] = temp
      return
    case 2:
      temp = arr[a]
      arr[a] = arr[b]
      arr[b] = arr[c]
      arr[c] = arr[d]
      arr[d] = temp
      return
  }
}

export function set8Perm(arr: Uint8Array | number[], idx: number): void {
  let val = 0x76543210
  for (let i = 0; i < 7; i++) {
    const p = fact[7 - i]
    let v = Math.floor(idx / p)
    idx -= v * p
    v <<= 2
    arr[i] = (val >> v) & 0xf
    const m = (1 << v) - 1
    val = (val & m) + ((val >> 4) & ~m)
  }
  arr[7] = val
}

export function parity(arr: Uint8Array | number[]): number {
  let p = 0
  for (let i = 0, len = arr.length; i < len; i++) {
    for (let j = i; j < len; j++) {
      if (arr[i] > arr[j]) {
        p ^= 1
      }
    }
  }
  return p
}

export function binarySearch(sorted: Int32Array, n: number): number {
  let lo = 0
  let hi = sorted.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const v = sorted[mid]
    if (v === n) return mid
    if (v < n) lo = mid + 1
    else hi = mid - 1
  }
  return -1
}
