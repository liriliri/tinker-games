import Phaser from 'phaser'
import { COLORS, FIELD_WIDTH } from '../game/constants'
import { GAME_HEIGHT } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { addSharpText } from '../ui/sharpText'

export class GameOverlay {
  private container: Phaser.GameObjects.Container

  constructor(private scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(250).setVisible(false)
    this.build()
  }

  destroy() {
    this.container.destroy(true)
  }

  rebuild() {
    this.container.removeAll(true)
    this.build()
  }

  show() {
    this.container.setVisible(true)
  }

  hide() {
    this.container.setVisible(false)
  }

  private build() {
    const backdrop = this.scene.add.graphics()
    backdrop.fillStyle(0x000000, 0.35)
    backdrop.fillRect(0, 0, s(FIELD_WIDTH), s(GAME_HEIGHT))

    const label = addSharpText(
      this.scene,
      s(FIELD_WIDTH / 2),
      s(GAME_HEIGHT / 2),
      t('youWin'),
      28,
      { color: COLORS.scoreText, fontStyle: 'bold' },
    ).setOrigin(0.5)

    this.container.add([backdrop, label])
  }
}

export class Toast {
  private text?: Phaser.GameObjects.Text
  private timer?: Phaser.Time.TimerEvent

  constructor(private scene: Phaser.Scene) {}

  show(message: string) {
    this.hide()
    this.text = addSharpText(
      this.scene,
      s(FIELD_WIDTH / 2),
      s(80),
      message,
      14,
      {
        color: COLORS.scoreText,
        backgroundColor: '#000000aa',
        padding: { x: s(12), y: s(8) },
      },
    )
      .setOrigin(0.5)
      .setDepth(400)

    this.timer = this.scene.time.delayedCall(2000, () => this.hide())
  }

  hide() {
    this.timer?.remove(false)
    this.text?.destroy()
    this.text = undefined
  }

  destroy() {
    this.hide()
  }
}
