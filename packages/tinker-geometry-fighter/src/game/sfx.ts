import * as Tone from 'tone'
import { Howl, Howler } from 'howler'
import randomItem from 'licia/randomItem'

/** One-shot SFX trigger — Tone.js synths, same call sites as the old jsfxr buffers. */
type Sfx = () => void

let ready = false
let bus: Tone.ToneAudioNode | null = null

function ensureGraph() {
  if (ready) return
  const volume = new Tone.Volume(-10).toDestination()
  const comp = new Tone.Compressor({
    threshold: -18,
    ratio: 4,
    attack: 0.003,
    release: 0.15,
  })
  comp.connect(volume)
  bus = comp
  ready = true
}

async function boot() {
  ensureGraph()
  await Tone.start()
}

function disposeLater(nodes: Tone.ToneAudioNode[], seconds: number) {
  Tone.getContext().setTimeout(() => {
    for (const n of nodes) {
      try {
        n.dispose()
      } catch {
        // already disposed
      }
    }
  }, seconds)
}

function now() {
  return Tone.now()
}

function noiseBurst(
  type: Tone.NoiseType,
  decay: number,
  filterFreq: number,
  volume = -8,
): Sfx {
  return () => {
    ensureGraph()
    if (!bus) return
    const t = now()
    const noise = new Tone.Noise(type)
    const filter = new Tone.Filter(filterFreq, 'lowpass')
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.001,
      decay,
      sustain: 0,
      release: 0.02,
    })
    const vol = new Tone.Volume(volume)
    noise.connect(filter)
    filter.connect(env)
    env.connect(vol)
    vol.connect(bus)
    noise.start(t)
    env.triggerAttackRelease(decay + 0.02, t)
    noise.stop(t + decay + 0.05)
    disposeLater([noise, filter, env, vol], decay + 0.3)
  }
}

function chord(freqs: number[], dur: number, volume = -14): Sfx {
  return () => {
    ensureGraph()
    if (!bus) return
    const t = now()
    const nodes: Tone.ToneAudioNode[] = []
    for (const f of freqs) {
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: dur, sustain: 0.05, release: 0.15 },
        volume,
      }).connect(bus)
      synth.triggerAttackRelease(f, dur, t)
      nodes.push(synth)
    }
    disposeLater(nodes, dur + 0.4)
  }
}

export function play(sfx: Sfx) {
  void boot().then(sfx)
}

export function playRandom(list: Sfx[]) {
  if (!list.length) return
  play(randomItem(list))
}

export function unlockAudio() {
  void boot()
}

/** Looping in-game BGM from public/sound/bgm.mp3 */
const BGM_VOLUME = 0.55
let bgm: Howl | null = null
let bgmId: number | undefined

function ensureBgm() {
  if (bgm) return bgm
  bgm = new Howl({
    src: ['sound/bgm.mp3'],
    loop: true,
    volume: BGM_VOLUME,
    preload: true,
  })
  return bgm
}

export function startGameMusic() {
  const sound = ensureBgm()
  if (Howler.ctx?.state === 'suspended') {
    void Howler.ctx.resume()
  }
  if (bgmId !== undefined && sound.playing(bgmId)) return
  sound.stop()
  sound.volume(BGM_VOLUME)
  bgmId = sound.play()
}

export function stopGameMusic(fadeSec = 0.5) {
  if (!bgm || bgmId === undefined) return
  const id = bgmId
  bgmId = undefined
  if (fadeSec > 0) {
    bgm.fade(BGM_VOLUME, 0, fadeSec * 1000, id)
    bgm.once('fade', () => bgm?.stop(id), id)
  } else {
    bgm.stop(id)
  }
}

// Howler and Tone each own a context. BGM pauses at once; Howler stays up until pause.mp3 ends.
let wantAudioPaused = false
let audioPauseChain: Promise<void> = Promise.resolve()
let bgmHeldForPause = false
let pauseHowl: Howl | null = null
let pauseHowlId: number | undefined

const PAUSE_VOLUME = 1

function ensurePauseHowl() {
  if (pauseHowl) return pauseHowl
  pauseHowl = new Howl({
    src: ['sound/pause.mp3'],
    volume: PAUSE_VOLUME,
    preload: true,
  })
  return pauseHowl
}

function holdBgm() {
  if (!bgm || bgmId === undefined || !bgm.playing(bgmId)) return
  bgm.pause(bgmId)
  bgmHeldForPause = true
}

function releaseBgm() {
  if (!bgmHeldForPause) return
  bgmHeldForPause = false
  if (!bgm || bgmId === undefined || bgm.playing(bgmId)) return
  bgm.play(bgmId)
}

