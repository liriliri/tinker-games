export function motionDuration(ms: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0
  return ms
}
