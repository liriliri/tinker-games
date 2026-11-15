import type { TankKitSpec } from './types'

/** M1A1 Abrams HC — angular wedge turret and long gun. */
export const powerTank: TankKitSpec = {
  id: 'm1a1_abrams_hc',
  hull: { w: 3.71, h: 1.12, l: 7.89 },
  turret: { w: 3.4, h: 0.7, l: 3.6, z: 0.2 },
  gun: { length: 3.35, radius: 0.1 },
  wheels: 6,
  style: 'abrams',
}
