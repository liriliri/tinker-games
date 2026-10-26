import Phaser from 'phaser'
import compact from 'licia/compact'
import max from 'licia/max'
import { COLORS } from '../game/constants'
import { s } from '../lib/scale'
import { sharpTextStyle } from './sharpText'

interface MarkTone {
  color: number
  alpha: number
}

interface ButtonOptions {
  brass?: boolean
  fontSize?: number
  mark?: (graphics: Phaser.GameObjects.Graphics, tone: MarkTone) => void
  bindRedraw?: (redraw: () => void) => void
  round?: boolean
  bare?: boolean
}

export function createTextButton(
  scene: Phaser.Scene,
  label: string,
  designX: number,
  designY: number,
  designWidth: number,
  designHeight: number,
  onClick: () => void,
  options: ButtonOptions = {},
) {
  const brass = options.brass === true
  const width = s(designWidth)
  const height = s(designHeight)
  const radius = s(options.round ? designHeight / 2 : 2)
  const text =
    label.length > 0
      ? scene.add
          .text(
            0,
            0,
            label,
            sharpTextStyle(options.fontSize ?? 15, {
              color: brass ? COLORS.ink : COLORS.paper,
            }),
          )
          .setOrigin(0.5)
          .setPadding(0)
      : undefined
  const mark = options.mark ? scene.add.graphics() : undefined

  const bg = scene.add.graphics()
  let hovered = false
  let pressed = false

  const fillColor = () => {
    if (brass) {
      if (pressed) return COLORS.brassActive
      if (hovered) return COLORS.brassHover
      return COLORS.brass
    }
    if (pressed) return COLORS.buttonActive
    if (hovered) return COLORS.buttonHover
    return COLORS.button
  }

  const redraw = () => {
    bg.clear()
    if (!options.bare) {
      bg.fillStyle(fillColor(), brass ? 1 : pressed ? 1 : 0)
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
      if (!brass) {
        bg.lineStyle(
          max(1, s(1)),
          hovered ? COLORS.brassHover : COLORS.brass,
          hovered ? 0.9 : 0.55,
        )
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius)
      }
    }
    if (mark && options.mark) {
      const tone = pressed
        ? { color: COLORS.brassActive, alpha: 1 }
        : hovered
          ? { color: COLORS.brassHover, alpha: 1 }
          : { color: COLORS.brass, alpha: 0.9 }
      options.mark(mark, tone)
    }
  }

  options.bindRedraw?.(redraw)
  redraw()

  const root = scene.add.container(
    s(designX),
    s(designY),
    compact([bg, text, mark]),
  )
  root.setInteractive({
    hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    useHandCursor: true,
  })

  root.on('pointerover', () => {
    hovered = true
    redraw()
  })
  root.on('pointerout', () => {
    hovered = false
    pressed = false
    redraw()
  })
  root.on(
    'pointerdown',
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      pressed = true
      redraw()
    },
  )
  root.on(
    'pointerup',
    (
      _pointer: Phaser.Input.Pointer,
      _x: number,
      _y: number,
      event: Phaser.Types.Input.EventData,
    ) => {
      event.stopPropagation()
      const activate = pressed
      pressed = false
      redraw()
      if (activate) onClick()
    },
  )

  return root
}
