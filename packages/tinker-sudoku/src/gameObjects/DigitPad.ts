import Phaser from 'phaser'
import { DIGIT_PAD_BUTTON_GAP, DIGIT_PAD_ROW_HEIGHT } from '../game/constants'
import { DIGIT_PAD_CENTER_Y, FIELD_WIDTH } from '../layout'
import { createButton } from '../ui/createButton'

export interface DigitPadCallbacks {
  onDigit: (digit: number) => void
}

export class DigitPad {
  private container: Phaser.GameObjects.Container

  constructor(
    private scene: Phaser.Scene,
    private callbacks: DigitPadCallbacks,
  ) {
    this.container = scene.add.container(0, 0)
    this.container.setDepth(10)
    this.build()
  }

  destroy() {
    this.container.destroy(true)
  }

  private build() {
    this.container.removeAll(true)

    const totalWidth = 9 * DIGIT_PAD_ROW_HEIGHT + 8 * DIGIT_PAD_BUTTON_GAP
    const startX = (FIELD_WIDTH - totalWidth) / 2 + DIGIT_PAD_ROW_HEIGHT / 2
    const buttonY = DIGIT_PAD_CENTER_Y

    for (let digit = 1; digit <= 9; digit++) {
      const index = digit - 1
      const button = createButton(
        this.scene,
        String(digit),
        startX + index * (DIGIT_PAD_ROW_HEIGHT + DIGIT_PAD_BUTTON_GAP),
        buttonY,
        DIGIT_PAD_ROW_HEIGHT,
        DIGIT_PAD_ROW_HEIGHT,
        22,
        true,
      )
      button.on('pointerup', () => this.callbacks.onDigit(digit))
      this.container.add(button)
    }
  }
}
