declare module 'cubejs' {
  export default class Cube {
    constructor(state?: Cube)
    static fromString(str: string): Cube
    static initSolver(): void
    static random(): Cube
    move(algorithm: string): Cube
    asString(): string
    solve(maxDepth?: number): string
    isSolved(): boolean
    clone(): Cube
  }
}
