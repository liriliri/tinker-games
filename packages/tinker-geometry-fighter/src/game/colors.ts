/** Palette order matches Evil Glitch `colors.js`. */
const COLORS = [
  '#FFF',
  'rgba(40,77,153,0.6)',
  'rgba(234,34,37,0.6)',
  'rgba(180,0,50,0.3)',
  '#F952FF',
  'rgba(0,77,153,0.6)',
  'rgb(72,255,206)',
  // Semi-transparent clear — short neon trails without heavy CRT smear.
  'rgba(6,12,22,0.55)',
  'rgba(10,16,28,0.35)',
  'rgb(40,145,160)',
  '#F66',
  '#69F',
  '#32F',
  '#6FF',
  '#066',
  '#0FF',
  'rgba(235,118,71,0.8)',
  '#559',
  '#F6F',
  '#2F2',
  '#000',
  '#973',
  'rgba(0,0,0,0.71)',
  'rgb(6,12,22)',
  'rgba(255,102,192,0.8)',
  'rgba(255,102,102,0.8)',
  'rgba(252,233,128,0.8)',
  'rgba(150,127,254,0.8)',
  'rgba(179,72,108,0.8)',
  'rgba(179,88,52,0.8)',
  'rgba(128,108,26,0.8)',
  'rgba(128,155,15,0.8)',
  'rgba(128,131,51,0.8)',
  'hsla(324,50%, 60%, 0.88)',
  'hsla(360,50%, 60%, 0.88)',
  'hsla(10,50%, 60%, 0.88)',
  'hsla(20,50%, 60%, 0.88)',
  'hsla(30,50%, 60%, 0.88)',
  'rgba(7,8,12,0.2)',
] as const

type Attr = 0 | 1 | 2

export function setContextAttribute(
  ctx: CanvasRenderingContext2D,
  index: number,
  attribute: Attr = 0,
  custom?: string | number,
) {
  const key = (['strokeStyle', 'fillStyle', 'lineWidth'] as const)[attribute]
  ;(ctx as unknown as Record<string, string | number>)[key] =
    custom ?? COLORS[index]
}
