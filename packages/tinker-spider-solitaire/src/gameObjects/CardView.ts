import Phaser from 'phaser'
import type { Card } from '../game/SpiderBoard'
import { getCardTextureKey } from '../game/cardAssets'
import {
  sizeCardSprite,
  scaledCardHeight,
  scaledCardWidth,
} from '../game/spriteScale'

export class CardView extends Phaser.GameObjects.Container {
  readonly cardId: number
  private front: Phaser.GameObjects.Image
  private back: Phaser.GameObjects.Image
  private faceUp = false

  constructor(scene: Phaser.Scene, card: Card) {
    super(scene, 0, 0)
    this.cardId = card.id

    const key = getCardTextureKey(card.suit, card.rank)
    this.back = sizeCardSprite(scene.add.image(0, 0, 'backside').setOrigin(0.5))
    this.front = sizeCardSprite(scene.add.image(0, 0, key).setOrigin(0.5))

    this.add([this.back, this.front])
    this.setSize(scaledCardWidth(), scaledCardHeight())
    this.setFaceUp(card.faceUp)
  }

  setFaceUp(value: boolean) {
    this.faceUp = value
    this.back.setVisible(!value)
    this.front.setVisible(value)
  }

  setHighlight(active: boolean) {
    this.setScale(active ? 1.02 : 1)
  }
}
