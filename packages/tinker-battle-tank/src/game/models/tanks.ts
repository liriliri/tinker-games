import type { TankLevel } from '../types'
import type { TankKitSpec } from './types'
import { armorTank } from './armor'
import { basicTank } from './basic'
import { fastTank } from './fast'
import { powerTank } from './power'

/** Per-level kit blueprints (proportions from claude-tanks). */
export const TANK_KITS: Record<TankLevel, TankKitSpec> = {
  basic: basicTank,
  fast: fastTank,
  power: powerTank,
  armor: armorTank,
}
