/** Original jump-jump SFX under public/sound/ — Howler for preload + low latency. */

import { Howl, Howler } from 'howler'
import clamp from 'licia/clamp'

const BASE = 'sound'

type SoundName =
  | 'land'
  | 'charge-intro'
  | 'charge-loop'
  | 'restart'
  | 'fall'
  | 'fall-edge'
  | 'pop'
  | 'combo1'
  | 'combo2'
  | 'combo3'
  | 'combo4'
  | 'combo5'
  | 'combo6'
  | 'combo7'
  | 'combo8'

const CHARGE_SOUNDS: SoundName[] = ['charge-intro', 'charge-loop']

const OTHER_SOUNDS: SoundName[] = [
  'land',
  'restart',
  'fall',
  'fall-edge',
  'pop',
  'combo1',
  'combo2',
  'combo3',
  'combo4',
  'combo5',
  'combo6',
  'combo7',
  'combo8',
]

const pool = new Map<SoundName, Howl>()
let charging = false
let chargeIntroId: number | null = null
let chargeLoopId: number | null = null

function ensure(name: SoundName): Howl {
  let sound = pool.get(name)
  if (!sound) {
    sound = new Howl({
      src: [`${BASE}/${name}.mp3`],
      preload: true,
      loop: name === 'charge-loop',
    })
    pool.set(name, sound)
  }
  return sound
}

function play(name: SoundName) {
  const sound = ensure(name)
  sound.stop()
  return sound.play()
}

function stop(name: SoundName) {
  pool.get(name)?.stop()
}

function stopCharge() {
  charging = false
  const intro = pool.get('charge-intro')
  intro?.off('end')
  if (chargeIntroId != null) {
    intro?.stop(chargeIntroId)
    chargeIntroId = null
  }
  stop('charge-intro')
  if (chargeLoopId != null) {
    pool.get('charge-loop')?.stop(chargeLoopId)
    chargeLoopId = null
  }
  stop('charge-loop')
}

/** Prefetch charge SFX first, then the rest — call at game boot. */
export function preloadAudio() {
  for (const name of CHARGE_SOUNDS) ensure(name)
  for (const name of OTHER_SOUNDS) ensure(name)
}

/** Resume AudioContext on first user gesture (autoplay policy). */
export function unlockAudio() {
  if (Howler.ctx?.state === 'suspended') {
    void Howler.ctx.resume()
  }
  for (const name of CHARGE_SOUNDS) ensure(name)
}

export function playCharge() {
  charging = true
  stop('charge-loop')
  chargeLoopId = null
  const intro = ensure('charge-intro')
  intro.off('end')
  chargeIntroId = intro.play()
  intro.once('end', () => {
    if (!charging) return
    chargeLoopId = play('charge-loop')
  })
}

/** Original has no dedicated jump SFX — charge stop is the cue. */
export function playJump() {
  stopCharge()
}

/** Original: always success; on perfect also combo{N} (perfect.mp3 is unused). */
export function playLand(perfect: boolean, comboIndex = 1) {
  if (perfect) {
    const n = clamp(comboIndex, 1, 8)
    play(`combo${n}` as SoundName)
  }
  play('land')
}

export function playFall() {
  stopCharge()
  play('fall')
}

/** Drop off a platform edge (vs open-air miss). */
export function playFallEdge() {
  stopCharge()
  play('fall-edge')
}

export function playPop() {
  play('pop')
}

export function playRestart() {
  stopCharge()
  play('restart')
}
