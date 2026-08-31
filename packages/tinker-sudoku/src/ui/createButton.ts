import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { s } from '../lib/scale'
import { fillSmoothRoundedRect } from './drawRoundedRect'
import { digitTextStyle, sharpTextStyle } from './sharpText'

function isDigitLabel(label: string) {
  return /^\d$/.test(label)
}

function drawButtonBg(
  bg: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  color: number,
  radius: number,
) {
  bg.clear()
  fillSmoothRoundedRect(
    bg,
    -width / 2,
    -height / 2,
    width,
    height,
    radius,
    color,
  )
}

export function createButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  minWidth: number,
  height: number,
  fontSize = 14,
  accent = false,
) {
  const digit = isDigitLabel(label)
  const text = scene.add
    .text(
      0,
      0,
      label,
      digit
        ? digitTextStyle(fontSize, {
            color: accent ? COLORS.accentText : COLORS.buttonText,
          })
        : sharpTextStyle(fontSize, {
            color: accent ? COLORS.accentText : COLORS.buttonText,
            fontStyle: 'bold',
          }),
    )
    .setOrigin(0.5, 0.5)
    .setPadding(0, 0, 0, 0)

  const width = digit ? s(minWidth) : Math.max(s(minWidth), text.width + s(24))
  const scaledHeight = s(height)
  const radius = s(10)
  const baseColor = accent ? COLORS.accent : COLORS.button
  const hoverColor = accent ? COLORS.accentHover : COLORS.buttonHover
  const activeColor = accent ? COLORS.accentActive : COLORS.buttonActive

  const bg = scene.add.graphics()
  drawButtonBg(bg, width, scaledHeight, baseColor, radius)

  const container = scene.add.container(s(x), s(y), [bg, text])
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

  container.on('pointerover', () => {
    hovered = true
    drawButtonBg(bg, width, scaledHeight, hoverColor, radius)
  })

  container.on('pointerout', () => {
    hovered = false
    drawButtonBg(bg, width, scaledHeight, baseColor, radius)
  })

  container.on('pointerdown', () => {
    drawButtonBg(bg, width, scaledHeight, activeColor, radius)
  })

  container.on('pointerup', () => {
    drawButtonBg(
      bg,
      width,
      scaledHeight,
      hovered ? hoverColor : baseColor,
      radius,
    )
  })

  return container
}
