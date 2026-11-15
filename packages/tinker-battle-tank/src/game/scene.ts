import * as THREE from 'three'
import each from 'licia/each'
import random from 'licia/random'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import {
  BRICK_GRID,
  BRICK_SIZE,
  FIELD_BLOCKS,
  FIELD_SIZE,
  HALF_FIELD,
  STEEL_GRID,
  STEEL_SIZE,
} from './constants'
import type { Battlefield } from './battlefield'
import { createGradePass } from './grade'
import { augmentWetConcrete, createWetGroundSystem } from './puddles'
import type { WetGroundSystem } from './puddles'
import { createSea, DECK_CLEARANCE, ISLAND_TOP_Y } from './sea'
import type { SeaSystem } from './sea'
import { createSkyDome } from './sky'
import type { Bullet, Direction, PowerUp, Tank, TankLevel } from './types'
import {
  createBrickGeometry,
  createBrickMaps,
  createBrickMaterial,
  createBulletModel,
  createConcreteMaps,
  createConcreteMaterial,
  createEagleModel,
  createGroundPlane,
  createPowerUpModel,
  createShieldModel,
  createSteelGeometry,
  createSteelMaps,
  createSteelMaterial,
  createTankModel,
  createTreeGeometry,
  createRiverFloorMaterial,
  createRiverCurbGeometry,
  createRiverCurbMaterial,
  createRiverMaterial,
  RIVER_DEPTH,
  RIVER_WATER_OFFSET,
  resolveBotPalette,
  TANK_PALETTES,
  type ConcreteMaps,
  type TankPalette,
} from './models'
import { applyCamoMap } from './models/camo'

/** Camera tilt away from a perfect top-down view, in radians. */
const CAMERA_TILT = (20 * Math.PI) / 180
const CAMERA_DISTANCE = 24

/** Extra room around the field so the border never touches the screen edge. */
const FIELD_PADDING = 0.7
/** Vertical margin so top/bottom also show beach + sea (not just left/right). */
const FIELD_PADDING_Y = 3.6

/** Open-sea extent beyond the steel quay — fills wide / tall viewports. */
const SEA_SIZE = 96
/** Half of the reference 3/16-cell bullet — centres the mesh on its hitbox. */
const BULLET_HALF = 3 / 32

interface MuzzleLocal {
  x: number
  y: number
  z: number
}

interface TankVisual {
  group: THREE.Group
  shield: THREE.Mesh
  level: TankLevel
  /** Body/light/dark meshes that flash for armor HP and power-up carriers. */
  tintMeshes: THREE.Mesh[]
  lastPaletteKey: string
  /** Gun tip in tank-local space (model faces +Z). */
  muzzleLocal: MuzzleLocal
}

interface Explosion {
  group: THREE.Group
  flash: THREE.Mesh
  fire: THREE.Mesh[]
  smoke: THREE.Mesh[]
  age: number
  duration: number
}

interface MuzzleFlash {
  group: THREE.Group
  sparks: THREE.Mesh[]
  flash: THREE.Mesh
  age: number
  duration: number
}

interface PowerUpVisual {
  group: THREE.Group
  phase: number
}

function cellToWorld(x: number, y: number) {
  return { x: x - HALF_FIELD, z: y - HALF_FIELD }
}

function directionRotation(direction: Direction) {
  switch (direction) {
    case 'down':
      return 0
    case 'right':
      return Math.PI / 2
    case 'up':
      return Math.PI
    default:
      return -Math.PI / 2
  }
}

export class BattleScene {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly riverWater = createRiverMaterial(
    new THREE.Vector3(11, 13, 7),
    FIELD_SIZE,
  )
  private sunPosition = new THREE.Vector3(11, 13, 7)
  private wetGround?: WetGroundSystem
  private sea?: SeaSystem
  private arenaConcrete?: ConcreteMaps
  /** Island plateau height — all battlefield props sit on this. */
  private groundY = 0

  private brickMesh?: THREE.InstancedMesh
  private steelMesh?: THREE.InstancedMesh
  /** Continuous river water sheet (masked to river cells — no tile seams). */
  private riverMesh?: THREE.Mesh
  /** Full-field concrete slab under the deck — seals river holes so sand never shows. */
  private riverUnderlay?: THREE.Mesh
  private riverWallMesh?: THREE.InstancedMesh
  private snowMesh?: THREE.InstancedMesh
  private treeMesh?: THREE.InstancedMesh
  private eagleMesh?: THREE.Group
  private eagleLight?: THREE.PointLight

