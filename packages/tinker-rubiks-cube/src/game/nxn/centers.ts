import { FACE_COUNT, Faces } from './constants'
import { Cube } from './Cube'

export function solveCenters(cube: Cube): void {
  const refCube = new Cube(1)
  if (cube.size % 2 === 1) {
    const s = Math.floor(cube.size / 2)
    for (let i = 0; i < FACE_COUNT; i++)
      refCube.matrix[i][0][0] = cube.matrix[i][s][s]
  }
  const solvedColors: Record<number, boolean> = {}
  const moves = ['y', 'y', 'y', 'x', 'x2']
  for (const move of moves) {
    cube.parse(move)
    refCube.parse(move)
    const targetColor = refCube.matrix[Faces.Front][0][0]
    for (let i = 0; i < 5; i++) {
      if (i < 4) {
        cube.turn('B', 1, cube.size - 1, cube.size - 1)
        refCube.turn('B', 1, 1, 1)
      }
      const searchFace = i === 4 ? Faces.Back : Faces.Top
      if (
        cube.matrix[searchFace][Math.floor(cube.size / 2)][
          Math.floor(cube.size / 2)
        ] in solvedColors
      )
        continue
      for (let y = 1; y < cube.size - 1; y++) {
        for (let x = 1; x < cube.size - 1; x++) {
          if (cube.matrix[searchFace][y][x] !== targetColor) continue
          let sliceDist = -1
          let adjustDist = -1
          let adjustMove: 'U' | 'B' = 'U'
          let fx = x
          let fy = y
          if (searchFace === Faces.Back) {
            fx = cube.size - 1 - x
            fy = cube.size - 1 - y
            sliceDist = -2
            adjustMove = 'B'
          }
          let la = fx + 1
          let lb = fy + 1
          if (la === lb) {
            lb = cube.size - fy
            adjustDist *= -1
          }
          while (cube.matrix[Faces.Front][fy][fx] === targetColor)
            cube.turn('F', 1, 1, 1)

          cube.turn('L', sliceDist, la, 1)
          cube.turn(adjustMove, adjustDist, 1, 1)
          cube.turn('L', sliceDist, lb, 1)
          cube.turn(adjustMove, -adjustDist, 1, 1)
          cube.turn('L', -sliceDist, la, 1)
          cube.turn(adjustMove, adjustDist, 1, 1)
          cube.turn('L', -sliceDist, lb, 1)
          cube.turn(adjustMove, -adjustDist, 1, 1)
        }
      }
    }
    solvedColors[targetColor] = true
  }
}
