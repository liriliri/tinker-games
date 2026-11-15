import type { TankKitSpec } from './types'

/** M48A5 Patton — classic boxy US medium. */
export const basicTank: TankKitSpec = {
  id: 'm48a5_patton',
  hull: { w: 3.63, h: 1.15, l: 6.93 },
  turret: { w: 2.48, h: 0.72, l: 2.9, z: 0.35 },
  gun: { length: 2.15, radius: 0.09 },
  wheels: 5,
  style: 'patton',
  // Slimmer beam so basic ≠ fast at a glance (both Patton recipes).
  widthScale: 0.78,
}
