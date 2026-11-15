import type { TankKitSpec } from './types'

/** M46 Patton — shorter hull, reads as the light / fast silhouette. */
export const fastTank: TankKitSpec = {
  id: 'm46_patton',
  hull: { w: 3.51, h: 1.05, l: 5.96 },
  turret: { w: 2.06, h: 0.68, l: 2.4, z: 0.15 },
  gun: { length: 1.45, radius: 0.075 },
  wheels: 4,
  style: 'patton',
  extras: { spoiler: true },
}
