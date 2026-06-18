import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { s } from '../scale'
import { fillSmoothRoundedRect } from './drawRoundedRect'
import { sharpTextStyle } from './sharpText'

function drawButtonBg(
  bg: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  color: number,
) {
  bg.clear()
  fillSmoothRoundedRect(bg, -width / 2, -height / 2, width, height, s(3), color)
}

export function createButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  minWidth: number,
  height: number,
  fontSize = 16,
  parent?: Phaser.GameObjects.Container,
) {
  const text = scene.add
    .text(
      0,
      0,
      label,
      sharpTextStyle(fontSize, { color: COLORS.buttonText, fontStyle: 'bold' }),
    )
    .setOrigin(0.5)

  const width = Math.max(s(minWidth), text.width + s(40))
  const scaledHeight = s(height)
  const bg = scene.add.graphics()
  drawButtonBg(bg, width, scaledHeight, COLORS.button)

  const container = scene.add.container(s(x), s(y), [bg, text])
  parent?.add(container)
  container.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(
      -width / 2,
      -scaledHeight / 2,
      width,
      scaledHeight,
    ),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })

  let hovered = false

  const tweenScale = (scale: number, duration = 100) => {
    scene.tweens.killTweensOf(container)
    scene.tweens.add({
      targets: container,
      scaleX: scale,
      scaleY: scale,
      duration,
      ease: 'Cubic.easeOut',
    })
  }

  container.on('pointerover', () => {
    hovered = true
    drawButtonBg(bg, width, scaledHeight, COLORS.buttonHover)
    tweenScale(1.04)
  })

  container.on('pointerout', () => {
    hovered = false
    drawButtonBg(bg, width, scaledHeight, COLORS.button)
    tweenScale(1)
  })

  container.on('pointerdown', () => {
    drawButtonBg(bg, width, scaledHeight, COLORS.buttonActive)
    scene.tweens.killTweensOf(container)
    container.setScale(0.96)
  })

  container.on('pointerup', () => {
    if (hovered) {
      drawButtonBg(bg, width, scaledHeight, COLORS.buttonHover)
      tweenScale(1.04)
    } else {
      drawButtonBg(bg, width, scaledHeight, COLORS.button)
      tweenScale(1)
    }
  })

  return container
}
