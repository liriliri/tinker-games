import Phaser from 'phaser'
import { COLORS } from '../game/constants'
import { LocalStorageManager } from '../game/LocalStorageManager'
import { FIELD_WIDTH, GAME_HEIGHT } from '../layout'
import { GAME_CONTAINER_MARGIN_BOTTOM } from '../game/constants'
import { t } from '../i18n'
import { applyResponsiveScale, s } from '../scale'
import { createButton } from '../ui/createButton'
import { addSharpText } from '../ui/sharpText'
import { MenuBackground } from './MenuBackground'

const MENU_BUTTON_WIDTH = 200
const MENU_BUTTON_HEIGHT = 48
const MENU_BUTTON_GAP = 16

export class MenuScene extends Phaser.Scene {
  private storageManager = new LocalStorageManager()

  constructor() {
    super('Menu')
  }

  create() {
    applyResponsiveScale(this.game)
    new MenuBackground(this)

    const titleY = 160
    const subtitleY = 230

    addSharpText(this, s(FIELD_WIDTH / 2), s(titleY), '2048', 80, {
      color: COLORS.text,
      fontStyle: 'bold',
    }).setOrigin(0.5)

    const prefix = addSharpText(this, 0, s(subtitleY), t('introPrefix'), 18, {
      color: COLORS.text,
    })
    const bold = addSharpText(this, 0, s(subtitleY), t('introBold'), 18, {
      color: COLORS.text,
      fontStyle: 'bold',
    })
    prefix.setX(s(FIELD_WIDTH / 2) - (prefix.width + bold.width) / 2)
    bold.setX(prefix.x + prefix.width)

    const items: { label: string; action: () => void }[] = []

    if (this.storageManager.hasResumableGame()) {
      items.push({
        label: t('continue'),
        action: () => this.scene.start('Game', { fresh: false }),
      })
    }

    items.push(
      {
        label: t('newGame'),
        action: () => this.scene.start('Game', { fresh: true }),
      },
      { label: t('exit'), action: () => this.exit() },
    )

    const totalHeight =
      items.length * MENU_BUTTON_HEIGHT + (items.length - 1) * MENU_BUTTON_GAP
    let y = subtitleY + 70
    const remaining = GAME_HEIGHT - y - GAME_CONTAINER_MARGIN_BOTTOM
    if (totalHeight < remaining) {
      y += (remaining - totalHeight) / 2
    }

    for (const item of items) {
      const btn = createButton(
        this,
        item.label,
        FIELD_WIDTH / 2,
        y + MENU_BUTTON_HEIGHT / 2,
        MENU_BUTTON_WIDTH,
        MENU_BUTTON_HEIGHT,
        18,
      )
      btn.on('pointerup', item.action)
      y += MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP
    }
  }

  private exit() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.close()
  }
}
