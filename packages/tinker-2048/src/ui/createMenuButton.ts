import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { s } from '../scale'

const ICON_NORMAL = COLORS.text
const ICON_HOVER = '#5a524c'
const ICON_ACTIVE = '#9a8a7d'

export function createMenuButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size = 40,
  parent?: Phaser.GameObjects.Container,
) {
  const scaledSize = s(size)
  const icon = scene.add.graphics()

  const drawIcon = (color: string) => {
    icon.clear()
    icon.fillStyle(color, 1)
    const lineW = scaledSize * 0.55
    const lineH = s(3)
    const startX = -lineW / 2
    const gap = s(7)
    for (let i = -1; i <= 1; i++) {
      icon.fillRoundedRect(startX, i * gap - lineH / 2, lineW, lineH, s(1.5))
    }
  }

  drawIcon(ICON_NORMAL)

  const container = scene.add.container(s(x), s(y), [icon])
  parent?.add(container)
  container.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(
      -scaledSize / 2,
      -scaledSize / 2,
      scaledSize,
      scaledSize,
    ),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })

  let hovered = false

  const tweenScale = (scale: number) => {
    scene.tweens.killTweensOf(container)
    scene.tweens.add({
      targets: container,
      scaleX: scale,
      scaleY: scale,
      duration: 100,
      ease: 'Cubic.easeOut',
    })
  }

  container.on('pointerover', () => {
    hovered = true
    drawIcon(ICON_HOVER)
    tweenScale(1.1)
  })

  container.on('pointerout', () => {
    hovered = false
    drawIcon(ICON_NORMAL)
    tweenScale(1)
  })

  container.on('pointerdown', () => {
    drawIcon(ICON_ACTIVE)
    scene.tweens.killTweensOf(container)
    container.setScale(0.92)
  })

  container.on('pointerup', () => {
    drawIcon(hovered ? ICON_HOVER : ICON_NORMAL)
    tweenScale(hovered ? 1.1 : 1)
  })

  return container
}
