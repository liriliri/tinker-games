import {
  BULLET_INTERVAL,
  BULLET_SPEED,
  MOVE_SPEED,
  TANK_LEVELS,
} from './constants'
import type { Tank, TankLevel } from './types'

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

/** Only an armoured player tank can break steel (power 3). */
export function bulletPower(tank: Tank) {
  if (tank.side === 'player' && tank.level === 'armor') return 3
  if (tank.side === 'bot' && tank.level === 'power') return 2
  return 1
}

export function bulletInterval(tank: Tank) {
  return tank.level === 'basic'
    ? BULLET_INTERVAL.basic
    : BULLET_INTERVAL.upgraded
}

export function bulletLimit(tank: Tank) {
  if (tank.side === 'bot' || tank.level === 'basic' || tank.level === 'fast')
    return 1
  return 2
}

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

export function tankHp(level: TankLevel) {
  return level === 'armor' ? 4 : 1
}

/** Armour is the end of the upgrade chain. */
export function nextTankLevel(level: TankLevel): TankLevel {
  const index = TANK_LEVELS.indexOf(level)
  return TANK_LEVELS[Math.min(index + 1, TANK_LEVELS.length - 1)]
}

export function isMaxLevel(level: TankLevel) {
  return level === 'armor'
}
