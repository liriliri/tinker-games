import Phaser from 'phaser'
import { initStorage } from '../lib/storage'
import { SCENE_MENU } from './MenuScene'

export const SCENE_BOOT = 'Boot'

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_BOOT)
  }

  preload() {
    this.load.image('title', 'images/title.png')
    this.load.image('soundon', 'images/soundon.png')
    this.load.image('soundoff', 'images/soundoff.png')
    this.load.audio('gameover', 'sound/gameover.mp3')
    this.load.audio('merge', 'sound/merge.mp3')
    this.load.audio('move', 'sound/move.mp3')
  }

  create() {
    initStorage(this.game)
    this.scene.start(SCENE_MENU)
  }
}
