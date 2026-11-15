import type { TankKitSpec } from './types'

/** Challenger 2 — chunky British box turret with applique. */
export const armorTank: TankKitSpec = {
  id: 'challenger2',
  hull: { w: 3.5, h: 1.2, l: 7.5 },
  turret: { w: 2.9, h: 0.78, l: 3.4, z: 0.55 },
  gun: { length: 2.75, radius: 0.11 },
  wheels: 6,
  style: 'challenger',
  extras: { era: true },
}
