import Phaser from 'phaser'
import {
  COLORS,
  GRID_SPACING,
  GRID_SIZE,
  TILE_BORDER_RADIUS,
  TRANSITION_SPEED,
  GAME_CONTAINER_BORDER_RADIUS,
  getTileStyle,
  type TileStyle,
} from '../game/constants'
import { GAME_CONTAINER_Y, FIELD_WIDTH } from '../layout'
import {
  GameManager,
  type Actuator,
  type GameMetadata,
} from '../game/GameManager'
import type { Grid } from '../game/Grid'
import { InputManager } from '../game/InputManager'
import { LocalStorageManager } from '../game/LocalStorageManager'
import { SessionManager } from '../game/SessionManager'
import type { Position, Tile } from '../game/Tile'
import { t } from '../i18n'
import { applyResponsiveScale, s } from '../scale'
import { createButton } from '../ui/createButton'
import { createMenuButton } from '../ui/createMenuButton'
import {
  fillSmoothRoundedRect,
  strokeSmoothRoundedRect,
} from '../ui/drawRoundedRect'
import { addSharpText, sharpTextStyle } from '../ui/sharpText'

export interface GameSceneData {
  fresh?: boolean
}

export class GameScene extends Phaser.Scene implements Actuator {
  private inputManager = new InputManager()
  private storageManager = new LocalStorageManager()
  private sessionManager = new SessionManager()
  private freshStart = false
  private tileLayer!: Phaser.GameObjects.Container
  private scoreText!: Phaser.GameObjects.Text
  private bestScoreText!: Phaser.GameObjects.Text
  private scoreBox!: Phaser.GameObjects.Container
  private messageContainer!: Phaser.GameObjects.Container
  private messageText!: Phaser.GameObjects.Text
  private keepPlayingBtn!: Phaser.GameObjects.Container
  private retryBtn!: Phaser.GameObjects.Container
  private displayedScore = 0
  private gameBounds!: Phaser.Geom.Rectangle
  private tileSize = 0

  constructor() {
    super('Game')
  }

  init(data: GameSceneData = {}) {
    this.freshStart = data.fresh === true
    this.sessionManager.markInSession()
    if (this.freshStart) {
      this.storageManager.clearGameState()
      this.sessionManager.bumpGameGeneration()
    }
  }

  create() {
    applyResponsiveScale(this.game)

    this.tileSize = this.computeTileSize()

    this.drawHeader()
    this.drawGameBoard()
    this.createMessageOverlay()

    this.tileLayer = this.add.container(0, 0)
    this.tileLayer.setDepth(10)

    this.gameBounds = new Phaser.Geom.Rectangle(
      s(GRID_SPACING),
      s(GAME_CONTAINER_Y),
      s(FIELD_WIDTH),
      s(FIELD_WIDTH),
    )

    new GameManager(
      this.inputManager,
      this.storageManager,
      this.sessionManager,
      this,
    )

    this.inputManager.bindKeyboard(this)
    this.inputManager.bindSwipe(this, this.gameBounds)
  }

  actuate(grid: Grid, metadata: GameMetadata) {
    this.clearTiles()
    grid.eachCell((_x, _y, tile) => {
      if (tile) this.addTile(tile)
    })
    this.updateScore(metadata.score)
    this.updateBestScore(metadata.bestScore)
    if (metadata.terminated) {
      if (metadata.over) {
        this.showMessage(false)
      } else if (metadata.won) {
        this.showMessage(true)
      }
    }
  }

  continueGame() {
    this.hideMessage()
  }

  private computeTileSize() {
    const spacing = s(GRID_SPACING)
    const field = s(FIELD_WIDTH)
    return Math.floor((field - spacing * (GRID_SIZE + 1)) / GRID_SIZE)
  }

  private clearTiles() {
    this.tileLayer.removeAll(true)
  }