function stopPauseHowl() {
  if (!pauseHowl || pauseHowlId === undefined) return
  pauseHowl.stop(pauseHowlId)
  pauseHowlId = undefined
}

function playPauseHowl() {
  const sound = ensurePauseHowl()
  stopPauseHowl()
  const id = sound.play()
  pauseHowlId = id
  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      if (pauseHowlId === id) pauseHowlId = undefined
      resolve()
    }
    sound.once('end', done, id)
    sound.once('stop', done, id)
    sound.once('playerror', done, id)
    setTimeout(done, 1600)
  })
}

export function pauseGameAudio() {
  setAudioPaused(true)
}

export function resumeGameAudio() {
  stopPauseHowl()
  setAudioPaused(false)
}

function setAudioPaused(paused: boolean) {
  wantAudioPaused = paused
  audioPauseChain = audioPauseChain
    .then(syncAudioPause)
    .catch(() => syncAudioPause())
}

async function syncAudioPause() {
  const paused = wantAudioPaused
  if (paused) {
    holdBgm()
    await syncAudioContext(Tone.getContext().rawContext as AudioContext, true)
    await playPauseHowl()
    if (wantAudioPaused !== paused) {
      await syncAudioPause()
      return
    }
    await syncAudioContext(Howler.ctx, true)
  } else {
    stopPauseHowl()
    await syncAudioContext(Howler.ctx, false)
    await syncAudioContext(Tone.getContext().rawContext as AudioContext, false)
    releaseBgm()
  }
  if (wantAudioPaused !== paused) await syncAudioPause()
}

async function syncAudioContext(ctx: AudioContext | null, paused: boolean) {
  if (!ctx) return
  if (paused && ctx.state === 'running') await ctx.suspend()
  if (!paused && ctx.state === 'suspended') await ctx.resume()
}

export const gameStarts = chord([196, 247, 311, 392], 0.35, -12)

const FIRE_VOLUME = 0.22
let fireHowl: Howl | null = null

function ensureFire() {
  if (fireHowl) return fireHowl
  fireHowl = new Howl({
    src: ['sound/fire.mp3'],
    volume: FIRE_VOLUME,
    preload: true,
  })
  return fireHowl
}

export const fireSounds: Sfx[] = [
  () => {
    if (Howler.ctx?.state === 'suspended') {
      void Howler.ctx.resume()
    }
    ensureFire().play()
  },
]

// OpenGW: one SOUNDID_ENEMYHIT track (restart, never stacked). Allow 2 for a bit of body.
let enemyDieVoices = 0

/** Same noise as a shared enemy death, louder or quieter per kind. */
export function playEnemyBoom(volume: number) {
  play(() => {
    if (enemyDieVoices >= 2) return
    enemyDieVoices++
    noiseBurst('pink', 0.32, 3200, volume)()
    Tone.getContext().setTimeout(() => {
      enemyDieVoices = Math.max(0, enemyDieVoices - 1)
    }, 0.35)
  })
}

const HIT_VOLUME = 0.5
let hitHowl: Howl | null = null

function ensureHit() {
  if (hitHowl) return hitHowl
  hitHowl = new Howl({
    src: ['sound/hit.mp3'],
    volume: HIT_VOLUME,
    preload: true,
  })
  return hitHowl
}

export const hitSounds: Sfx[] = [
  () => {
    if (Howler.ctx?.state === 'suspended') {
      void Howler.ctx.resume()
    }
    ensureHit().play()
  },
]

const BOMB_VOLUME = 0.8
let bombHowl: Howl | null = null

function ensureBomb() {
  if (bombHowl) return bombHowl
  bombHowl = new Howl({
    src: ['sound/bomb.mp3'],
    volume: BOMB_VOLUME,
    preload: true,
  })
  return bombHowl
}

export const bombSound: Sfx = () => {
  if (Howler.ctx?.state === 'suspended') {
    void Howler.ctx.resume()
  }
  ensureBomb().play()
}

function howlSfx(src: string, volume: number): Sfx {
  let sound: Howl | null = null
  return () => {
    if (Howler.ctx?.state === 'suspended') {
      void Howler.ctx.resume()
    }
    if (!sound) {
      sound = new Howl({ src: [src], volume, preload: true })
    }
    sound.play()
  }
}

export const extraLifeSound = howlSfx('sound/extralife.mp3', 1)
export const extraBombSound = howlSfx('sound/extrabomb.mp3', 1)
export const powerupSound = howlSfx('sound/powerup.mp3', 1)
export const heroDie = howlSfx('sound/explode.mp3', 0.8)
export const cruiserDie = howlSfx('sound/explode.mp3', 1)
export const cruiserSpawnSound = howlSfx('sound/cruiserspawn.mp3', 1)
