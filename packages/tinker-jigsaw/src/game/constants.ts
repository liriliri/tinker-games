import lpad from 'licia/lpad'

export const SOLVED_FADE_MS = 640
export const REST_SATURATION = -0.85

const INK = 0x111111
const PAPER = 0xe7e1d6
const STAR = 0xf2c14e

function css(color: number) {
  return `#${lpad(color.toString(16), 6, '0')}`
}

export const COLORS = {
  page: '#161513',
  pageMark: 0x161513,
  brass: PAPER,
  brassHover: 0xf7f4ee,
  brassActive: 0xcfc6b6,
  ink: css(INK),
  inkMark: INK,
  paper: css(PAPER),
  paperMark: PAPER,
  // Darker than the page, so a print sits in a recess.
  mat: 0x0c0b0a,
  star: STAR,
  starText: css(STAR),
  button: 0x000000,
  buttonHover: 0x141414,
  buttonActive: 0x0a0a0a,
}
