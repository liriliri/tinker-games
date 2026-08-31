import Phaser from 'phaser'
import { getFontFamily } from '../lib/i18n'
import { s } from '../lib/scale'

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
