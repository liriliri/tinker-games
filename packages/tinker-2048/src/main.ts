import Phaser from 'phaser'
import { MenuScene } from './scenes/MenuScene'
import { GameScene } from './scenes/GameScene'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'
import { applyResponsiveScale, getFitScale, setLayoutScale } from './scale'

const RESIZE_DEBOUNCE_MS = 150

let lastLayoutScale = 0
let resizeTimer: ReturnType<typeof setTimeout> | null = null

function restartActiveScene(game: Phaser.Game) {
  const activeScenes = game.scene.getScenes(true)
  const active = activeScenes[activeScenes.length - 1]
  if (!active) return
  active.scene.restart(active.scene.sys.settings.data)
}

function refreshLayout(game: Phaser.Game) {
  const fitScale = getFitScale(game.scale)
  if (Math.abs(fitScale - lastLayoutScale) <= 0.01) return

  lastLayoutScale = fitScale
  setLayoutScale(fitScale)

  requestAnimationFrame(() => {
    restartActiveScene(game)
  })
}

function scheduleLayoutRefresh(game: Phaser.Game) {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    resizeTimer = null
    refreshLayout(game)
  }, RESIZE_DEBOUNCE_MS)
}

const config: Phaser.Types.Core.GameConfig = {
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
  callbacks: {
    postBoot: (game) => {
      lastLayoutScale = applyResponsiveScale(game)

      game.scale.on(Phaser.Scale.Events.RESIZE, () => {
        scheduleLayoutRefresh(game)
      })
    },
  },
  scene: [MenuScene, GameScene],
}

new Phaser.Game(config)
