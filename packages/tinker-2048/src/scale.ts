import Phaser from 'phaser'
import { FIELD_WIDTH, GAME_HEIGHT } from './layout'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

let layoutScale = 1
let gameRef: Phaser.Game | null = null

function bindGame(game: Phaser.Game) {
  gameRef = game
}

export function setLayoutScale(scale: number) {
  if (Number.isFinite(scale) && scale > 0) {
    layoutScale = scale
  }
}

export function s(value: number) {
  return Math.round(value * layoutScale)
}

export function sf(value: number) {
  return value * layoutScale
}

export function scaledFont(designPx: number) {
  return `${s(designPx)}px`
}

export function getTextResolution() {
  const dpr = window.devicePixelRatio || 1
  let cssScale = 1

  if (gameRef) {
    const gameWidth = gameRef.scale.gameSize.width
    const displayWidth = gameRef.scale.canvasBounds.width
    if (gameWidth > 0 && displayWidth > 0) {
      cssScale = displayWidth / gameWidth
    }
  }

  const resolution = layoutScale * dpr * cssScale
  return Math.min(Math.max(resolution, 1), 4)
}

export function getFitScale(scale: Phaser.Scale.ScaleManager): number {
  let parentWidth = scale.parentSize.width
  let parentHeight = scale.parentSize.height
  if (parentWidth === 0 || parentHeight === 0) {
    parentWidth = window.innerWidth
    parentHeight = window.innerHeight
  }

  const fitScale = Math.min(
    parentWidth / FIELD_WIDTH,
    parentHeight / GAME_HEIGHT,
  )

  return Phaser.Math.Clamp(fitScale, MIN_SCALE, MAX_SCALE)
}

export function applyResponsiveScale(game: Phaser.Game): number {
  bindGame(game)

  const fitScale = getFitScale(game.scale)
  if (!Number.isFinite(fitScale) || fitScale <= 0) {
    return layoutScale
  }

  layoutScale = fitScale
  const width = s(FIELD_WIDTH)
  const height = s(GAME_HEIGHT)
  if (width <= 0 || height <= 0) {
    return layoutScale
  }

  if (game.scale.width !== width || game.scale.height !== height) {
    game.scale.setGameSize(width, height)
  }

  return fitScale
}