  private readonly tankVisuals = new Map<number, TankVisual>()
  private readonly bulletVisuals = new Map<number, THREE.Group>()
  private readonly powerUpVisuals = new Map<number, PowerUpVisual>()
  private readonly explosions: Explosion[] = []
  private readonly muzzleFlashes: MuzzleFlash[] = []
  private readonly resizeObserver?: ResizeObserver

  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
  private readonly matrix = new THREE.Matrix4()
  private readonly color = new THREE.Color()
  private readonly muzzleWorld = new THREE.Vector3()
  /** Orthographic zoom — 1 fits the whole field; higher = closer. */
  private viewZoom = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // Tone mapping happens in OutputPass after the saltline-style grade.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.camera.position.set(
      0,
      CAMERA_DISTANCE * Math.cos(CAMERA_TILT),
      CAMERA_DISTANCE * Math.sin(CAMERA_TILT),
    )
    this.camera.lookAt(0, 0, 0)

    this.setupLights()
    this.buildGround()

    // Beauty (linear) → saltline grade → ACES + sRGB via OutputPass.
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.composer.addPass(createGradePass())
    this.composer.addPass(new OutputPass())

    this.resize()

    // The host app can resize the game container without firing a window
    // resize event, so watch the canvas box itself.
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    window.addEventListener('resize', () => this.resize())
  }

  /**
   * Saltline-inspired lighting: warm keyed sun, cool sky fill, soft contact
   * shadows — less flat ambient so materials read with real contrast.
   */
  private setupLights() {
    const haze = 0x9aabbc
    // Sky dome provides the backdrop (and puddle reflections); solid colour is fallback.
    this.scene.background = new THREE.Color(haze)
    this.scene.fog = new THREE.Fog(haze, 36, 90)

    this.scene.add(new THREE.AmbientLight(0xa8b8c8, 0.22))

    const hemisphere = new THREE.HemisphereLight(0xc8dcff, 0x3e3226, 0.62)
    this.scene.add(hemisphere)

    const sun = new THREE.DirectionalLight(0xffe2c0, 2.4)
    // Lower angle → longer cinematic shadows across the field.
    sun.position.copy(this.sunPosition)
    this.riverWater.uniforms.uSunDir.value.copy(this.sunPosition).normalize()
    this.scene.add(createSkyDome(this.sunPosition))
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    // Match saltline's soft-shadow bias / radius.
    sun.shadow.bias = -0.00012
    sun.shadow.normalBias = 0.025
    // Softer / lighter — tall border walls otherwise stamp a heavy band on the beach.
    sun.shadow.radius = 4.5
    sun.shadow.intensity = 0.52
    const shadowCamera = sun.shadow.camera
    const extent = FIELD_SIZE * 0.95
    shadowCamera.left = -extent
    shadowCamera.right = extent
    shadowCamera.top = extent
    shadowCamera.bottom = -extent
    shadowCamera.near = 1
    shadowCamera.far = 56
    shadowCamera.updateProjectionMatrix()
    this.scene.add(sun)
    this.scene.add(sun.target)

    const fill = new THREE.DirectionalLight(0xa8c4ff, 0.38)
    fill.position.set(-7, 9, -11)
    this.scene.add(fill)

    const rim = new THREE.DirectionalLight(0x7ea2ff, 0.48)
    rim.position.set(-11, 7, 5)
    this.scene.add(rim)
  }

  private buildGround() {
    // Saltline-style sea beyond the steel quay; wet puddles only on the arena.
    const concrete = createConcreteMaps(512)
    this.arenaConcrete = concrete
    this.wetGround = createWetGroundSystem(FIELD_SIZE)

    // Outer edge of the 28×28 steel ring (see buildBorderRail) → ±7.
    const quayHalf = (FIELD_BLOCKS + 1) * STEEL_SIZE
    this.sea = createSea({
      size: SEA_SIZE,
      quayHalf,
      sunDirection: this.sunPosition,
      renderer: this.renderer,
    })
    this.scene.add(this.sea.mesh)

    const sandTop = this.sea.islandTopY ?? ISLAND_TOP_Y
    // Deck sits clear of sand dunes so nothing bleeds through the concrete.
    this.groundY = sandTop + DECK_CLEARANCE

    const arenaMaterial = createConcreteMaterial(concrete, {
      repeat: 6,
      // Slightly lighter dry slab so dark wet basins read clearly.
      color: 0xd0d5dc,
      exclusive: true,
    })
    augmentWetConcrete(arenaMaterial, this.wetGround.uniforms)

    const arena = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_SIZE, FIELD_SIZE),
      arenaMaterial,
    )
    arena.rotation.x = -Math.PI / 2
    arena.position.y = this.groundY + 0.01
    arena.receiveShadow = true
    this.scene.add(arena)

    this.buildBorderRail(this.groundY)
  }

  /** New random puddle layout for each stage / game start. */
  reshuffleWetGround() {
    this.wetGround?.reshuffle()
  }

  /**
   * Square steel plates on a regular ring just outside the field.
   * One plate per grid cell — even seams, no stretch, corners once only.
   */
  private buildBorderRail(islandY = ISLAND_TOP_Y) {
    const seg = STEEL_SIZE
    const height = 0.52
    // 28×28 ring → outer edge at ±7, flush outside the ±6.5 field.
    const n = (FIELD_BLOCKS + 1) * 2
    const half = (n * seg) / 2
    const total = n * 4 - 4

    const material = createSteelMaterial(createSteelMaps(128))
    material.color.setHex(0xb8c2d0)
    // Slight overlap so seams don’t flash sand without a black sill underlay.
    const geometry = new THREE.BoxGeometry(seg * 1.02, height, seg * 1.02)
    const mesh = new THREE.InstancedMesh(geometry, material, total)
    mesh.castShadow = true
    mesh.receiveShadow = true

    let index = 0
    const place = (col: number, row: number) => {
      const x = -half + seg / 2 + col * seg
      const z = -half + seg / 2 + row * seg
      this.matrix.compose(
        new THREE.Vector3(x, islandY + height / 2, z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      )
      mesh.setMatrixAt(index, this.matrix)
      const shade = 0.78 + ((index * 29 + col * 11 + row * 17) % 9) * 0.045
      this.color.setRGB(shade, shade * 1.02, shade * 1.05)
      mesh.setColorAt(index, this.color)
      index += 1
    }

    for (let i = 0; i < n; i += 1) {
      place(i, 0)
      place(i, n - 1)
    }
    for (let j = 1; j < n - 1; j += 1) {
      place(0, j)
      place(n - 1, j)
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor!.needsUpdate = true
    this.scene.add(mesh)
  }

  buildTerrain(field: Battlefield) {
    this.disposeTerrain()
    this.cacheBrickRects(field)

    const brickMaterial = createBrickMaterial(createBrickMaps(128))
    this.brickMesh = new THREE.InstancedMesh(
      createBrickGeometry(),
      brickMaterial,
      BRICK_GRID * BRICK_GRID,
    )
    this.brickMesh.castShadow = true
    this.brickMesh.receiveShadow = true
    this.brickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let index = 0; index < BRICK_GRID * BRICK_GRID; index += 1) {
      if (!field.bricks[index]) {
        this.brickMesh.setMatrixAt(index, this.hiddenMatrix)
        continue
      }
      const rect = field.brickRect(index)
      this.setInstance(
        this.brickMesh,
        index,
        rect.x + BRICK_SIZE / 2,
        rect.y + BRICK_SIZE / 2,
        BRICK_SIZE / 2,
        this.brickScaleY(index),
      )
      this.tintBrick(index)
    }
    this.brickMesh.instanceMatrix.needsUpdate = true
    // instanceColor only exists after setColorAt — empty maps never tint.
    if (this.brickMesh.instanceColor)
      this.brickMesh.instanceColor.needsUpdate = true
    this.scene.add(this.brickMesh)

    const steelMaterial = createSteelMaterial(createSteelMaps(128))
    this.steelMesh = new THREE.InstancedMesh(
      createSteelGeometry(),
      steelMaterial,
      STEEL_GRID * STEEL_GRID,
    )
    this.steelMesh.castShadow = true
    this.steelMesh.receiveShadow = true
    this.steelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    for (let index = 0; index < STEEL_GRID * STEEL_GRID; index += 1) {
      if (!field.steels[index]) {
        this.steelMesh.setMatrixAt(index, this.hiddenMatrix)
        continue
      }
      const rect = field.steelRect(index)
      this.setInstance(
        this.steelMesh,
        index,
        rect.x + STEEL_SIZE / 2,
        rect.y + STEEL_SIZE / 2,
        STEEL_SIZE / 2,
      )
      this.tintSteel(index)
    }
    this.steelMesh.instanceMatrix.needsUpdate = true
    if (this.steelMesh.instanceColor)
      this.steelMesh.instanceColor.needsUpdate = true
    this.scene.add(this.steelMesh)

    // River trough: concrete underlay (seals holes) + curb on the rim.
    // Do NOT augmentWetConcrete — that shader discards river UVs and would erase the trough.
    const bedMaps = this.arenaConcrete ?? createConcreteMaps(512)
    const floorMaterial = createRiverFloorMaterial(bedMaps)

    // Keep the bed above the sand plateau so dunes never show through holes.
    const underlayY = Math.max(
      this.groundY - RIVER_DEPTH,
      (this.sea?.islandTopY ?? ISLAND_TOP_Y) + 0.08,
    )
    const underlay = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_SIZE + 0.04, FIELD_SIZE + 0.04),
      floorMaterial,
    )
    underlay.rotation.x = -Math.PI / 2
    underlay.position.y = underlayY
    underlay.receiveShadow = true
    underlay.name = 'river-underlay'
    this.riverUnderlay = underlay

    const maxWalls = FIELD_BLOCKS * FIELD_BLOCKS * 4
    this.riverWallMesh = new THREE.InstancedMesh(
      createRiverCurbGeometry(),
      createRiverCurbMaterial(),
      maxWalls,
    )
    this.riverWallMesh.receiveShadow = true
    this.riverWallMesh.castShadow = true
    this.riverWallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const riverWaterGeo = new THREE.PlaneGeometry(
      FIELD_SIZE + 0.02,
      FIELD_SIZE + 0.02,
      FIELD_BLOCKS * 4,
      FIELD_BLOCKS * 4,
    )
    riverWaterGeo.rotateX(-Math.PI / 2)
    this.riverMesh = new THREE.Mesh(riverWaterGeo, this.riverWater.material)
    this.riverMesh.position.y = this.groundY + RIVER_WATER_OFFSET
    this.riverMesh.receiveShadow = true
    this.riverMesh.renderOrder = 2
    this.riverMesh.visible = false

    const snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfe9f2,
      roughness: 0.9,
    })
    this.snowMesh = new THREE.InstancedMesh(
      createGroundPlane(),
      snowMaterial,
      FIELD_BLOCKS * FIELD_BLOCKS,
    )
    this.snowMesh.receiveShadow = true
    this.snowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    const treeMaterial = new THREE.MeshStandardMaterial({
      color: 0x3f7d43,
      roughness: 0.95,
      flatShading: true,
    })
    const maxTrees = FIELD_BLOCKS * FIELD_BLOCKS * 3
    this.treeMesh = new THREE.InstancedMesh(
      createTreeGeometry(),
      treeMaterial,
      maxTrees,
    )
    this.treeMesh.castShadow = true
    this.treeMesh.receiveShadow = true
    this.treeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    let treeIndex = 0
    let wallIndex = 0
    const isRiver = (col: number, row: number) => {
      if (col < 0 || row < 0 || col >= FIELD_BLOCKS || row >= FIELD_BLOCKS) {
        return false
      }
      return !!field.rivers[row * FIELD_BLOCKS + col]
    }
    // Thin deck lip; low concrete curb sits on the hole perimeter.
    const deckLip = 0.06
    const curbOffset = 0.5 - deckLip
    const curbY = this.groundY + 0.01
    const placeCurbSpan = (
      x: number,
      z: number,
      length: number,
      rotY: number,
    ) => {
      this.matrix.compose(
        new THREE.Vector3(x, curbY, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        new THREE.Vector3(Math.max(length, 0.08), 1, 1),
      )
      this.riverWallMesh!.setMatrixAt(wallIndex, this.matrix)
      wallIndex += 1
    }
    const mergeIntervals = (raw: Array<[number, number]>) => {
      if (raw.length === 0) return [] as Array<[number, number]>
      const sorted = raw.slice().sort((a, b) => a[0] - b[0])
      const out: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]]
      for (let i = 1; i < sorted.length; i += 1) {
        const cur = sorted[i]
        const last = out[out.length - 1]
        if (cur[0] <= last[1] + 1e-4) {
          last[1] = Math.max(last[1], cur[1])
        } else {
          out.push([cur[0], cur[1]])
        }
      }
      return out
    }

    // Build continuous perimeter curb spans (no posts).
    const horiz = new Map<number, Array<[number, number]>>()
    const vert = new Map<number, Array<[number, number]>>()
    const addInterval = (
      map: Map<number, Array<[number, number]>>,
      key: number,
      a: number,
      b: number,
    ) => {
      const lo = Math.min(a, b)
      const hi = Math.max(a, b)
      const list = map.get(key)
      if (list) list.push([lo, hi])
      else map.set(key, [[lo, hi]])
    }

    for (let cell = 0; cell < FIELD_BLOCKS * FIELD_BLOCKS; cell += 1) {
      const rect = field.cellRect(cell)
      const centreX = rect.x + 0.5
      const centreY = rect.y + 0.5
      const col = cell % FIELD_BLOCKS
      const row = (cell / FIELD_BLOCKS) | 0

      if (field.rivers[cell]) {
        const world = cellToWorld(centreX, centreY)
        const cx = world.x
        const cz = world.z
        // Endpoints meet at curbOffset so outer / inner corners close cleanly.
        const alongEnd = (
          orthoRiver: boolean,
          diagRiver: boolean,
          inward: number,
        ) => {
          if (!orthoRiver) return inward * curbOffset
          if (!diagRiver) return inward * 0.5
          // Concave fold: reach the perpendicular curb on the diagonal cell.
          return inward * (1 - curbOffset)
        }
        if (!isRiver(col + 1, row)) {
          const z0 =
            cz + alongEnd(isRiver(col, row - 1), isRiver(col + 1, row - 1), -1)
          const z1 =
            cz + alongEnd(isRiver(col, row + 1), isRiver(col + 1, row + 1), 1)
          addInterval(vert, cx + curbOffset, z0, z1)
        }
        if (!isRiver(col - 1, row)) {
          const z0 =
            cz + alongEnd(isRiver(col, row - 1), isRiver(col - 1, row - 1), -1)
          const z1 =
            cz + alongEnd(isRiver(col, row + 1), isRiver(col - 1, row + 1), 1)
          addInterval(vert, cx - curbOffset, z0, z1)
        }
        if (!isRiver(col, row + 1)) {
          const x0 =
            cx + alongEnd(isRiver(col - 1, row), isRiver(col - 1, row + 1), -1)
          const x1 =
            cx + alongEnd(isRiver(col + 1, row), isRiver(col + 1, row + 1), 1)
          addInterval(horiz, cz + curbOffset, x0, x1)
        }
        if (!isRiver(col, row - 1)) {
          const x0 =
            cx + alongEnd(isRiver(col - 1, row), isRiver(col - 1, row - 1), -1)
          const x1 =
            cx + alongEnd(isRiver(col + 1, row), isRiver(col + 1, row - 1), 1)
          addInterval(horiz, cz - curbOffset, x0, x1)
        }
      }

      if (field.snows[cell]) {
        this.setInstance(this.snowMesh, cell, centreX, centreY, 0.02)
      } else {
        this.snowMesh.setMatrixAt(cell, this.hiddenMatrix)
      }

      if (field.forests[cell]) {
        for (let i = 0; i < 3; i += 1) {
          const angle = (i / 3) * Math.PI * 2 + cell * 0.7
          const radius = 0.16 + (i % 2) * 0.12
          const world = cellToWorld(
            centreX + Math.cos(angle) * radius,
            centreY + Math.sin(angle) * radius,
          )
          const scale = 0.85 + ((cell + i) % 3) * 0.12
          this.matrix.compose(
            new THREE.Vector3(world.x, this.groundY + 0.42, world.z),
            new THREE.Quaternion().setFromEuler(
              new THREE.Euler(0, (cell * 1.7 + i) % (Math.PI * 2), 0),
            ),
            new THREE.Vector3(scale, scale, scale),
          )
          this.treeMesh.setMatrixAt(treeIndex, this.matrix)
          treeIndex += 1
        }
      }
    }

    // Continuous curb spans — full length so outer / inner corners meet.
    for (const [z, raw] of horiz) {
      for (const [a, b] of mergeIntervals(raw)) {
        placeCurbSpan((a + b) / 2, z, Math.max(b - a, 0.08), 0)
      }
    }
    for (const [x, raw] of vert) {
      for (const [a, b] of mergeIntervals(raw)) {
        placeCurbSpan(x, (a + b) / 2, Math.max(b - a, 0.08), Math.PI / 2)
      }
    }

    for (let i = treeIndex; i < maxTrees; i += 1) {
      this.treeMesh.setMatrixAt(i, this.hiddenMatrix)
    }
    for (let i = wallIndex; i < maxWalls; i += 1) {
      this.riverWallMesh.setMatrixAt(i, this.hiddenMatrix)
    }

    this.wetGround?.setRiverCells(field.rivers)
    // Share the arena river mask so the water sheet clips to one continuous surface.
    if (this.wetGround) {
      this.riverWater.uniforms.uRiverMask.value =
        this.wetGround.uniforms.uRiverMask.value
      this.riverWater.uniforms.uMaskScale.value =
        this.wetGround.uniforms.uMaskScale.value
      this.riverWater.uniforms.uRiverCut.value =
        this.wetGround.uniforms.uRiverCut.value
    }
    if (this.riverMesh) {
      this.riverMesh.position.y = this.groundY + RIVER_WATER_OFFSET
      this.riverMesh.visible = this.wetGround
        ? this.wetGround.uniforms.uRiverCut.value > 0.5
        : false
    }
    this.riverWallMesh.instanceMatrix.needsUpdate = true
    this.snowMesh.instanceMatrix.needsUpdate = true
    this.treeMesh.instanceMatrix.needsUpdate = true
    if (this.riverUnderlay) this.scene.add(this.riverUnderlay)
    this.scene.add(this.riverWallMesh)
    if (this.riverMesh) this.scene.add(this.riverMesh)
    this.scene.add(this.snowMesh)
    this.scene.add(this.treeMesh)

    if (field.eagle) {
      const eagle = createEagleModel()
      const world = cellToWorld(field.eagle.x + 0.5, field.eagle.y + 0.5)
      eagle.position.set(world.x, this.groundY, world.z)
      this.scene.add(eagle)
      this.eagleMesh = eagle

      const light = new THREE.PointLight(0xffd98a, 1.6, 5)
      light.position.set(world.x, this.groundY + 0.9, world.z)
      this.scene.add(light)
      this.eagleLight = light
    }
  }

  private setInstance(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    height: number,
    scaleY = 1,
  ) {
    const world = cellToWorld(x, y)
    this.matrix.compose(
      new THREE.Vector3(world.x, this.groundY + height * scaleY, world.z),
      new THREE.Quaternion(),
      new THREE.Vector3(1, scaleY, 1),
    )
    mesh.setMatrixAt(index, this.matrix)
  }

  /**
   * Per-brick hue / value so walls read as mixed kiln lots — deep wine,
   * bright orange, and dusty rose — not one flat red.
   */
  private tintBrick(index: number) {
    if (!this.brickMesh) return
    const lot = (index * 37) % 12
    const shade = 0.72 + ((index * 53) % 9) * 0.05
    // Distinct clay recipes, then overall brightness.
    const recipes: Array<[number, number, number]> = [
      [1.05, 0.78, 0.62], // bright orange
      [0.95, 0.62, 0.52], // classic terracotta
      [0.78, 0.48, 0.44], // deep burnt
      [1.0, 0.7, 0.58], // warm peach
      [0.85, 0.5, 0.48], // wine red
      [0.92, 0.68, 0.5], // sandy red
      [0.7, 0.42, 0.38], // dark kiln
      [1.08, 0.82, 0.7], // pale under-fired
      [0.88, 0.55, 0.42], // rust
      [0.96, 0.6, 0.55], // rose
      [0.8, 0.58, 0.4], // brown clay
      [0.9, 0.72, 0.65], // dusty pink
    ]
    const [r, g, b] = recipes[lot]
    this.color.setRGB(r * shade, g * shade, b * shade)
    this.brickMesh.setColorAt(index, this.color)
  }

  /** Slight thickness jitter so a wall isn't one flat slab. */
  private brickScaleY(index: number) {
    return 0.96 + ((index * 19) % 5) * 0.012
  }

  /** Light grayscale multiply so rivets and wear keep their relative tones. */
  private tintSteel(index: number) {
    if (!this.steelMesh) return
    const shade = 0.92 + ((index * 29) % 7) * 0.02
    this.color.setRGB(shade, shade, shade)
    this.steelMesh.setColorAt(index, this.color)
  }

  hideBrick(index: number) {
    if (!this.brickMesh) return
    this.brickMesh.setMatrixAt(index, this.hiddenMatrix)
    this.brickMesh.instanceMatrix.needsUpdate = true
  }

  showBrick(index: number) {
    if (!this.brickMesh) return
    const rect = this.brickRects.get(index)
    if (!rect) return
    this.setInstance(
      this.brickMesh,
      index,
      rect.x + BRICK_SIZE / 2,
      rect.y + BRICK_SIZE / 2,
      BRICK_SIZE / 2,
      this.brickScaleY(index),
    )
    this.tintBrick(index)
    this.brickMesh.instanceMatrix.needsUpdate = true
    this.brickMesh.instanceColor!.needsUpdate = true
  }

  /** Cached brick rectangles so bricks can be restored later. */
  private readonly brickRects = new Map<number, { x: number; y: number }>()

  cacheBrickRects(field: Battlefield) {
    this.brickRects.clear()
    for (let index = 0; index < BRICK_GRID * BRICK_GRID; index += 1) {
      const rect = field.brickRect(index)
      this.brickRects.set(index, { x: rect.x, y: rect.y })
    }
  }

  showSteel(index: number, field: Battlefield) {
    if (!this.steelMesh) return
    const rect = field.steelRect(index)
    this.setInstance(
      this.steelMesh,
      index,
      rect.x + STEEL_SIZE / 2,
      rect.y + STEEL_SIZE / 2,
      STEEL_SIZE / 2,
    )
    this.tintSteel(index)
    this.steelMesh.instanceMatrix.needsUpdate = true
    this.steelMesh.instanceColor!.needsUpdate = true
  }

  hideSteel(index: number) {
    if (!this.steelMesh) return
    this.steelMesh.setMatrixAt(index, this.hiddenMatrix)
    this.steelMesh.instanceMatrix.needsUpdate = true
  }

  setEagleAlive(alive: boolean) {
    if (this.eagleMesh) this.eagleMesh.visible = alive
    if (this.eagleLight) this.eagleLight.intensity = alive ? 1.6 : 0
  }

  addTank(tank: Tank) {
    const palette = this.paletteFor(tank, 0)
    const group = createTankModel(tank.level, palette)
    const shield = createShieldModel()
    group.add(shield)
    this.scene.add(group)
    this.tankVisuals.set(tank.id, {
      group,
      shield,
      level: tank.level,
      tintMeshes: collectTintMeshes(group),
      lastPaletteKey: paletteKey(palette),
      muzzleLocal: readMuzzleLocal(group),
    })
    this.updateTank(tank, 0)
  }

  updateTank(tank: Tank, clockMs = 0) {
    let visual = this.tankVisuals.get(tank.id)
    if (!visual) return

    // Rebuild the mesh when a star power-up upgrades the tank's silhouette.
    if (visual.level !== tank.level) {
      const palette = this.paletteFor(tank, clockMs)
      this.scene.remove(visual.group)
      const group = createTankModel(tank.level, palette)
      const shield = createShieldModel()
      group.add(shield)
      this.scene.add(group)
      visual = {
        group,
        shield,
        level: tank.level,
        tintMeshes: collectTintMeshes(group),
        lastPaletteKey: paletteKey(palette),
        muzzleLocal: readMuzzleLocal(group),
      }
      this.tankVisuals.set(tank.id, visual)
    } else if (tank.side === 'bot') {
      const palette = this.paletteFor(tank, clockMs)
      const key = paletteKey(palette)
      if (key !== visual.lastPaletteKey) {
        applyPalette(visual.tintMeshes, palette)
        visual.lastPaletteKey = key
      }
    }

    const world = cellToWorld(tank.x + 0.5, tank.y + 0.5)
    visual.group.position.set(world.x, this.groundY, world.z)
    visual.group.rotation.y = directionRotation(tank.direction)

    const spawnScale =
      tank.spawnProgress >= 1 ? 1 : 0.4 + 0.6 * tank.spawnProgress
    visual.group.scale.setScalar(spawnScale)
    visual.group.visible = tank.visible
    visual.shield.visible = tank.helmetDuration > 0

    if (tank.visible && tank.spawnProgress >= 1) {
      this.wetGround?.notifyTankMotion(
        tank.id,
        world.x,
        world.z,
        clockMs / 1000,
        visual.group.rotation.y,
      )
    }
  }

  private paletteFor(tank: Tank, clockMs: number): TankPalette {
    if (tank.side === 'player') {
      return tank.playerIndex === 0
        ? TANK_PALETTES.player
        : TANK_PALETTES.player2
    }
    return resolveBotPalette(tank.level, tank.hp, tank.withPowerUp, clockMs)
  }

  removeTank(id: number) {
    const visual = this.tankVisuals.get(id)
    if (!visual) return
    this.scene.remove(visual.group)
    this.tankVisuals.delete(id)
    this.wetGround?.clearTank(id)
  }

  addBullet(bullet: Bullet) {
    const group = createBulletModel()
    this.scene.add(group)
    this.bulletVisuals.set(bullet.id, group)
    this.updateBullet(bullet)
  }

  updateBullet(bullet: Bullet, clockMs = 0) {
    const group = this.bulletVisuals.get(bullet.id)
    if (!group) return
    const world = cellToWorld(bullet.x + BULLET_HALF, bullet.y + BULLET_HALF)
    const height =
      (group.userData.flightHeight as number | undefined) ??
      this.muzzleHeightFor(bullet.ownerId)
    group.userData.flightHeight = height
    group.position.set(world.x, this.groundY + height, world.z)
    group.rotation.y = directionRotation(bullet.direction)

    const flame = group.userData.flame as THREE.Group | undefined
    if (flame) {
      // Flicker the exhaust so it reads as fire, not a solid glow stick.
      const pulse = 0.85 + 0.2 * Math.sin(clockMs * 0.045 + bullet.id * 1.7)
      const stretch = 0.9 + 0.25 * Math.sin(clockMs * 0.07 + bullet.id)
      flame.scale.set(pulse, pulse, stretch)
    }
  }

  removeBullet(id: number) {
    const group = this.bulletVisuals.get(id)
    if (!group) return
    this.scene.remove(group)
    this.bulletVisuals.delete(id)
  }

  addPowerUp(powerUp: PowerUp) {
    const group = createPowerUpModel(powerUp.name)
    this.scene.add(group)
    this.powerUpVisuals.set(powerUp.id, {
      group,
      phase: random(0, Math.PI * 2, true),
    })
    this.updatePowerUp(powerUp, 0)
  }

  updatePowerUp(powerUp: PowerUp, time: number) {
    const visual = this.powerUpVisuals.get(powerUp.id)
    if (!visual) return
    const world = cellToWorld(powerUp.x, powerUp.y)
    visual.group.position.set(
      world.x,
      this.groundY + 0.5 + Math.sin(time * 3 + visual.phase) * 0.08,
      world.z,
    )
    visual.group.rotation.y = time * 1.8 + visual.phase
    visual.group.visible = powerUp.visible
  }

  removePowerUp(id: number) {
    const visual = this.powerUpVisuals.get(id)
    if (!visual) return
    this.scene.remove(visual.group)
    this.powerUpVisuals.delete(id)
  }

  /** Brief muzzle flare + sparks at the tank's gun tip. */
  spawnMuzzleFlash(tankId: number, direction: Direction) {
    const tip = this.getMuzzleWorld(tankId)
    if (!tip) return

    const group = new THREE.Group()
    group.position.copy(tip)
    group.rotation.y = directionRotation(direction)

    const flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.18, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfff2b0,
        emissive: 0xffaa33,
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        roughness: 1,
      }),
    )
    // Local +Z is forward after directionRotation.
    flash.rotation.x = Math.PI / 2
    flash.position.z = 0.04
    group.add(flash)

    const sparks: THREE.Mesh[] = []
    const sparkCount = 7
    for (let i = 0; i < sparkCount; i += 1) {
      const material = new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xffcc55 : 0xff6a22,
        emissive: i % 2 === 0 ? 0xffaa22 : 0xff4400,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 1,
        roughness: 1,
        depthWrite: false,
      })
      const spark = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.035, 0.05),
        material,
      )
      const spread = (random(0, 1, true) - 0.5) * 1.4
      const up = (random(0, 1, true) - 0.2) * 0.9
      const forward = random(2.2, 4.2, true)
      // Local space: +Z forward, +Y up, +X side.
      spark.userData.velocity = new THREE.Vector3(spread, up, forward)
      spark.position.set(0, 0, 0.02)
      group.add(spark)
      sparks.push(spark)
    }

    this.scene.add(group)
    this.muzzleFlashes.push({ group, sparks, flash, age: 0, duration: 140 })
  }

  private muzzleHeightFor(tankId: number) {
    const visual = this.tankVisuals.get(tankId)
    return visual?.muzzleLocal.y ?? 0.42
  }

  private getMuzzleWorld(tankId: number) {
    const visual = this.tankVisuals.get(tankId)
    if (!visual) return null
    visual.group.updateMatrixWorld(true)
    const { x, y, z } = visual.muzzleLocal
    this.muzzleWorld.set(x, y, z)
    visual.group.localToWorld(this.muzzleWorld)
    return this.muzzleWorld
  }

  /**
   * Fire flash + rising smoke puff (no expanding ground rings).
   * `x`/`y` are cell centres (not hitbox corners).
   */
  spawnExplosion(
    x: number,
    y: number,
    color = 0xffb347,
    scale = 1,
    height = 0.35,
  ) {
    const group = new THREE.Group()
    const world = cellToWorld(x, y)
    group.position.set(world.x, this.groundY + height, world.z)

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 * scale, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xfff2c0,
        emissive: color,
        emissiveIntensity: 3.2,
        transparent: true,
        opacity: 1,
        roughness: 1,
        depthWrite: false,
      }),
    )
    flash.position.y = 0.08
    group.add(flash)

    const fire: THREE.Mesh[] = []
    const fireCount = 10
    for (let i = 0; i < fireCount; i += 1) {
      const hot = i % 2 === 0
      const material = new THREE.MeshStandardMaterial({
        color: hot ? 0xffe08a : color,
        emissive: hot ? 0xffaa22 : 0xff5500,
        emissiveIntensity: hot ? 2.4 : 1.8,
        transparent: true,
        opacity: 0.95,
        roughness: 1,
        depthWrite: false,
      })
      const size = random(0.06, 0.12, true) * scale
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(size, 5, 4),
        material,
      )
      material.userData.baseEmit = material.emissiveIntensity
      const angle = (i / fireCount) * Math.PI * 2 + random(0, 0.5, true)
      const speed = random(1.2, 2.8, true) * scale
      ember.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        random(2.2, 4.5, true) * scale,
        Math.sin(angle) * speed,
      )
      ember.position.set(0, 0.05, 0)
      group.add(ember)
      fire.push(ember)
    }

    const smoke: THREE.Mesh[] = []
    const smokeCount = 8
    for (let i = 0; i < smokeCount; i += 1) {
      const shade = random(0.35, 0.55, true)
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shade, shade, shade * 0.95),
        transparent: true,
        opacity: 0.55,
        roughness: 1,
        depthWrite: false,
      })
      const size = random(0.1, 0.18, true) * scale
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(size, 6, 5),
        material,
      )
      const angle = (i / smokeCount) * Math.PI * 2 + random(0, 0.4, true)
      const speed = random(0.4, 1.1, true) * scale
      puff.userData.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        random(0.8, 1.8, true) * scale,
        Math.sin(angle) * speed,
      )
      puff.userData.grow = random(1.6, 2.6, true)
      puff.position.set(Math.cos(angle) * 0.04, 0.06, Math.sin(angle) * 0.04)
      group.add(puff)
      smoke.push(puff)
    }

    this.scene.add(group)
    this.explosions.push({
      group,
      flash,
      fire,
      smoke,
      age: 0,
      duration: 520,
    })
  }

  private updateExplosions(dt: number) {
    const dtSec = dt / 1000
    for (let i = this.explosions.length - 1; i >= 0; i -= 1) {
      const explosion = this.explosions[i]
      explosion.age += dt
      const t = explosion.age / explosion.duration

      if (t >= 1) {
        this.scene.remove(explosion.group)
        ;(explosion.flash.material as THREE.Material).dispose()
        each(explosion.fire, (piece) => {
          ;(piece.material as THREE.Material).dispose()
        })
        each(explosion.smoke, (piece) => {
          ;(piece.material as THREE.Material).dispose()
        })
        this.explosions.splice(i, 1)
        continue
      }

      // White-hot flash — pops then dies quickly.
      const flashT = Math.min(1, t / 0.28)
      const flashScale = 1 + flashT * 2.2
      explosion.flash.scale.setScalar(flashScale)
      ;(explosion.flash.material as THREE.MeshStandardMaterial).opacity =
        1 - flashT
      ;(
        explosion.flash.material as THREE.MeshStandardMaterial
      ).emissiveIntensity = 3.2 * (1 - flashT)

      for (const ember of explosion.fire) {
        const velocity = ember.userData.velocity as THREE.Vector3
        velocity.y -= 11 * dtSec
        ember.position.addScaledVector(velocity, dtSec)
        const fade = Math.min(1, t / 0.65)
        const mat = ember.material as THREE.MeshStandardMaterial
        ember.scale.setScalar(1 - fade * 0.7)
        mat.opacity = 0.95 * (1 - fade)
        mat.emissiveIntensity = (mat.userData.baseEmit as number) * (1 - fade)
      }

      for (const puff of explosion.smoke) {
        const velocity = puff.userData.velocity as THREE.Vector3
        velocity.y -= 1.2 * dtSec
        puff.position.addScaledVector(velocity, dtSec)
        const grow = puff.userData.grow as number
        puff.scale.setScalar(1 + t * grow)
        ;(puff.material as THREE.MeshStandardMaterial).opacity =
          0.55 * (1 - t) * (1 - t)
      }
    }

    this.updateMuzzleFlashes(dt)
  }

  private updateMuzzleFlashes(dt: number) {
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i -= 1) {
      const fx = this.muzzleFlashes[i]
      fx.age += dt
      const t = fx.age / fx.duration

      if (t >= 1) {
        this.scene.remove(fx.group)
        ;(fx.flash.material as THREE.Material).dispose()
        each(fx.sparks, (spark) => {
          ;(spark.material as THREE.Material).dispose()
        })
        this.muzzleFlashes.splice(i, 1)
        continue
      }

      const bloom = 1 + t * 1.6
      fx.flash.scale.set(bloom * (1 - t * 0.4), 1 - t * 0.5, bloom)
      ;(fx.flash.material as THREE.MeshStandardMaterial).opacity =
        0.95 * (1 - t)
      ;(fx.flash.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.4 * (1 - t)

      for (const spark of fx.sparks) {
        const velocity = spark.userData.velocity as THREE.Vector3
        velocity.y -= 6 * (dt / 1000)
        spark.position.addScaledVector(velocity, dt / 1000)
        spark.scale.setScalar(1 - t * 0.7)
        ;(spark.material as THREE.MeshStandardMaterial).opacity = 1 - t
      }
    }
  }

  private disposeTerrain() {
    for (const mesh of [
      this.brickMesh,
      this.steelMesh,
      this.snowMesh,
      this.treeMesh,
    ]) {
      if (!mesh) continue
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.brickMesh = undefined
    this.steelMesh = undefined
    this.snowMesh = undefined
    this.treeMesh = undefined

    if (this.riverUnderlay) {
      this.scene.remove(this.riverUnderlay)
      this.riverUnderlay.geometry.dispose()
      ;(this.riverUnderlay.material as THREE.Material).dispose()
      this.riverUnderlay = undefined
    }
    if (this.riverWallMesh) {
      this.scene.remove(this.riverWallMesh)
      this.riverWallMesh.geometry.dispose()
      ;(this.riverWallMesh.material as THREE.Material).dispose()
      this.riverWallMesh = undefined
    }
    if (this.riverMesh) {
      this.scene.remove(this.riverMesh)
      this.riverMesh.geometry.dispose()
      // Shared Seascape material lives on `riverWater` for the scene lifetime.
      this.riverMesh = undefined
    }

    if (this.eagleMesh) {
      this.scene.remove(this.eagleMesh)
      this.eagleMesh = undefined
    }
    if (this.eagleLight) {
      this.scene.remove(this.eagleLight)
      this.eagleLight = undefined
    }
  }

  /** Removes every entity visual; used when a stage is torn down. */
  clearEntities() {
    for (const id of [...this.tankVisuals.keys()]) this.removeTank(id)
    for (const id of [...this.bulletVisuals.keys()]) this.removeBullet(id)
    for (const id of [...this.powerUpVisuals.keys()]) this.removePowerUp(id)
    for (const explosion of this.explosions) {
      this.scene.remove(explosion.group)
    }
    this.explosions.length = 0
    for (const flash of this.muzzleFlashes) {
      this.scene.remove(flash.group)
    }
    this.muzzleFlashes.length = 0
  }

  /** Resets orthographic framing (1 = fit the full battlefield). */
  setViewZoom(zoom: number) {
    this.viewZoom = Math.min(4.5, Math.max(1, zoom))
    this.resize()
  }

  resize() {
    // Measure the canvas box instead of the window: the game may run inside a
    // container that is sized by the host app, not by the viewport.
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || window.innerWidth))
    const height = Math.max(1, Math.round(rect.height || window.innerHeight))

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    // `false` keeps the CSS size in charge of the layout; the drawing buffer
    // is still scaled by the pixel ratio so the render stays sharp.
    this.renderer.setSize(width, height, false)

    const aspect = width / height
    const neededWidth = FIELD_SIZE + FIELD_PADDING * 2
    const neededHeight =
      FIELD_SIZE * Math.cos(CAMERA_TILT) + FIELD_PADDING_Y * 2

    let halfWidth: number
    let halfHeight: number
    if (aspect >= neededWidth / neededHeight) {
      halfHeight = neededHeight / 2
      halfWidth = halfHeight * aspect
    } else {
      halfWidth = neededWidth / 2
      halfHeight = halfWidth / aspect
    }

    halfWidth /= this.viewZoom
    halfHeight /= this.viewZoom

    this.camera.left = -halfWidth
    this.camera.right = halfWidth
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.updateProjectionMatrix()
    this.composer.setSize(width, height)
    this.composer.setPixelRatio(this.renderer.getPixelRatio())
  }

  render(dt: number, time: number) {
    this.updateExplosions(dt)
    this.riverWater.uniforms.uTime.value = time / 1000
    this.riverWater.uniforms.uEye.value.copy(this.camera.position)
    this.wetGround?.update(this.renderer, this.scene, this.camera, time / 1000)
    this.sea?.update(this.camera)
    this.composer.render()
  }
}

function readMuzzleLocal(group: THREE.Group): MuzzleLocal {
  const muzzle = group.userData.muzzleLocal as MuzzleLocal | undefined
  return muzzle ?? { x: 0, y: 0.42, z: 0.55 }
}

function collectTintMeshes(group: THREE.Group) {
  const meshes: THREE.Mesh[] = []
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const material = object.material
    if (
      material instanceof THREE.MeshStandardMaterial &&
      material.userData.tintRole
    ) {
      meshes.push(object)
    }
  })
  return meshes
}

function applyPalette(meshes: THREE.Mesh[], palette: TankPalette) {
  for (const mesh of meshes) {
    const material = mesh.material
    if (!(material instanceof THREE.MeshStandardMaterial)) continue
    applyCamoMap(material, palette)
  }
}

function paletteKey(palette: TankPalette) {
  return `${palette.body}:${palette.light}:${palette.dark}`
}
