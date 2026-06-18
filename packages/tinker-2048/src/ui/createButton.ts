import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { getFontFamily } from '../i18n'

function drawButtonBg(
  bg: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  color: number,
) {
  bg.clear()
  bg.fillStyle(color, 1)
  bg.fillRoundedRect(-width / 2, -height / 2, width, height, 3)
}

export function createButton(
  scene: Phaser.Scene,
  label: string,
  x: number,
  y: number,
  minWidth: number,
  height: number,
  fontSize = '16px',
) {
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: getFontFamily(),
      fontSize,
      color: COLORS.buttonText,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)

  const width = Math.max(minWidth, text.width + 40)
  const bg = scene.add.graphics()
  drawButtonBg(bg, width, height, COLORS.button)

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
    tweenScale(1.04)
  })

  container.on('pointerout', () => {
    hovered = false
    drawButtonBg(bg, width, height, COLORS.button)
    tweenScale(1)
  })

  container.on('pointerdown', () => {
    drawButtonBg(bg, width, height, COLORS.buttonActive)
    scene.tweens.killTweensOf(container)
    container.setScale(0.96)
  })

  container.on('pointerup', () => {
    if (hovered) {
      drawButtonBg(bg, width, height, COLORS.buttonHover)
      tweenScale(1.04)
    } else {
      drawButtonBg(bg, width, height, COLORS.button)
      tweenScale(1)
    }
  })

  return container
}
