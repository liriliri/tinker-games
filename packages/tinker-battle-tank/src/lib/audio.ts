import { Howl, Howler } from 'howler'

export type SoundName =
  | 'bullet_shot'
  | 'bullet_hit_1'
  | 'bullet_hit_2'
  | 'explosion_1'
  | 'explosion_2'
  | 'game_over'
  | 'pause'
  | 'powerup_appear'
  | 'powerup_pick'
  | 'stage_start'
  | 'statistics_1'

const SOUND_FILES: Record<SoundName, string> = {
  bullet_shot: 'sound/bullet_shot.mp3',
  bullet_hit_1: 'sound/bullet_hit_1.mp3',
  bullet_hit_2: 'sound/bullet_hit_2.mp3',
  explosion_1: 'sound/explosion_1.mp3',
  explosion_2: 'sound/explosion_2.mp3',
  game_over: 'sound/game_over.mp3',
  pause: 'sound/pause.mp3',
  powerup_appear: 'sound/powerup_appear.mp3',
  powerup_pick: 'sound/powerup_pick.mp3',
  stage_start: 'sound/stage_start.mp3',
  statistics_1: 'sound/statistics_1.mp3',
}

/**
 * Thin wrapper around Howler that lazily unlocks the audio context on the
 * first user gesture, as browsers require.
 */
export class AudioManager {
  private readonly sounds = new Map<SoundName, Howl>()
  private unlocked = false
  private muted = false

  constructor() {
    for (const [name, file] of Object.entries(SOUND_FILES) as [
      SoundName,
      string,
    ][]) {
      this.sounds.set(
        name,
        new Howl({
          src: [file],
          preload: true,
          volume: this.volumeFor(name),
        }),
      )
    }

    const unlock = () => this.unlock()
    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('gamepadconnected', unlock, { once: true })
  }

  private volumeFor(name: SoundName) {
    switch (name) {
      case 'bullet_shot':
        return 0.32
      case 'bullet_hit_1':
      case 'bullet_hit_2':
        return 0.45
      case 'explosion_1':
        return 0.5
      case 'explosion_2':
        return 0.5
      case 'stage_start':
        return 0.55
      case 'game_over':
        return 0.6
      default:
        return 0.5
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) {
      Howler.mute(true)
    } else {
      Howler.mute(false)
    }
  }

  isMuted() {
    return this.muted
  }

  private unlock() {
    if (this.unlocked) return
    if (Howler.ctx?.state === 'suspended') {
      void Howler.ctx.resume()
    }
    this.unlocked = true
  }

  play(name: SoundName, volume = 1, rate = 1) {
    if (this.muted) return
    const sound = this.sounds.get(name)
    if (!sound) return
    sound.volume(volume * this.volumeFor(name))
    sound.rate(rate)
    sound.play()
  }
}
