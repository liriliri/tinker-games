import Phaser from 'phaser'
import lpad from 'licia/lpad'
import max from 'licia/max'
import { COLORS } from '../game/constants'
import { BAR_HEIGHT, FIELD_WIDTH, PAGE_PAD } from '../lib/layout'
import { s } from '../lib/scale'
import type { SplitRank } from '../lib/storage'
import { createTextButton } from '../ui/createTextButton'
import { addCountText } from '../ui/sharpText'
import {
  fillStar,
  STAR_GAP,
  STAR_INNER,
  STAR_OUTER,
  traceStar,
} from '../ui/traceStar'

const CHIP_HEIGHT = 26
const CHIP_GAP = 6
const CHIP_PAD_X = 4
const BACK_SIZE = 22
const COUNT_GAP = 14

export class Hud {
  private readonly root: Phaser.GameObjects.Container
  private readonly countText: Phaser.GameObjects.Text
  private readonly timeText: Phaser.GameObjects.Text
  private readonly redrawChips: Array<() => void> = []
  private best: SplitRank | null

  constructor(
    scene: Phaser.Scene,
    placed: number,
    total: number,
    levels: number[],
    level: number,
    best: SplitRank | null,
    elapsedMs: number,
    actions: {
      onBack: () => void
      onLevel: (level: number) => void
    },
  ) {
    this.best = best
    this.root = scene.add.container(0, 0).setDepth(10)
    const midY = BAR_HEIGHT / 2
    const back = createTextButton(
      scene,
      '',
      PAGE_PAD + BACK_SIZE / 2,
      midY,
      BACK_SIZE,
      BACK_SIZE,
      actions.onBack,
      { round: true, mark: drawBackMark },
    )

    this.countText = addCountText(
      scene,
      s(PAGE_PAD + BACK_SIZE + COUNT_GAP),
      s(midY),
      `${placed}/${total}`,
      14,
      { color: COLORS.paper },
    ).setOrigin(0, 0.5)

    this.timeText = addCountText(
      scene,
      s(FIELD_WIDTH / 2),
      s(midY - 1),
      formatClock(elapsedMs),
      18,
      { color: COLORS.starText },
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
        midY,
        width,
        CHIP_HEIGHT,
        () => actions.onLevel(chipLevel),
        {
          bare: true,
          bindRedraw: (redraw) => this.redrawChips.push(redraw),
          mark: (graphics, tone) => {
            drawStars(
              graphics,
              index + 1,
              this.best !== null && index <= this.best,
              chipLevel === level,
              tone.alpha >= 1,
            )
          },
        },
      )
    })

    this.root.add([back, this.countText, this.timeText, ...chips])
  }

  setPlaced(placed: number, total: number) {
    this.countText.setText(`${placed}/${total}`)
  }

  setTime(elapsedMs: number) {
    const text = formatClock(elapsedMs)
    if (text === this.timeText.text) return
    this.timeText.setText(text)
  }

  setBest(best: SplitRank | null) {
    this.best = best
    for (const redraw of this.redrawChips) redraw()
  }

  destroy() {
    this.root.destroy(true)
  }
}

function formatClock(elapsedMs: number) {
  const total = Math.floor(max(0, elapsedMs) / 1000)
  return `${lpad(String(Math.floor(total / 60)), 2, '0')}:${lpad(String(total % 60), 2, '0')}`
}

function starChipWidth(count: number) {
  return CHIP_PAD_X * 2 + STAR_OUTER * 2 + (count - 1) * STAR_GAP
}

function drawStars(
  graphics: Phaser.GameObjects.Graphics,
  count: number,
  filled: boolean,
  selected: boolean,
  hot: boolean,
) {
  graphics.clear()
  const outer = s(STAR_OUTER)
  const inner = s(STAR_INNER)
  const gap = s(STAR_GAP)
  const origin = -((count - 1) * gap) / 2
  const color = selected ? COLORS.star : COLORS.paperMark
  for (let star = 0; star < count; star++) {
    const x = origin + star * gap
    if (filled) {
      fillStar(graphics, x, 0, outer, inner, max(1, s(0.6)), 0.35, color)
      continue
    }
    traceStar(graphics, x, 0, outer, inner)
    graphics.lineStyle(max(1, s(0.9)), color, selected ? 1 : hot ? 0.8 : 0.4)
    graphics.strokePath()
  }
}

function drawBackMark(
  graphics: Phaser.GameObjects.Graphics,
  tone: { color: number; alpha: number },
) {
  graphics.clear()
  graphics.lineStyle(max(1, s(1.15)), tone.color, tone.alpha)
  const reach = s(3.6)
  graphics.beginPath()
  graphics.moveTo(reach * 0.4, -reach)
  graphics.lineTo(-reach * 0.55, 0)
  graphics.lineTo(reach * 0.4, reach)
  graphics.strokePath()
}
