import Phaser from 'phaser'
import max from 'licia/max'
import { COLORS } from '../game/constants'
import { FIELD_WIDTH, HEADER_HEIGHT, HUD_TOP, PAGE_PAD } from '../lib/layout'
import { s } from '../lib/scale'
import type { SplitRank } from '../lib/storage'
import { createTextButton } from '../ui/createTextButton'
import { addCountText } from '../ui/sharpText'

const CHIP_HEIGHT = 18
const CHIP_GAP = 4
const CHIP_PAD_X = 7
const STAR_OUTER = 3.5
const STAR_INNER = 1.4
const STAR_GAP = 8
const BACK_SIZE = 18

export class Hud {
  private readonly root: Phaser.GameObjects.Container
  private readonly countText: Phaser.GameObjects.Text
  private readonly redrawChips: Array<() => void> = []
  private best: SplitRank | null

  constructor(
    scene: Phaser.Scene,
    placed: number,
    total: number,
    levels: number[],
    level: number,
    best: SplitRank | null,
    actions: {
      onBack: () => void
      onLevel: (level: number) => void
    },
  ) {
    this.best = best
    this.root = scene.add.container(0, 0).setDepth(10)

    const back = createTextButton(
      scene,
      '',
      PAGE_PAD + BACK_SIZE / 2,
      HUD_TOP + HEADER_HEIGHT / 2,
      BACK_SIZE,
      BACK_SIZE,
      actions.onBack,
      { mark: drawBackMark },
    )

    this.countText = addCountText(
      scene,
      s(FIELD_WIDTH / 2),
      s(HUD_TOP + HEADER_HEIGHT / 2),
      `${placed}/${total}`,
      13,
      { color: COLORS.paper, fontStyle: 'normal' },
    ).setOrigin(0.5)

    const widths = levels.map((_, index) => starChipWidth(index + 1))
    const rowWidth =
      widths.reduce((sum, width) => sum + width, 0) +
      CHIP_GAP * (levels.length - 1)
    let cursor = FIELD_WIDTH - PAGE_PAD - rowWidth
    const chips = levels.map((chipLevel, index) => {
      const width = widths[index]
      const x = cursor + width / 2
      cursor += width + CHIP_GAP
      return createTextButton(
        scene,
        '',
        x,
        HUD_TOP + HEADER_HEIGHT / 2,
        width,
        CHIP_HEIGHT,
        () => actions.onLevel(chipLevel),
        {
          brass: chipLevel === level,
          bindRedraw: (redraw) => this.redrawChips.push(redraw),
          mark: (graphics, tone) => {
            drawStars(
              graphics,
              index + 1,
              this.best !== null && index <= this.best,
              chipLevel === level,
              tone,
            )
          },
        },
      )
    })

    this.root.add([back, this.countText, ...chips])
  }

  setPlaced(placed: number, total: number) {
    this.countText.setText(`${placed}/${total}`)
  }

  setBest(best: SplitRank | null) {
    this.best = best
    for (const redraw of this.redrawChips) redraw()
  }

  destroy() {
    this.root.destroy(true)
  }
}

function starChipWidth(count: number) {
  return CHIP_PAD_X * 2 + STAR_OUTER * 2 + (count - 1) * STAR_GAP
}

function drawStars(
  graphics: Phaser.GameObjects.Graphics,
  count: number,
  filled: boolean,
  ink: boolean,
  tone: { color: number; alpha: number },
) {
  graphics.clear()
  const outer = s(STAR_OUTER)
  const inner = s(STAR_INNER)
  const gap = s(STAR_GAP)
  const origin = -((count - 1) * gap) / 2
  for (let star = 0; star < count; star++) {
    const x = origin + star * gap
    if (filled) {
      traceStar(graphics, x, 0, outer, inner)
      graphics.fillStyle(COLORS.star, 1)
      graphics.fillPath()
      traceStar(graphics, x, 0, outer, inner)
      graphics.lineStyle(max(1, s(0.7)), COLORS.inkMark, ink ? 0.55 : 0.28)
      graphics.strokePath()
      continue
    }
    traceStar(graphics, x, 0, outer, inner)
    graphics.lineStyle(
      max(1, s(0.9)),
      ink ? COLORS.inkMark : tone.color,
      ink ? 0.9 : tone.alpha,
    )
    graphics.strokePath()
  }
}

function traceStar(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  outer: number,
  inner: number,
) {
  graphics.beginPath()
  for (let point = 0; point < 10; point++) {
    const radius = point % 2 === 0 ? outer : inner
    const angle = -Math.PI / 2 + (point * Math.PI) / 5
    const px = x + Math.cos(angle) * radius
    const py = y + Math.sin(angle) * radius
    if (point === 0) graphics.moveTo(px, py)
    else graphics.lineTo(px, py)
  }
  graphics.closePath()
}

function drawBackMark(
  graphics: Phaser.GameObjects.Graphics,
  tone: { color: number; alpha: number },
) {
  graphics.clear()
  graphics.lineStyle(max(1, s(1)), tone.color, tone.alpha)
  const reach = s(3.5)
  graphics.beginPath()
  graphics.moveTo(reach * 0.45, -reach)
  graphics.lineTo(-reach * 0.55, 0)
  graphics.lineTo(reach * 0.45, reach)
  graphics.strokePath()
}
