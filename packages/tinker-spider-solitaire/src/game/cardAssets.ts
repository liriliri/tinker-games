import Phaser from 'phaser'

export const CARD_TEXTURE_NAMES = [
  'spades2',
  'spades3',
  'spades4',
  'spades5',
  'spades6',
  'spades7',
  'spades8',
  'spades9',
  'spades10',
  'spadesj',
  'spadesq',
  'spadesk',
  'spadesa',
  'heats2',
  'heats3',
  'heats4',
  'heats5',
  'heats6',
  'heats7',
  'heats8',
  'heats9',
  'heats10',
  'heatsj',
  'heatsq',
  'heatsk',
  'heatsa',
  'diamonds2',
  'diamonds3',
  'diamonds4',
  'diamonds5',
  'diamonds6',
  'diamonds7',
  'diamonds8',
  'diamonds9',
  'diamonds10',
  'diamondsj',
  'diamondsq',
  'diamondsk',
  'diamondsa',
  'clubs2',
  'clubs3',
  'clubs4',
  'clubs5',
  'clubs6',
  'clubs7',
  'clubs8',
  'clubs9',
  'clubs10',
  'clubsj',
  'clubsq',
  'clubsk',
  'clubsa',
] as const

export function getCardTextureKey(suit: number, rank: number): string {
  return CARD_TEXTURE_NAMES[suit * 13 + rank]
}

export function preloadGameAssets(scene: Phaser.Scene) {
  scene.load.image('backside', 'images/backside.png')

  for (const name of CARD_TEXTURE_NAMES) {
    scene.load.image(name, `images/cards/${name}.png`)
  }
}
