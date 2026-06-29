import { COLORS } from '../game/constants'
import { GameScene } from '../scenes/GameScene'

function pointyTopHexPoints(gridRadius: number): number[] {
  // Grid centers use flat-top spacing (dx = 2r). Match that width with pointy-top
  // hexes: width = sqrt(3) * R => R = 2r / sqrt(3).
  const radius = (gridRadius * 2) / Math.sqrt(3)
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2
    points.push(radius * Math.cos(angle), radius * Math.sin(angle))
  }
  return points
}

export class Block extends Phaser.GameObjects.Polygon {
  readonly i: number
  readonly j: number
  readonly r: number
  declare scene: GameScene
  private _isWall = false

  constructor(scene: GameScene, i: number, j: number, r: number) {
    const position = scene.getPosition(i, j)
    const hexPoints = pointyTopHexPoints(r)
    super(scene, position.x, position.y, hexPoints, COLORS.dotFill)
    this.i = i
    this.j = j
    this.r = r
    this.isWall = false

    // Points are centered on (0, 0); default origin 0.5 would misalign the hex center.
    this.setOrigin(0, 0)

    this.setStrokeStyle(1, COLORS.hexStroke, 1)
    this.setInteractive(
      new Phaser.Geom.Polygon(hexPoints),
      Phaser.Geom.Polygon.Contains,
    )
    this.on('pointerdown', () => {
      this.emit('player_click', this.i, this.j)
    })
  }

  get isWall(): boolean {
    return this._isWall
  }

  set isWall(value: boolean) {
    this._isWall = value
    this.setFillStyle(value ? COLORS.wallFill : COLORS.dotFill, 1)
  }
}
