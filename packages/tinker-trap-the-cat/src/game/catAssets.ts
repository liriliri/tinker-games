import Phaser from 'phaser'
import { CELL_R } from './constants'
import { s } from '../scale'

export const CAT_TEXTURES = {
  bottom_left_1: 'images/bottom_left/1.svg',
  bottom_left_2: 'images/bottom_left/2.svg',
  bottom_left_3: 'images/bottom_left/3.svg',
  bottom_left_4: 'images/bottom_left/4.svg',
  bottom_left_5: 'images/bottom_left/5.svg',
  left_1: 'images/left/1.svg',
  left_2: 'images/left/2.svg',
  left_3: 'images/left/3.svg',
  left_4: 'images/left/4.svg',
  left_5: 'images/left/5.svg',
  top_left_1: 'images/top_left/1.svg',
  top_left_2: 'images/top_left/2.svg',
  top_left_3: 'images/top_left/3.svg',
  top_left_4: 'images/top_left/4.svg',
  top_left_5: 'images/top_left/5.svg',
} as const

export const CAT_ANIMATIONS = [
  {
    name: 'left_step',
    textures: ['left_1', 'left_2', 'left_3', 'left_4', 'left_5'],
    repeat: 0,
  },
  {
    name: 'top_left_step',
    textures: [
      'top_left_1',
      'top_left_2',
      'top_left_3',
      'top_left_4',
      'top_left_5',
    ],
    repeat: 0,
  },
  {
    name: 'bottom_left_step',
    textures: [
      'bottom_left_1',
      'bottom_left_2',
      'bottom_left_3',
      'bottom_left_4',
      'bottom_left_5',
    ],
    repeat: 0,
  },
  {
    name: 'left_run',
    textures: ['left_2', 'left_3', 'left_4', 'left_5'],
    repeat: 3,
  },
  {
    name: 'top_left_run',
    textures: ['top_left_2', 'top_left_3', 'top_left_4', 'top_left_5'],
    repeat: 3,
  },
  {
    name: 'bottom_left_run',
    textures: [
      'bottom_left_2',
      'bottom_left_3',
      'bottom_left_4',
      'bottom_left_5',
    ],
    repeat: 3,
  },
] as const

export const CAT_ORIGINS = {
  left: { x: 0.75, y: 0.75 },
  top_left: { x: 0.63, y: 0.83 },
  bottom_left: { x: 0.65, y: 0.5 },
} as const

export const CAT_STOP_TEXTURES = {
  left: 'left_1',
  top_left: 'top_left_1',
  bottom_left: 'bottom_left_1',
} as const

export const CAT_CANNOT_ESCAPE_TEXTURES = {
  left: 'left_2',
  top_left: 'top_left_2',
  bottom_left: 'bottom_left_2',
} as const

export const CAT_DIRECTIONS = [
  { scaleX: 1, name: 'left' },
  { scaleX: 1, name: 'top_left' },
  { scaleX: -1, name: 'top_left' },
  { scaleX: -1, name: 'left' },
  { scaleX: -1, name: 'bottom_left' },
  { scaleX: 1, name: 'bottom_left' },
] as const

export const CAT_DEFAULT_DIRECTION = 5
export const CAT_STEP_LENGTH = 20
export const CAT_FRAME_RATE = 15

export function getCatTextureScale() {
  return s(CELL_R) / CAT_STEP_LENGTH
}

export function queueCatTextures(scene: Phaser.Scene, textureScale: number) {
  for (const [key, path] of Object.entries(CAT_TEXTURES)) {
    scene.load.svg(key, path, { scale: textureScale })
  }
}
