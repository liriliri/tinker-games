import Phaser from 'phaser'
import { getFontFamily } from '../i18n'
import { s } from '../scale'

export function sharpTextStyle(
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: getFontFamily(),
    fontSize: `${s(designPx)}px`,
    ...style,
  }
}
