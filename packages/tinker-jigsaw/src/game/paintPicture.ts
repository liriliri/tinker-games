import { createCanvas, fitLongSide } from '../lib/util'
import { CUSTOM_PICTURE_ID, galleryThumb, type GalleryItem } from './gallery'

const MAX_SIDE = 1920

export const PREVIEW_TEXTURE = 'jigsaw-preview'

const thumbs = new Map<string, HTMLCanvasElement>()
const pictures = new Map<string, HTMLCanvasElement>()

export function thumbCanvas(id: string) {
  const canvas = thumbs.get(id)
  if (!canvas) throw new Error('Thumb is not loaded')
  return canvas
}

export function pictureCanvas(id: string) {
  const canvas = pictures.get(id)
  if (!canvas) throw new Error('Picture is not loaded')
  return canvas
}

export async function loadGalleryThumbs(items: GalleryItem[]) {
  await Promise.all(
    items.map(async (item) => {
      if (thumbs.has(item.id)) return
      thumbs.set(item.id, await paintFile(galleryThumb(item.file)))
    }),
  )
}

export async function loadPicture(item: GalleryItem) {
  if (pictures.has(item.id)) return
  pictures.set(item.id, await paintFile(item.file, MAX_SIDE))
}

export async function rememberLocalPicture(file: Blob) {
  const url = URL.createObjectURL(file)
  try {
    pictures.set(CUSTOM_PICTURE_ID, await paintFile(url, MAX_SIDE))
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function paintFile(file: string, maxSide?: number) {
  const image = await loadImage(new URL(file, document.baseURI).href)
  const fitted = maxSide
    ? fitLongSide(image.naturalWidth, image.naturalHeight, maxSide)
    : { width: image.naturalWidth, height: image.naturalHeight }
  const { canvas, ctx } = createCanvas(fitted.width, fitted.height)
  if (ctx) ctx.drawImage(image, 0, 0, fitted.width, fitted.height)
  return canvas
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${src}`))
    image.src = src
  })
}
