import Phaser from 'phaser'
import max from 'licia/max'
import { COLORS } from '../game/constants'
import { JIGSAW_SIZES, type JigsawSize } from '../game/Jigsaw'
import { t } from '../lib/i18n'
import { FIELD_WIDTH, HEADER_HEIGHT, HUD_TOP, PAGE_PAD } from '../lib/layout'
import { s } from '../lib/scale'
import { createTextButton } from '../ui/createTextButton'
import { addCountText } from '../ui/sharpText'

const CHIP_WIDTH = 34
const CHIP_HEIGHT = 18
const CHIP_GAP = 4
const BACK_SIZE = 18

const SIZE_LABEL: Record<JigsawSize, 'size3' | 'size4' | 'size5'> = {
  3: 'size3',
  4: 'size4',
  5: 'size5',
}

export class Hud {
  private readonly root: Phaser.GameObjects.Container
  private readonly countText: Phaser.GameObjects.Text

  constructor(
    scene: Phaser.Scene,
    placed: number,
    total: number,
    size: JigsawSize,
    actions: {
      onBack: () => void
      onSize: (size: JigsawSize) => void
    },
  ) {
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

    const rowWidth =
      JIGSAW_SIZES.length * CHIP_WIDTH + (JIGSAW_SIZES.length - 1) * CHIP_GAP
    const chips = JIGSAW_SIZES.map((chipSize, index) => {
      const x =
        FIELD_WIDTH -
        PAGE_PAD -
        rowWidth +
        CHIP_WIDTH / 2 +
        index * (CHIP_WIDTH + CHIP_GAP)
      return createTextButton(
        scene,
        t(SIZE_LABEL[chipSize]),
        x,
        HUD_TOP + HEADER_HEIGHT / 2,
        CHIP_WIDTH,
        CHIP_HEIGHT,
        () => actions.onSize(chipSize),
        { brass: chipSize === size, fontSize: 10 },
      )
    })

    this.root.add([back, this.countText, ...chips])
  }

  setPlaced(placed: number, total: number) {
    this.countText.setText(`${placed}/${total}`)
  }

  destroy() {
    this.root.destroy(true)
  }
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
