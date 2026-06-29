import Phaser from 'phaser'
import {
  ACTION_BUTTON_HEIGHT,
  ACTION_BUTTON_MIN_WIDTH,
  BUTTON_FONT_SIZE,
  COLORS,
} from '../game/constants'
import { s } from '../scale'
import {
  fillSmoothRoundedRect,
  strokeSmoothRoundedRect,
} from './drawRoundedRect'
import { sharpTextStyle } from './sharpText'

function drawButtonBg(
  bg: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  fillColor: number,
) {
  bg.clear()
  fillSmoothRoundedRect(
    bg,
    -width / 2,
    -height / 2,
    width,
    height,
    s(8),
    fillColor,
  )
  strokeSmoothRoundedRect(
    bg,
    -width / 2,
    -height / 2,
    width,
    height,
    s(8),
    COLORS.buttonBorder,
    1,
    s(1.5),
  )
}

export function createActionButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
) {
  const text = scene.add
    .text(
      0,
      0,
      label,
      sharpTextStyle(BUTTON_FONT_SIZE, {
        color: COLORS.buttonText,
        fontStyle: 'bold',
      }),
    )
    .setOrigin(0.5)

  const width = Math.max(s(ACTION_BUTTON_MIN_WIDTH), text.width + s(28))
  const height = s(ACTION_BUTTON_HEIGHT)
  const bg = scene.add.graphics()
  drawButtonBg(bg, width, height, COLORS.buttonBg)

  const container = scene.add.container(x, y, [bg, text])
  container.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
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
    drawButtonBg(bg, width, height, COLORS.buttonHover)
    tweenScale(1.03)
  })

  container.on('pointerout', () => {
    hovered = false
    drawButtonBg(bg, width, height, COLORS.buttonBg)
    tweenScale(1)
  })

  container.on('pointerdown', () => {
    drawButtonBg(bg, width, height, COLORS.buttonActive)
    scene.tweens.killTweensOf(container)
    container.setScale(0.97)
  })

  container.on('pointerup', () => {
    if (hovered) {
      drawButtonBg(bg, width, height, COLORS.buttonHover)
      tweenScale(1.03)
    } else {
      drawButtonBg(bg, width, height, COLORS.buttonBg)
      tweenScale(1)
    }
  })

  return { container, width, height }
}