  private tilePosition(position: Position) {
    return {
      x: s(GRID_SPACING) + position.x * (this.tileSize + s(GRID_SPACING)),
      y:
        s(GAME_CONTAINER_Y) +
        s(GRID_SPACING) +
        position.y * (this.tileSize + s(GRID_SPACING)),
    }
  }

  private createTileVisual(
    value: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const style = getTileStyle(value)
    const half = this.tileSize / 2
    const container = this.add.container(x + half, y + half)

    const bg = this.add.graphics()
    fillSmoothRoundedRect(
      bg,
      -half,
      -half,
      this.tileSize,
      this.tileSize,
      s(TILE_BORDER_RADIUS),
      style.bg,
    )

    if (style.glow) {
      strokeSmoothRoundedRect(
        bg,
        -half,
        -half,
        this.tileSize,
        this.tileSize,
        s(TILE_BORDER_RADIUS),
        0xffffff,
        style.glow / 3,
      )
    }

    const text = this.add
      .text(
        0,
        0,
        String(value),
        sharpTextStyle(style.fontSize, {
          color: style.text,
          fontStyle: 'bold',
        }),
      )
      .setOrigin(0.5)

    container.add([bg, text])
    return container
  }

  private addTile(tile: Tile) {
    const position = tile.previousPosition ?? { x: tile.x, y: tile.y }
    const { x, y } = this.tilePosition(position)
    const half = this.tileSize / 2

    if (tile.mergedFrom) {
      tile.mergedFrom.forEach((merged) => this.addTile(merged))

      const container = this.createTileVisual(tile.value, x, y)
      this.tileLayer.add(container)
      container.setScale(0)
      this.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        delay: TRANSITION_SPEED,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: container,
            scaleX: 1,
            scaleY: 1,
            duration: 100,
            ease: 'Cubic.easeIn',
          })
        },
      })
      return
    }

    const container = this.createTileVisual(tile.value, x, y)
    this.tileLayer.add(container)

    if (tile.previousPosition) {
      const target = this.tilePosition({ x: tile.x, y: tile.y })
      this.tweens.add({
        targets: container,
        x: target.x + half,
        y: target.y + half,
        duration: TRANSITION_SPEED,
        ease: 'Cubic.easeInOut',
      })
    } else {
      container.setScale(0)
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
        delay: TRANSITION_SPEED,
        ease: 'Back.easeOut',
      })
    }
  }

  private drawHeader() {
    const scoreBoxHeight = 55
    const headerCenterY = 8 + scoreBoxHeight / 2

    const menuBtn = createMenuButton(this, 24, headerCenterY)
    menuBtn.on('pointerup', () => this.scene.start('Menu'))

    const scoreBoxWidth = 75
    const scoreBoxGap = 15
    const centerX = FIELD_WIDTH / 2
    const scoreX = centerX - (scoreBoxWidth + scoreBoxGap) / 2
    const bestX = centerX + (scoreBoxWidth + scoreBoxGap) / 2

    const scoreBox = this.createScoreBox(t('score'), scoreX, headerCenterY)
    this.scoreText = scoreBox.getByName('value') as Phaser.GameObjects.Text
    this.scoreBox = scoreBox

    const bestBox = this.createScoreBox(t('best'), bestX, headerCenterY)
    this.bestScoreText = bestBox.getByName('value') as Phaser.GameObjects.Text
    this.bestScoreText.setText(String(this.storageManager.getBestScore()))
  }

  private createScoreBox(label: string, centerX: number, centerY: number) {
    const width = s(75)
    const height = s(55)
    const container = this.add.container(s(centerX), s(centerY))

    const bg = this.add.graphics()
    fillSmoothRoundedRect(
      bg,
      -width / 2,
      -height / 2,
      width,
      height,
      s(3),
      COLORS.gameContainer,
    )

    const labelText = addSharpText(this, 0, s(-12), label, 13, {
      color: COLORS.scoreLabel,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const valueText = addSharpText(this, 0, s(10), '0', 25, {
      color: '#ffffff',
      fontStyle: 'bold',
    })
      .setOrigin(0.5)
      .setName('value')

    container.add([bg, labelText, valueText])
    return container
  }

  private drawGameBoard() {
    const gfx = this.add.graphics()
    fillSmoothRoundedRect(
      gfx,
      0,
      s(GAME_CONTAINER_Y),
      s(FIELD_WIDTH),
      s(FIELD_WIDTH),
      s(GAME_CONTAINER_BORDER_RADIUS),
      COLORS.gameContainer,
    )

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        const pos = this.tilePosition({ x, y })
        fillSmoothRoundedRect(
          gfx,
          pos.x,
          pos.y,
          this.tileSize,
          this.tileSize,
          s(TILE_BORDER_RADIUS),
          COLORS.cell,
        )
      }
    }
  }

  private createMessageOverlay() {
    this.messageContainer = this.add.container(0, s(GAME_CONTAINER_Y))
    this.messageContainer.setVisible(false)

    const overlay = this.add.graphics()
    overlay.setName('overlay')

    this.messageText = addSharpText(this, s(FIELD_WIDTH / 2), s(222), '', 60, {
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.keepPlayingBtn = createButton(
      this,
      t('keepGoing'),
      FIELD_WIDTH / 2 - 70,
      340,
      130,
      40,
    )
    this.keepPlayingBtn.setVisible(false)
    this.keepPlayingBtn.on('pointerup', () =>
      this.inputManager.emitKeepPlaying(),
    )

    this.retryBtn = createButton(
      this,
      t('tryAgain'),
      FIELD_WIDTH / 2 + 70,
      340,
      110,
      40,
    )
    this.retryBtn.on('pointerup', () => this.inputManager.emitRestart())

    this.messageContainer.add([
      overlay,
      this.messageText,
      this.keepPlayingBtn,
      this.retryBtn,
    ])
    this.messageContainer.setDepth(100)
  }

  private showMessage(won: boolean) {
    const overlay = this.messageContainer.getByName(
      'overlay',
    ) as Phaser.GameObjects.Graphics
    overlay.clear()
    overlay.fillStyle(won ? COLORS.winOverlay : COLORS.gameOverOverlay, 0.5)
    overlay.fillRect(0, 0, s(FIELD_WIDTH), s(FIELD_WIDTH))

    this.messageText.setText(won ? t('youWin') : t('gameOver'))
    this.messageText.setColor(won ? COLORS.brightText : COLORS.text)
    this.keepPlayingBtn.setVisible(won)

    if (won) {
      this.retryBtn.setPosition(s(FIELD_WIDTH / 2 + 70), s(340))
    } else {
      this.retryBtn.setPosition(s(FIELD_WIDTH / 2), s(340))
    }

    this.messageContainer.setVisible(true)
    this.messageContainer.setAlpha(0)
    this.tweens.add({
      targets: this.messageContainer,
      alpha: 1,
      duration: 800,
      delay: TRANSITION_SPEED * 12,
    })
  }

  private hideMessage() {
    this.messageContainer.setVisible(false)
    this.messageContainer.setAlpha(1)
  }

  private updateScore(score: number) {
    const difference = score - this.displayedScore
    this.displayedScore = score
    this.scoreText.setText(String(score))

    if (difference > 0) {
      const addition = addSharpText(
        this,
        this.scoreBox.x + s(20),
        this.scoreBox.y + s(10),
        `+${difference}`,
        25,
        {
          color: 'rgba(119, 110, 101, 0.9)',
          fontStyle: 'bold',
        },
      )
        .setOrigin(0.5)
        .setDepth(200)

      this.tweens.add({
        targets: addition,
        y: addition.y - s(75),
        alpha: 0,
        duration: 600,
        ease: 'Cubic.easeIn',
        onComplete: () => addition.destroy(),
      })
    }
  }

  private updateBestScore(bestScore: number) {
    this.bestScoreText.setText(String(bestScore))
  }
}
