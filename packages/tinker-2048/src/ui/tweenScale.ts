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
