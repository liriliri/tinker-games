import type { TankLevel } from '../types'
import type { TankKitSpec } from './types'

/** M48A5 Patton — classic boxy US medium. */
const basicTank: TankKitSpec = {
  id: 'm48a5_patton',
  hull: { w: 3.63, h: 1.15, l: 6.93 },
  turret: { w: 2.48, h: 0.72, l: 2.9, z: 0.35 },
  gun: { length: 2.15, radius: 0.09 },
  wheels: 5,
  style: 'patton',
  // Slimmer beam so basic ≠ fast at a glance (both Patton recipes).
  widthScale: 0.78,
}

/** M46 Patton — shorter hull, reads as the light / fast silhouette. */
const fastTank: TankKitSpec = {
  id: 'm46_patton',
  hull: { w: 3.51, h: 1.05, l: 5.96 },
  turret: { w: 2.06, h: 0.68, l: 2.4, z: 0.15 },
  gun: { length: 1.45, radius: 0.075 },
  wheels: 4,
  style: 'patton',
  extras: { spoiler: true },
}

/** M1A1 Abrams HC — angular wedge turret and long gun. */
const powerTank: TankKitSpec = {
  id: 'm1a1_abrams_hc',
  hull: { w: 3.71, h: 1.12, l: 7.89 },
  turret: { w: 3.4, h: 0.7, l: 3.6, z: 0.2 },
  gun: { length: 3.35, radius: 0.1 },
  wheels: 6,
  style: 'abrams',
}

/** Challenger 2 — chunky British box turret with applique. */
const armorTank: TankKitSpec = {
  id: 'challenger2',
  hull: { w: 3.5, h: 1.2, l: 7.5 },
  turret: { w: 2.9, h: 0.78, l: 3.4, z: 0.55 },
  gun: { length: 2.75, radius: 0.11 },
  wheels: 6,
  style: 'challenger',
  extras: { era: true },
}

/** Per-level kit blueprints (proportions from claude-tanks). */
export const TANK_KITS: Record<TankLevel, TankKitSpec> = {
  basic: basicTank,
  fast: fastTank,
  power: powerTank,
  armor: armorTank,
}
