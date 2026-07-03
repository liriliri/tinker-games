import Phaser from 'phaser'
import { COLORS, DIALOG_BACKDROP_ALPHA } from '../game/constants'
import { hidePageBackdrop, showPageBackdrop } from './pageBackdrop'

export function createDialogBackdrop(
  scene: Phaser.Scene,
  onDismiss: () => void,
) {
  const backdrop = scene.add.graphics()
  backdrop.on('pointerup', onDismiss)
  return backdrop
}

export function showDialogBackdrop(
  backdrop: Phaser.GameObjects.Graphics,
  onDismiss: () => void,
) {
  showPageBackdrop(onDismiss)

  const { width, height } = backdrop.scene.scale

  backdrop.clear()
  backdrop.fillStyle(COLORS.backdrop, DIALOG_BACKDROP_ALPHA)
  backdrop.fillRect(0, 0, width, height)
  backdrop.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains,
  )
}

export function hideDialogBackdrop(backdrop: Phaser.GameObjects.Graphics) {
  hidePageBackdrop()
  backdrop.clear()
  backdrop.disableInteractive()
}
