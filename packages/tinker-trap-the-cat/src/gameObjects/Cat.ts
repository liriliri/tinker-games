import {
  CAT_CANNOT_ESCAPE_TEXTURES,
  CAT_DEFAULT_DIRECTION,
  CAT_DIRECTIONS,
  CAT_ORIGINS,
  CAT_STOP_TEXTURES,
} from '../game/catAssets'
import { getCatBestDirection, isCatTrapped } from '../game/boardAnalysis'
import { getNeighbours } from '../game/grid'
import { GameScene } from '../scenes/GameScene'

export type CatSolver = (
  blocksIsWall: boolean[][],
  i: number,
  j: number,
) => number

export class Cat extends Phaser.GameObjects.Sprite {
  declare scene: GameScene
  private escaped = false

  constructor(scene: GameScene) {
    super(scene, 0, 0, '__DEFAULT')
    this.on('animationrepeat', () => {
      this.moveForward()
    })
    this.solver = getCatBestDirection
    this.direction = CAT_DEFAULT_DIRECTION
    this.reset()
  }

  get i(): number {
    return this.getData('i')
  }

  set i(value: number) {
    this.setData('i', value)
  }

  get j(): number {
    return this.getData('j')
  }

  set j(value: number) {
    this.setData('j', value)
  }

  get direction(): number {
    return this.getData('direction')
  }

  set direction(value: number) {
    this.setData('direction', value)
    this.resetTextureToStop()
    this.resetOriginAndScale()
  }

  get solver(): CatSolver {
    return this.getData('solver')
  }

  set solver(value: CatSolver) {
    this.setData('solver', value)
  }

  reset() {
    this.anims.stop()
    this.escaped = false
    this.direction = CAT_DEFAULT_DIRECTION
    this.resetIJ()
  }

  undo(i: number, j: number) {
    this.anims.stop()
    this.setIJ(i, j)
  }

  step(): boolean {
    const direction = this.solver(this.scene.blocksData, this.i, this.j)
    if (direction < 0 || direction > 5) {
      this.caught()
      return false
    }
    const result = this.stepDirection(direction)
    if (!result) {
      this.caught()
      return false
    }
    return true
  }

  isCaught() {
    return isCatTrapped(
      this.scene.blocksData,
      this.i,
      this.j,
      this.scene.w,
      this.scene.h,
    )
  }

  private caught() {
    const directionName = CAT_DIRECTIONS[this.direction]
      .name as keyof typeof CAT_CANNOT_ESCAPE_TEXTURES
    this.setTexture(CAT_CANNOT_ESCAPE_TEXTURES[directionName])
  }

  private escape() {
    if (this.j === 0 || this.j === this.scene.h - 1) {
      this.runForward()
    } else if (this.i === 0) {
      this.runDirection(0)
    } else if (this.i === this.scene.w - 1) {
      this.runDirection(3)
    }
  }

  private setIJ(i: number, j: number): this {
    this.i = i
    this.j = j
    const position = this.scene.getPosition(i, j)
    return this.setPosition(position.x, position.y)
  }

  private resetIJ() {
    this.setIJ(Math.floor(this.scene.w / 2), Math.floor(this.scene.h / 2))
  }

  private isEscaped() {
    return (
      this.i <= 0 ||
      this.i >= this.scene.w - 1 ||
      this.j <= 0 ||
      this.j >= this.scene.h - 1
    )
  }

  private checkState() {
    if (this.isEscaped()) {
      if (this.escaped) {
        return
      }
      this.escaped = true
      this.escape()
      this.emit('escaped')
    } else if (this.isCaught()) {
      this.caught()
      this.emit('win')
    }
  }

  private resetTextureToStop() {
    const directionName = CAT_DIRECTIONS[this.direction]
      .name as keyof typeof CAT_STOP_TEXTURES
    this.setTexture(CAT_STOP_TEXTURES[directionName])
  }

  private resetOriginAndScale() {
    const directionData = CAT_DIRECTIONS[this.direction]
    const origin = CAT_ORIGINS[directionData.name as keyof typeof CAT_ORIGINS]
    this.setOrigin(origin.x, origin.y)
    this.scaleX = directionData.scaleX
  }

  private moveForward() {
    const neighbour = getNeighbours(this.i, this.j)[this.direction]
    this.setIJ(neighbour.i, neighbour.j)
    this.checkState()
  }

  private stepForward(): boolean {
    const neighbour = getNeighbours(this.i, this.j)[this.direction]
    const block = this.scene.getBlock(neighbour.i, neighbour.j)
    if (block === null || block.isWall) {
      return false
    }
    const directionName = CAT_DIRECTIONS[this.direction].name
    this.play(`${directionName}_step`)
    this.once('animationcomplete', () => {
      this.moveForward()
      this.resetTextureToStop()
    })
    return true
  }

  private stepDirection(direction: number): boolean {
    this.direction = direction
    return this.stepForward()
  }

  private runForward() {
    const directionName = CAT_DIRECTIONS[this.direction].name
    this.play(`${directionName}_run`)
  }

  private runDirection(direction: number) {
    this.direction = direction
    this.runForward()
  }
}
