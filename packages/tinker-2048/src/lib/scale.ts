import Phaser from 'phaser'
import clamp from 'licia/clamp'
import debounce from 'licia/debounce'
import min from 'licia/min'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'

const MIN_FIT_SCALE = 0.5
const MAX_FIT_SCALE = 3
const MAX_RENDER_SCALE = 4
const RESIZE_DEBOUNCE_MS = 150

export const RELAYOUT_EVENT = 'relayout'

let layoutScale = 1

function getFitScale(scale: Phaser.Scale.ScaleManager): number {
  let parentWidth = scale.parentSize.width
  let parentHeight = scale.parentSize.height
  if (parentWidth === 0 || parentHeight === 0) {
    parentWidth = window.innerWidth
    parentHeight = window.innerHeight
  }

  const fitScale = min(parentWidth / FIELD_WIDTH, parentHeight / GAME_HEIGHT)

  return clamp(fitScale, MIN_FIT_SCALE, MAX_FIT_SCALE)
}

function computeLayoutScale(fitScale: number) {
  const dpr = window.devicePixelRatio || 1
  return clamp(fitScale * dpr, dpr, MAX_RENDER_SCALE)
}

export function applyRenderScale(game: Phaser.Game): boolean {
  const fitScale = getFitScale(game.scale)
  const nextScale = computeLayoutScale(fitScale)
  if (Math.abs(nextScale - layoutScale) <= 0.01) {
    return false
  }

  layoutScale = nextScale
  const width = s(FIELD_WIDTH)
  const height = s(GAME_HEIGHT)
  if (width <= 0 || height <= 0) {
    return false
  }

  if (game.scale.width !== width || game.scale.height !== height) {
    game.scale.setGameSize(width, height)
  }

  return true
}

export function bindRenderScale(game: Phaser.Game) {
  applyRenderScale(game)

  const onResize = debounce(() => {
    if (!applyRenderScale(game)) return

    for (const scene of game.scene.getScenes(true)) {
      scene.events.emit(RELAYOUT_EVENT)
    }
  }, RESIZE_DEBOUNCE_MS)

  game.scale.on(Phaser.Scale.Events.RESIZE, onResize)
}

export function s(value: number) {
  return Math.round(value * layoutScale)
}

export function sf(value: number) {
  return value * layoutScale
}
