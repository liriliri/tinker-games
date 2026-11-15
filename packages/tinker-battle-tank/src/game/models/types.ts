/**
 * Kit blueprint for a Battle City tank.
 *
 * Dimensions are metres from claude-tanks (hull AABB + turret/gun anchors);
 * buildTank normalises them into a single cell.
 */
export interface TankKitSpec {
  id: string
  /** Hull width / height / length in metres. */
  hull: { w: number; h: number; l: number }
  /** Turret size and centre offset on the hull roof (metres, +Z forward). */
  turret: { w: number; h: number; l: number; z: number }
  /** Main gun length and calibre radius in metres. */
  gun: { length: number; radius: number }
  /** Road-wheel count along each track. */
  wheels: number
  /** Visual recipe borrowed from the reference silhouette. */
  style: 'patton' | 'abrams' | 'challenger'
  /**
   * Overall beam scale (tracks + hull). Default 1; basic is narrower so it
   * reads apart from the short fast Patton.
   */
  widthScale?: number
  /** Extra gameplay cues (ERA tiles, rear spoiler, etc.). */
  extras?: {
    era?: boolean
    spoiler?: boolean
  }
}
