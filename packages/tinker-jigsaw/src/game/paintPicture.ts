import min from 'licia/min'
import type { GalleryItem } from './gallery'

export const PICTURE_WIDTH = 1920
export const PICTURE_HEIGHT = 1080

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

async function paintFile(file: string) {
  const image = await loadImage(new URL(file, document.baseURI).href)
  const canvas = document.createElement('canvas')
  canvas.width = PICTURE_WIDTH
  canvas.height = PICTURE_HEIGHT
  const ctx = canvas.getContext('2d')
  if (ctx) drawContain(ctx, image, PICTURE_WIDTH, PICTURE_HEIGHT)
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

// The puzzle is 16:9. A photo with another ratio stays fully visible inside it.
function drawContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const scale = min(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  ctx.drawImage(
    image,
    (width - drawnWidth) / 2,
    (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  )
}
