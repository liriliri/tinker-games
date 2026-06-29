export type GridNeighbour = {
  i: number
  j: number
}

export function getNeighbours(i: number, j: number): GridNeighbour[] {
  const left = { i: i - 1, j }
  const right = { i: i + 1, j }
  let topLeft: GridNeighbour
  let topRight: GridNeighbour
  let bottomLeft: GridNeighbour
  let bottomRight: GridNeighbour

  if ((j & 1) === 0) {
    topLeft = { i: i - 1, j: j - 1 }
    topRight = { i, j: j - 1 }
    bottomLeft = { i: i - 1, j: j + 1 }
    bottomRight = { i, j: j + 1 }
  } else {
    topLeft = { i, j: j - 1 }
    topRight = { i: i + 1, j: j - 1 }
    bottomLeft = { i, j: j + 1 }
    bottomRight = { i: i + 1, j: j + 1 }
  }

  return [left, topLeft, topRight, right, bottomRight, bottomLeft]
}
