import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { bindRenderScale } from './scale'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'
import { setLocale } from './i18n'

// Patch Phaser GamepadPlugin.stopListeners to safely handle null gamepad entries.
// Phaser 3.90.0 bug: stopListeners iterates this.gamepads[i].removeAllListeners()
// without null-checking entries that may have been cleaned up during scene transitions.
const GamepadPluginProto = (Phaser.Input.Gamepad as Record<string, unknown>)
  .GamepadPlugin as { prototype: { stopListeners: () => void } } | undefined
if (GamepadPluginProto?.prototype?.stopListeners) {
  GamepadPluginProto.prototype.stopListeners = function (this: {
    target?: EventTarget
    onGamepadHandler?: (e: Event) => void
    sceneInputPlugin?: {
      pluginEvents?: { off: (e: string, fn: unknown) => void }
    }
    gamepads?: Array<{ removeAllListeners: () => void } | undefined>
    update?: unknown
  }) {
    this.target?.removeEventListener('gamepadconnected', this.onGamepadHandler!)
    this.target?.removeEventListener(
      'gamepaddisconnected',
      this.onGamepadHandler!,
    )
    this.sceneInputPlugin?.pluginEvents?.off('update', this.update)
    if (this.gamepads) {
      for (let i = 0; i < this.gamepads.length; i++) {
        this.gamepads[i]?.removeAllListeners()
      }
    }
  } as unknown as () => void
}

async function initLanguage() {
  if (typeof tinker !== 'undefined') {
    try {
      const lang = await tinker.getLanguage()
      setLocale(lang)
    } catch {
      // Fall back to navigator.language (already the default)
    }
  }
}

async function init() {
  await initLanguage()

  new Phaser.Game({
    type: Phaser.AUTO,
    width: FIELD_WIDTH,
    height: GAME_HEIGHT,
    parent: document.body,
    backgroundColor: '#faf8ef',
    render: {
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      gamepad: true,
    },
    callbacks: {
      postBoot: (game) => {
        bindRenderScale(game)
      },
    },
    scene: [BootScene, MenuScene, GameScene],
  })
}

init()
