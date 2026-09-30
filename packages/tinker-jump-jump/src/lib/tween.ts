import clamp from 'licia/clamp'
import max from 'licia/max'
import now from 'licia/now'

type EaseFn = (t: number) => number

const linear: EaseFn = (t) => t

export const easeOutBounce: EaseFn = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t
  if (t < 2 / 2.75) {
    const u = t - 1.5 / 2.75
    return 7.5625 * u * u + 0.75
  }
  if (t < 2.5 / 2.75) {
    const u = t - 2.25 / 2.75
    return 7.5625 * u * u + 0.9375
  }
  const u = t - 2.625 / 2.75
  return 7.5625 * u * u + 0.984375
}

export const easeOutCubic: EaseFn = (t) => 1 - Math.pow(1 - t, 3)

type TweenTarget = Record<string, number>

interface TweenOpts {
  duration: number
  delay?: number
  ease?: EaseFn
  onUpdate?: (value: TweenTarget) => void
  onComplete?: () => void
}

interface ActiveTween {
  from: TweenTarget
  to: TweenTarget
  keys: string[]
  start: number
  duration: number
  delay: number
  ease: EaseFn
  onUpdate?: (value: TweenTarget) => void
  onComplete?: () => void
  killed: boolean
}

const active: ActiveTween[] = []
let raf = 0

function tick() {
  raf = 0
  const tNow = now()
  for (let i = active.length - 1; i >= 0; i--) {
    const tw = active[i]
    if (tw.killed) {
      active.splice(i, 1)
      continue
    }
    const elapsed = tNow - tw.start - tw.delay
    if (elapsed < 0) continue
    const t = clamp(elapsed / tw.duration, 0, 1)
    const e = tw.ease(t)
    const value: TweenTarget = {}
    for (const key of tw.keys) {
      value[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * e
    }
    tw.onUpdate?.(value)
    if (t >= 1) {
      tw.onComplete?.()
      active.splice(i, 1)
    }
  }
  if (active.length) {
    raf = requestAnimationFrame(tick)
  }
}

function tween(
  from: TweenTarget,
  to: TweenTarget,
  opts: TweenOpts,
): () => void {
  const tw: ActiveTween = {
    from: { ...from },
    to: { ...to },
    keys: Object.keys(to),
    start: now(),
    duration: max(1, opts.duration),
    delay: opts.delay ?? 0,
    ease: opts.ease ?? linear,
    onUpdate: opts.onUpdate,
    onComplete: opts.onComplete,
    killed: false,
  }
  active.push(tw)
  if (!raf) raf = requestAnimationFrame(tick)
  return () => {
    tw.killed = true
  }
}

/** Animate numeric properties on an object (mutates in place). */
export function tweenProps(
  target: TweenTarget,
  to: TweenTarget,
  opts: TweenOpts,
): () => void {
  const from: TweenTarget = {}
  for (const key of Object.keys(to)) {
    from[key] = target[key]
  }
  return tween(from, to, {
    ...opts,
    onUpdate: (value) => {
      Object.assign(target, value)
      opts.onUpdate?.(value)
    },
  })
}
