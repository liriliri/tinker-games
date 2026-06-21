import Phaser from 'phaser'
import clamp from 'licia/clamp'
import debounce from 'licia/debounce'
import {
  computeCellSize,
  computeGamePixelHeight,
} from './gameObjects/gridLayout'
import { FIELD_WIDTH, getReferenceGameHeight } from './layout'

const MIN_FIT_SCALE = 0.5
const MAX_FIT_SCALE = 3
const MAX_RENDER_SCALE = 4
const RESIZE_DEBOUNCE_MS = 150

export const RELAYOUT_EVENT = 'relayout'

let layoutScale = 1
let suppressRelayoutUntil = 0

export function suppressRelayout(ms = 250) {
  suppressRelayoutUntil = Date.now() + ms
}

function shouldSuppressRelayout() {
  return Date.now() < suppressRelayoutUntil
}

function getFitScale(scale: Phaser.Scale.ScaleManager): number {
  let parentWidth = scale.parentSize.width
  let parentHeight = scale.parentSize.height
  if (parentWidth === 0 || parentHeight === 0) {
    parentWidth = window.innerWidth
    parentHeight = window.innerHeight
  }

  const fitScale = Math.min(
    parentWidth / FIELD_WIDTH,
    parentHeight / getReferenceGameHeight(),
  )

  return clamp(fitScale, MIN_FIT_SCALE, MAX_FIT_SCALE)
}

function computeLayoutScale(fitScale: number) {
  const dpr = window.devicePixelRatio || 1
  return clamp(fitScale * dpr, dpr, MAX_RENDER_SCALE)
}

export function applyRenderScale(game: Phaser.Game): boolean {
  const fitScale = getFitScale(game.scale)
  const nextScale = computeLayoutScale(fitScale)
  const width = s(FIELD_WIDTH)
  const height = computeGamePixelHeight(computeCellSize())
  if (width <= 0 || height <= 0) {
    return false
  }

  const scaleChanged = Math.abs(nextScale - layoutScale) > 0.01
  const sizeChanged = game.scale.width !== width || game.scale.height !== height
  if (!scaleChanged && !sizeChanged) {
    return false
  }

  layoutScale = nextScale
  suppressRelayout()
  game.scale.setGameSize(width, height)
  return true
}

export function bindRenderScale(game: Phaser.Game) {
  applyRenderScale(game)

  const onResize = debounce(() => {
    if (shouldSuppressRelayout()) return
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
