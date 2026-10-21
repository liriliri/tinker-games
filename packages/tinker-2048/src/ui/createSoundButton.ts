import Phaser from 'phaser'
import { s } from '../lib/scale'
import { setCenterHitArea, tweenScale } from '../lib/util'

const SOUND_BUTTON_SIZE = 26

export function createSoundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  enabled: boolean,
  onToggle: (enabled: boolean) => void,
) {
  const scaledSize = s(SOUND_BUTTON_SIZE)
  let soundEnabled = enabled

  const icon = scene.add.image(0, 0, soundEnabled ? 'soundon' : 'soundoff')
  icon.setDisplaySize(scaledSize, scaledSize)

  const refreshIcon = () => {
    icon.setTexture(soundEnabled ? 'soundon' : 'soundoff')
  }

  const container = scene.add.container(s(x), s(y), [icon])
  setCenterHitArea(container, scaledSize, scaledSize)

  container.on('pointerover', () => {
    tweenScale(scene, container, 1.1)
  })

  container.on('pointerout', () => {
    tweenScale(scene, container, 1)
  })

  container.on('pointerup', () => {
    soundEnabled = !soundEnabled
    onToggle(soundEnabled)
    refreshIcon()
  })

  return container
}
