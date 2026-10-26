// Files live in public/.
export interface GalleryItem {
  id: string
  file: string
}

export const GALLERY: GalleryItem[] = [
  { id: 'maple-steps', file: 'maple-steps.jpg' },
  { id: 'rain-bridge', file: 'rain-bridge.jpg' },
  { id: 'cloud-steps', file: 'cloud-steps.jpg' },
  { id: 'sword-peaks', file: 'sword-peaks.jpg' },
  { id: 'moon-gate', file: 'moon-gate.jpg' },
  { id: 'night-canal', file: 'night-canal.jpg' },
  { id: 'spring-guzheng', file: 'spring-guzheng.jpg' },
  { id: 'cloud-glance', file: 'cloud-glance.jpg' },
  { id: 'hall-lecture', file: 'hall-lecture.jpg' },
  { id: 'window-tea', file: 'window-tea.jpg' },
  { id: 'courtyard-scroll', file: 'courtyard-scroll.jpg' },
  { id: 'eaves-rain', file: 'eaves-rain.jpg' },
  { id: 'snow-duel', file: 'snow-duel.jpg' },
  { id: 'peak-dragon', file: 'peak-dragon.jpg' },
  { id: 'window-lean', file: 'window-lean.jpg' },
]

export function galleryTexture(id: string) {
  return `gallery-${id}`
}
