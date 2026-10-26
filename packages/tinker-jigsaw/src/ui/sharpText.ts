import Phaser from 'phaser'
import { getFontFamily } from '../lib/i18n'
import { s } from '../lib/scale'

const COUNT_FONT =
  '"Avenir Next Condensed", "DIN Alternate", "Avenir Next", "Helvetica Neue", sans-serif'

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

function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
) {
  return scene.add.text(x, y, content, style).setPadding(0)
}

export function addSharpText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
) {
  return addText(scene, x, y, content, sharpTextStyle(designPx, style))
}

export function addCountText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  designPx: number,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
) {
  return addText(scene, x, y, content, {
    fontFamily: COUNT_FONT,
    fontSize: `${s(designPx)}px`,
    fontStyle: 'bold',
    ...style,
  })
}
