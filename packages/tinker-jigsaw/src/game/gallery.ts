// Listed from easier to harder.
export interface GalleryItem {
  id: string
  file: string
}

// A picture chosen from disk is not one of the gallery plates, so it has no clear to keep.
export const CUSTOM_PICTURE_ID = 'custom'

export function keepsScore(id: string) {
  return id !== CUSTOM_PICTURE_ID
}

export const GALLERY: GalleryItem[] = [
  { id: 'rain-bridge', file: 'images/rain-bridge.jpg' },
  { id: 'maple-steps', file: 'images/maple-steps.jpg' },
  { id: 'night-canal', file: 'images/night-canal.jpg' },
  { id: 'window-tea', file: 'images/window-tea.jpg' },
  { id: 'snow-duel', file: 'images/snow-duel.jpg' },
  { id: 'cloud-glance', file: 'images/cloud-glance.jpg' },
  { id: 'courtyard-scroll', file: 'images/courtyard-scroll.jpg' },
  { id: 'sword-peaks', file: 'images/sword-peaks.jpg' },
  { id: 'cloud-steps', file: 'images/cloud-steps.jpg' },
  { id: 'hall-lecture', file: 'images/hall-lecture.jpg' },
  { id: 'moon-gate', file: 'images/moon-gate.jpg' },
  { id: 'window-lean', file: 'images/window-lean.jpg' },
  { id: 'spring-guzheng', file: 'images/spring-guzheng.jpg' },
  { id: 'peak-dragon', file: 'images/peak-dragon.jpg' },
  { id: 'eaves-rain', file: 'images/eaves-rain.jpg' },
]

export function galleryTexture(id: string) {
  return `gallery-${id}`
}
