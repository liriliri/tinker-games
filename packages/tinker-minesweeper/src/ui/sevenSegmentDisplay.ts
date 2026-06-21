import Phaser from 'phaser'

/** Segment geometry from tinker-clock DigitalClock (viewBox ~24×40 per digit). */
const SEGMENT_POINTS = {
  topM: [
    [8, 4],
    [16, 4],
    [18, 6],
    [16, 8],
    [8, 8],
    [6, 6],
  ],
  midd: [
    [8, 18],
    [16, 18],
    [18, 20],
    [16, 22],
    [8, 22],
    [6, 20],
  ],
  topL: [
    [6, 7],
    [8, 9],
    [8, 17],
    [6, 19],
    [4, 17],
    [4, 9],
  ],
  topR: [
    [18, 7],
    [20, 9],
    [20, 17],
    [18, 19],
    [16, 17],
    [16, 9],
  ],
  btmM: [
    [8, 32],
    [16, 32],
    [18, 34],
    [16, 36],
    [8, 36],
    [6, 34],
  ],
  btmL: [
    [6, 21],
    [8, 23],
    [8, 31],
    [6, 33],
    [4, 31],
    [4, 23],
  ],
  btmR: [
    [18, 21],
    [20, 23],
    [20, 31],
    [18, 33],
    [16, 31],
    [16, 23],
  ],
} as const

const SEGMENT_ORDER = [
  'topM',
  'midd',
  'topL',
  'topR',
  'btmM',
  'btmL',
  'btmR',
] as const satisfies ReadonlyArray<keyof typeof SEGMENT_POINTS>

/** Segment on/off per digit, from tinker-clock DigitalClock opacity tables. */
const SEGMENT_ON_BY_DIGIT = {
  topM: [1, 0, 1, 1, 0, 1, 1, 1, 1, 1],
  midd: [0, 0, 1, 1, 1, 1, 1, 0, 1, 1],
  topL: [1, 0, 0, 0, 1, 1, 1, 0, 1, 1],
  topR: [1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
  btmM: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
  btmL: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  btmR: [1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
} as const

const LIT_SEGMENTS: Record<string, readonly boolean[]> = {
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, digit) => [
      String(digit),
      SEGMENT_ORDER.map(
        (key) => SEGMENT_ON_BY_DIGIT[key][digit] === 1,
      ),
    ]),
  ),
  '-': [false, true, false, false, false, false, false],
}

const DIGIT_WIDTH = 20
const DIGIT_HEIGHT = 40

type SevenSegmentOptions = {
  color?: number
  padding?: number
}

function fillSegmentPolygon(
  gfx: Phaser.GameObjects.Graphics,
  points: readonly (readonly [number, number])[],
  offsetX: number,
  offsetY: number,
  scale: number,
) {
  const [firstX, firstY] = points[0]
  gfx.beginPath()
  gfx.moveTo(offsetX + firstX * scale, offsetY + firstY * scale)
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i]
    gfx.lineTo(offsetX + x * scale, offsetY + y * scale)
  }
  gfx.closePath()
  gfx.fillPath()
}

export class SevenSegmentDisplay {
  private readonly gfx: Phaser.GameObjects.Graphics
  private readonly color: number
  private readonly padding: number

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly width: number,
    private readonly height: number,
    options: SevenSegmentOptions = {},
  ) {
    this.gfx = scene.add.graphics()
    this.color = options.color ?? 0xff0000
    this.padding = options.padding ?? 0
  }

  get display() {
    return this.gfx
  }

  destroy() {
    this.gfx.destroy()
  }

  setText(text: string) {
    this.gfx.clear()
    if (!text) return

    const chars = [...text]
    const innerWidth = this.width - this.padding * 2
    const innerHeight = this.height - this.padding * 2
    const scale = Math.min(
      innerWidth / (chars.length * DIGIT_WIDTH),
      innerHeight / DIGIT_HEIGHT,
    )
    const contentWidth = chars.length * DIGIT_WIDTH * scale
    const contentHeight = DIGIT_HEIGHT * scale
    const originX = this.x + (this.width - contentWidth) / 2
    const originY = this.y + (this.height - contentHeight) / 2

    this.gfx.fillStyle(this.color, 1)

    for (let i = 0; i < chars.length; i++) {
      const lit = LIT_SEGMENTS[chars[i]]
      if (!lit) continue

      const digitX = originX + i * DIGIT_WIDTH * scale
      for (let s = 0; s < SEGMENT_ORDER.length; s++) {
        if (!lit[s]) continue
        const key = SEGMENT_ORDER[s]
        fillSegmentPolygon(
          this.gfx,
          SEGMENT_POINTS[key],
          digitX,
          originY,
          scale,
        )
      }
    }
  }
}
