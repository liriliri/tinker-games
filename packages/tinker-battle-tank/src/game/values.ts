import {
  BULLET_INTERVAL,
  BULLET_SPEED,
  MOVE_SPEED,
  TANK_LEVELS,
} from './constants'
import type { Tank, TankLevel } from './types'

/** Movement speed in cells per second. */
export function moveSpeed(tank: Tank) {
  if (tank.side === 'player') {
    return MOVE_SPEED.player
  }
  switch (tank.level) {
    case 'power':
      return MOVE_SPEED.botPower
    case 'fast':
      return MOVE_SPEED.botFast
    default:
      return MOVE_SPEED.botBasic
  }
}

/** Damage a bullet deals; only an armoured player tank can break steel. */
export function bulletPower(tank: Tank) {
  if (tank.side === 'player' && tank.level === 'armor') return 3
  if (tank.side === 'bot' && tank.level === 'power') return 2
  return 1
}

/** Minimum delay between two shots, in milliseconds. */
export function bulletInterval(tank: Tank) {
  return tank.level === 'basic'
    ? BULLET_INTERVAL.basic
    : BULLET_INTERVAL.upgraded
}

/** How many bullets a tank may keep on the field at once. */
export function bulletLimit(tank: Tank) {
  if (tank.side === 'bot' || tank.level === 'basic' || tank.level === 'fast')
    return 1
  return 2
}

/** Bullet speed in cells per second. */
export function bulletSpeed(tank: Tank) {
  if (tank.side === 'player') {
    return tank.level === 'basic'
      ? BULLET_SPEED.playerBasic
      : BULLET_SPEED.playerUpgraded
  }
  switch (tank.level) {
    case 'basic':
      return BULLET_SPEED.botBasic
    case 'power':
      return BULLET_SPEED.botPower
    default:
      return BULLET_SPEED.botOther
  }
}

/** Hit points a tank starts with. */
export function tankHp(level: TankLevel) {
  return level === 'armor' ? 4 : 1
}

/** The next level in the upgrade chain; armour is the last one. */
export function nextTankLevel(level: TankLevel): TankLevel {
  const index = TANK_LEVELS.indexOf(level)
  return TANK_LEVELS[Math.min(index + 1, TANK_LEVELS.length - 1)]
}

/** True when the tank has reached the highest upgrade level. */
export function isMaxLevel(level: TankLevel) {
  return level === 'armor'
}
