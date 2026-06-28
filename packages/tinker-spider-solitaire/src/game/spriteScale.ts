import Phaser from 'phaser'
import { CARD_HEIGHT, CARD_WIDTH } from './constants'
import { s } from '../scale'

export function sizeCardSprite(image: Phaser.GameObjects.Image) {
  return image.setDisplaySize(s(CARD_WIDTH), s(CARD_HEIGHT))
}

export function scaledCardWidth() {
  return s(CARD_WIDTH)
}

export function scaledCardHeight() {
  return s(CARD_HEIGHT)
}
