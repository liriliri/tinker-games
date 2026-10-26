import { createCanvas, fitLongSide } from '../lib/util'
import { CUSTOM_PICTURE_ID, type GalleryItem } from './gallery'

const MAX_SIDE = 1920

export const PREVIEW_TEXTURE = 'jigsaw-preview'

const canvases = new Map<string, HTMLCanvasElement>()

export function pictureCanvas(id: string) {
  const canvas = canvases.get(id)
  if (!canvas) throw new Error('Picture is not loaded')
  return canvas
}

export async function loadGalleryPictures(items: GalleryItem[]) {
  await Promise.all(
    items.map(async (item) => {
      if (canvases.has(item.id)) return
      canvases.set(item.id, await paintFile(item.file))
    }),
  )
}

export async function rememberLocalPicture(file: Blob) {
  const url = URL.createObjectURL(file)
  try {
    canvases.set(CUSTOM_PICTURE_ID, await paintFile(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function paintFile(file: string) {
  const image = await loadImage(new URL(file, document.baseURI).href)
  const fitted = fitLongSide(image.naturalWidth, image.naturalHeight, MAX_SIDE)
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
