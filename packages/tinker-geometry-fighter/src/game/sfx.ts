import { Howl, Howler } from 'howler'
import randomItem from 'licia/randomItem'

const MASTER_VOLUME = 0.6
Howler.volume(MASTER_VOLUME)

type Sfx = () => void

export function play(sfx: Sfx) {
  sfx()
}

export function playRandom(list: Sfx[]) {
  if (!list.length) return
  play(randomItem(list))
}

export function unlockAudio() {
  if (Howler.ctx?.state === 'suspended') {
    void Howler.ctx.resume()
  }
}

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

// BGM pauses at once. Howler stays up until pause.mp3 ends.
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
    await playPauseHowl()
    if (wantAudioPaused !== paused) {
      await syncAudioPause()
      return
    }
    await syncAudioContext(Howler.ctx, true)
  } else {
    stopPauseHowl()
    await syncAudioContext(Howler.ctx, false)
    releaseBgm()
  }
  if (wantAudioPaused !== paused) await syncAudioPause()
}

async function syncAudioContext(ctx: AudioContext | null, paused: boolean) {
  if (!ctx) return
  if (paused && ctx.state === 'running') await ctx.suspend()
  if (!paused && ctx.state === 'suspended') await ctx.resume()
}

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

const HIT_VOLUME = 0.5
/** Uncapped overlaps of the same hit clip the output. */
const HIT_VOICES = 5
let hitVoices = 0
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

function playHit() {
  if (Howler.ctx?.state === 'suspended') {
    void Howler.ctx.resume()
  }
  if (hitVoices >= HIT_VOICES) return
  hitVoices++
  const howl = ensureHit()
  const id = howl.play()
  let released = false
  const release = () => {
    if (released) return
    released = true
    hitVoices = Math.max(0, hitVoices - 1)
  }
  if (typeof id !== 'number') {
    release()
    return
  }
  howl.once('end', release, id)
  // duration(id) reads the sprite table, which is empty until the file loads.
  const dur = howl.state() === 'loaded' ? howl.duration() : 0
  setTimeout(release, (dur > 0 ? dur : 0.8) * 1000)
}

export const hitSounds: Sfx[] = [playHit]

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
export const itemSound = howlSfx('sound/item.mp3', 1)
export const heroDie = howlSfx('sound/explode.mp3', 0.8)
export const cruiserDie = howlSfx('sound/explode.mp3', 1)
export const cruiserSpawnSound = howlSfx('sound/cruiserspawn.mp3', 1)
