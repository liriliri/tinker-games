import Phaser from 'phaser'
import {
  TILE_BORDER_RADIUS,
  TRANSITION_SPEED,
  getTileStyle,
} from '../game/constants'
import type { Grid } from '../game/Grid'
import type { Position, Tile } from '../game/Tile'
import { s } from '../scale'
import {
  fillSmoothRoundedRect,
  strokeSmoothRoundedRect,
} from '../ui/drawRoundedRect'
import { sharpTextStyle } from '../ui/sharpText'
import { tilePosition } from './gridLayout'

export class TileLayer {
  private layer: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private tileSize: number,
  ) {
    this.layer = scene.add.container(0, 0)
    this.layer.setDepth(10)
  }

  destroy() {
    this.scene.tweens.killTweensOf(this.layer)
    this.layer.destroy(true)
  }

  render(grid: Grid) {
    this.layer.removeAll(true)
    grid.eachCell((_x, _y, tile) => {
      if (tile) this.addTile(tile)
    })
  }

  private createTileVisual(
    value: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const style = getTileStyle(value)
    const half = this.tileSize / 2
    const container = this.scene.add.container(x + half, y + half)

    const bg = this.scene.add.graphics()
    fillSmoothRoundedRect(
      bg,
      -half,
      -half,
      this.tileSize,
      this.tileSize,
      s(TILE_BORDER_RADIUS),
      style.bg,
    )

    if (style.glow) {
      strokeSmoothRoundedRect(
        bg,
        -half,
        -half,
        this.tileSize,
        this.tileSize,
        s(TILE_BORDER_RADIUS),
        0xffffff,
        style.glow / 3,
      )
    }

    const text = this.scene.add
      .text(
        0,
        0,
        String(value),
        sharpTextStyle(style.fontSize, {
          color: style.text,
          fontStyle: 'bold',
        }),
      )
      .setOrigin(0.5)

    container.add([bg, text])
    return container
  }

  private addTile(tile: Tile) {
    const position = tile.previousPosition ?? { x: tile.x, y: tile.y }
    const { x, y } = tilePosition(position, this.tileSize)
    const half = this.tileSize / 2

    if (tile.mergedFrom) {
      tile.mergedFrom.forEach((merged) => this.addTile(merged))

      const container = this.createTileVisual(tile.value, x, y)
      this.layer.add(container)
      container.setScale(0)
      this.scene.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        delay: TRANSITION_SPEED,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: container,
            scaleX: 1,
            scaleY: 1,
            duration: 100,
            ease: 'Cubic.easeIn',
          })
        },
      })
      return
    }

    const container = this.createTileVisual(tile.value, x, y)
    this.layer.add(container)

    if (tile.previousPosition) {
      const target = tilePosition({ x: tile.x, y: tile.y }, this.tileSize)
      this.scene.tweens.add({
        targets: container,
        x: target.x + half,
        y: target.y + half,
        duration: TRANSITION_SPEED,
        ease: 'Cubic.easeInOut',
      })
    } else {
      container.setScale(0)
      this.scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        delay: TRANSITION_SPEED,
        ease: 'Back.easeOut',
      })
    }
  }
}
