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

const MENU_TITLE_WIDTH = 300
const MENU_TITLE_HEIGHT = 76

export class MenuScene extends Phaser.Scene {
  private background?: MenuBackground
  private buttonItems: {
    container: Phaser.GameObjects.Container
    action: () => void
  }[] = []
  private selectedIndex = 0
  private prevUp = false
  private prevDown = false
  private prevA = false

  constructor() {
    super(SCENE_MENU)
  }

  create() {
    applyRenderScale(this.game)
    this.buildView()

    this.events.on(RELAYOUT_EVENT, this.relayout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)
    this.events.on(Phaser.Scenes.Events.UPDATE, this.pollGamepad, this)
  }

  private buildView() {
    this.background?.destroy()
    this.children.removeAll(true)
    this.buttonItems = []

    this.background = new MenuBackground(this)

    const titleY = 160
    const subtitleY = 230

    const title = this.add
      .image(s(FIELD_WIDTH / 2), s(titleY), 'title')
      .setOrigin(0.5)
    title.setDisplaySize(s(MENU_TITLE_WIDTH), s(MENU_TITLE_HEIGHT))

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
      this.buttonItems.push({ container: btn, action: item.action })
      y += MENU_BUTTON_HEIGHT + MENU_BUTTON_GAP
    }

    this.selectedIndex = 0
    this.updateHighlight()
  }

  private pollGamepad() {
    const pad = this.input.gamepad?.pad1
    if (!pad) return

    if (pad.up && !this.prevUp) {
      this.navigateUp()
    } else if (pad.down && !this.prevDown) {
      this.navigateDown()
    }
    this.prevUp = pad.up
    this.prevDown = pad.down

    if (pad.A && !this.prevA) {
      this.confirmSelected()
    }
    this.prevA = pad.A
  }

  private navigateUp() {
    this.selectedIndex =
      (this.selectedIndex - 1 + this.buttonItems.length) %
      this.buttonItems.length
    this.updateHighlight()
  }

  private navigateDown() {
    this.selectedIndex = (this.selectedIndex + 1) % this.buttonItems.length
    this.updateHighlight()
  }

  private confirmSelected() {
    if (this.buttonItems.length === 0) return
    this.buttonItems[this.selectedIndex].action()
  }

  private updateHighlight() {
    for (let i = 0; i < this.buttonItems.length; i++) {
      if (i === this.selectedIndex) {
        this.buttonItems[i].container.emit('pointerover')
      } else {
        this.buttonItems[i].container.emit('pointerout')
      }
    }
  }

  private relayout() {
    this.buildView()
  }

  private onShutdown() {
    this.events.off(RELAYOUT_EVENT, this.relayout, this)
    this.events.off(Phaser.Scenes.Events.UPDATE, this.pollGamepad, this)
    this.background?.destroy()
    this.background = undefined
  }

  private exit() {
    window.close()
  }
}
