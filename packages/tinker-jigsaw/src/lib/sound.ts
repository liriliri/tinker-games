function clip(src: string, volume: number) {
  let audio: HTMLAudioElement | undefined

  const element = () => {
    if (audio) return audio
    audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = volume
    return audio
  }

  return {
    preload() {
      element().load()
    },
    play() {
      const sound = element()
      sound.currentTime = 0
      void sound.play().catch(() => {})
    },
  }
}

const snap = clip('sound/snap.mp3', 0.25)
const menu = clip('sound/select.mp3', 0.65)

export function preloadSnapSound() {
  snap.preload()
}

export function playSnapSound() {
  snap.play()
}

export function preloadMenuSound() {
  menu.preload()
}

export function playMenuSound() {
  menu.play()
}
