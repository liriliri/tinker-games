import Phaser from 'phaser'
import { COLORS, GAME_CONTAINER_MARGIN_BOTTOM } from '../game/constants'
import { FIELD_WIDTH, GAME_HEIGHT } from '../layout'
import { t } from '../i18n'
import { getSession, getStorage } from '../registry'
import { applyRenderScale, RELAYOUT_EVENT, s } from '../scale'
import { createButton } from '../ui/createButton'
import { addSharpText } from '../ui/sharpText'
import { MenuBackground } from './MenuBackground'
import { SCENE_GAME, SCENE_MENU } from './keys'

const MENU_BUTTON_WIDTH = 200
const MENU_BUTTON_HEIGHT = 48
const MENU_BUTTON_GAP = 16

export class MenuScene extends Phaser.Scene {
  private background?: MenuBackground

  constructor() {
    super(SCENE_MENU)
  }

  create() {
    applyRenderScale(this.game)
    this.buildView()

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
  }

  private buildView() {
    this.background?.destroy()
    this.children.removeAll(true)

    this.background = new MenuBackground(this)

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

    const storage = getStorage(this)
    const session = getSession(this)
    const items: { label: string; action: () => void }[] = []

    if (storage.hasResumableGame(session)) {
      items.push({
        label: t('continue'),
        action: () => this.scene.start(SCENE_GAME),
      })
    }

    items.push(
      {
        label: t('newGame'),
        action: () => {
          storage.clearGameState()
          session.bumpGameGeneration()
          this.scene.start(SCENE_GAME)
        },
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

  private relayout() {
    this.buildView()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.background?.destroy()
    this.background = undefined
  }

  private exit() {
    window.close()
  }
}
