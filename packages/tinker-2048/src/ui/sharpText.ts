import Phaser from 'phaser'
import { getFontFamily } from '../i18n'
import { getTextResolution, scaledFont } from '../scale'

export function sharpTextStyle(
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: getFontFamily(),
    fontSize: scaledFont(designPx),
    resolution: getTextResolution(),
    ...style,
  }
}

export function addSharpText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
) {
  return scene.add.text(x, y, content, sharpTextStyle(designPx, style))
}
