import Phaser from 'phaser'
import { getDigitFontFamily, getFontFamily } from '../i18n'
import { s } from '../scale'

export function sharpTextStyle(
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
  digit = false,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: digit ? getDigitFontFamily() : getFontFamily(),
    fontSize: `${s(designPx)}px`,
    ...style,
  }
}

export function digitTextStyle(
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return sharpTextStyle(
    designPx,
    {
      fontStyle: 'bold',
      align: 'center',
      ...style,
    },
    true,
  )
}

export function addSharpText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
  digit = false,
) {
  return scene.add.text(x, y, content, sharpTextStyle(designPx, style, digit))
}

export function addCenteredDigitText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
  fixedWidth?: number,
  fixedWidthIsScaled = false,
) {
  const text = scene.add.text(
    x,
    y,
    content,
    digitTextStyle(designPx, {
      ...(fixedWidth
        ? {
            fixedWidth: fixedWidthIsScaled ? fixedWidth : s(fixedWidth),
          }
        : {}),
      ...style,
    }),
  )
  text.setOrigin(0.5, 0.5).setPadding(0, 0, 0, 0)
  return text
}
