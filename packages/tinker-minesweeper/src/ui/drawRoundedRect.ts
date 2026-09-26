import Phaser from 'phaser'
import { drawBevelBorder } from './drawCell'

export function drawRaisedRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  lightColor: number,
  darkColor: number,
  bevel = 2,
) {
  drawBevelBorder(
    gfx,
    x,
    y,
    width,
    height,
    bevel,
    fillColor,
    lightColor,
    darkColor,
    true,
  )
}

export function drawSunkenRect(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  lightColor: number,
  darkColor: number,
  bevel = 2,
) {
  drawBevelBorder(
    gfx,
    x,
    y,
    width,
    height,
    bevel,
    fillColor,
    lightColor,
    darkColor,
    false,
  )
}

export function drawSunkenBorder(
  gfx: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  lightColor: number,
  darkColor: number,
  bevel = 2,
) {
  drawBevelBorder(
    gfx,
    x,
    y,
    width,
    height,
    bevel,
    0,
    lightColor,
    darkColor,
    false,
    false,
  )
}
