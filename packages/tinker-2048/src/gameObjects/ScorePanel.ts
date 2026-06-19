import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { FIELD_WIDTH } from '../layout'
import { t } from '../i18n'
import { s } from '../scale'
import { createMenuButton } from '../ui/createMenuButton'
import { addSharpText } from '../ui/sharpText'
import { fillSmoothRoundedRect } from '../ui/drawRoundedRect'
import { SCENE_MENU } from '../scenes/keys'

export class ScorePanel {
  private root: Phaser.GameObjects.Container
  private scoreBox!: Phaser.GameObjects.Container
  private scoreText!: Phaser.GameObjects.Text
  private bestScoreText!: Phaser.GameObjects.Text
  private displayedScore: number

  constructor(
    private scene: Phaser.Scene,
    initialBestScore: number,
    initialScore = 0,
  ) {
    this.displayedScore = initialScore
    this.root = scene.add.container(0, 0)
    this.build(initialBestScore, initialScore)
  }

  destroy() {
    this.root.destroy(true)
  }

  getScoreBoxPosition() {
    return { x: this.scoreBox.x, y: this.scoreBox.y }
  }

  updateScore(score: number) {
    const difference = score - this.displayedScore
    this.displayedScore = score
    this.scoreText.setText(String(score))

    if (difference > 0) {
      const pos = this.getScoreBoxPosition()
      const addition = addSharpText(
        this.scene,
        pos.x + s(20),
        pos.y + s(10),
        `+${difference}`,
        25,
        {
          color: 'rgba(119, 110, 101, 0.9)',
          fontStyle: 'bold',
        },
      )
        .setOrigin(0.5)
        .setDepth(200)

      this.scene.tweens.add({
        targets: addition,
        y: addition.y - s(75),
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => addition.destroy(),
      })
    }
  }

  updateBestScore(bestScore: number) {
    this.bestScoreText.setText(String(bestScore))
  }

  private build(initialBestScore: number, initialScore: number) {
    const scoreBoxHeight = 55
    const headerCenterY = 8 + scoreBoxHeight / 2

    const menuBtn = createMenuButton(this.scene, 24, headerCenterY)
    menuBtn.on('pointerup', () => this.scene.scene.start(SCENE_MENU))
    this.root.add(menuBtn)

    const scoreBoxWidth = 75
    const scoreBoxGap = 15
    const centerX = FIELD_WIDTH / 2
    const scoreX = centerX - (scoreBoxWidth + scoreBoxGap) / 2
    const bestX = centerX + (scoreBoxWidth + scoreBoxGap) / 2

    this.scoreBox = this.createScoreBox(t('score'), scoreX, headerCenterY)
    this.scoreText = this.scoreBox.getByName('value') as Phaser.GameObjects.Text
    this.scoreText.setText(String(initialScore))
    this.root.add(this.scoreBox)

    const bestBox = this.createScoreBox(t('best'), bestX, headerCenterY)
    this.bestScoreText = bestBox.getByName('value') as Phaser.GameObjects.Text
    this.bestScoreText.setText(String(initialBestScore))
    this.root.add(bestBox)
  }

  private createScoreBox(label: string, centerX: number, centerY: number) {
    const width = s(75)
    const height = s(55)
    const container = this.scene.add.container(s(centerX), s(centerY))

    const bg = this.scene.add.graphics()
    fillSmoothRoundedRect(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      s(3),
      COLORS.gameContainer,
    )

    const labelText = addSharpText(this.scene, 0, s(-12), label, 13, {
      color: COLORS.scoreLabel,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const valueText = addSharpText(this.scene, 0, s(10), '0', 25, {
      color: '#ffffff',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setName('value')

    container.add([bg, labelText, valueText])
    return container
  }
}
