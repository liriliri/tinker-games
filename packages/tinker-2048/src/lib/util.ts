import Phaser from 'phaser'

export function tweenScale(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  scale: number,
  duration = 100,
) {
  scene.tweens.killTweensOf(container)
  scene.tweens.add({
    targets: container,
    scaleX: scale,
    scaleY: scale,
    duration,
    ease: 'Cubic.easeOut',
  })
}

export function fillSmoothRoundedRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: number,
) {
  gfx.fillStyle(color, 1)
  gfx.fillRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, radius)
}

export function strokeSmoothRoundedRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: number,
  alpha = 1,
  lineWidth = 1,
) {
  gfx.lineStyle(lineWidth, color, alpha)
  gfx.strokeRoundedRect(x + 0.5, y + 0.5, width - 1, height - 1, radius)
}

export function setCenterHitArea(
  container: Phaser.GameObjects.Container,
  width: number,
  height: number,
) {
  container.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })
}
