import * as THREE from 'three'
import {
  BALL_RADIUS,
  ENV_MAP_MOVE_THRESHOLD,
  ENV_MAP_UPDATE_INTERVAL,
  PLAY_LIGHT_INTENSITY,
} from './constants'
import type { LevelLayout, MazeGrid } from './maze'

export type GameTextures = {
  iron: THREE.Texture
  ironNormal: THREE.Texture
  plane: THREE.Texture
  planeNormal: THREE.Texture
  grass: THREE.Texture
  grassNormal: THREE.Texture
  brick: THREE.Texture
  brickNormal: THREE.Texture
}

export type LevelMeshes = {
  ballMesh: THREE.Mesh
  mazeMesh: THREE.InstancedMesh
  wallContactMesh: THREE.InstancedMesh
  grassMesh: THREE.Mesh
  planeMesh: THREE.Mesh
}

function loadTexture(url: string, colorSpace?: THREE.ColorSpace) {
  const texture = new THREE.TextureLoader().load(url)
  if (colorSpace) {
    texture.colorSpace = colorSpace
  }
  return texture
}

function configureRepeatTexture(
  texture: THREE.Texture,
  repeat: number,
  anisotropy: number,
) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.anisotropy = anisotropy
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
}

export function loadGameTextures(): GameTextures {
  return {
    iron: loadTexture('images/metal_ball.jpg', THREE.SRGBColorSpace),
    ironNormal: loadTexture('images/metal_ball_normal.jpg'),
    plane: loadTexture('images/stone_floor.jpg', THREE.SRGBColorSpace),
    planeNormal: loadTexture('images/stone_floor_normal.jpg'),
    grass: loadTexture('images/grass_ground.jpg', THREE.SRGBColorSpace),
    grassNormal: loadTexture('images/grass_ground_normal.jpg'),
    brick: loadTexture('images/stone_wall.jpg', THREE.SRGBColorSpace),
    brickNormal: loadTexture('images/stone_wall_normal.jpg'),
  }
}

export function createWallMaterial(textures: GameTextures, anisotropy: number) {
  configureRepeatTexture(textures.brick, 0.5, anisotropy)
  configureRepeatTexture(textures.brickNormal, 0.5, anisotropy)

  const material = new THREE.MeshLambertMaterial({
    map: textures.brick,
    normalMap: textures.brickNormal,
    normalScale: new THREE.Vector2(1.9, 1.9),
    color: 0xf2ebe2,
    flatShading: true,
  })
  material.customProgramCacheKey = () => 'wall-lambert-contact'
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWallWorldPos;
varying vec3 vWallWorldNormal;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vec4 wallWorldPos = modelMatrix * vec4(transformed, 1.0);
vWallWorldPos = wallWorldPos.xyz;
vWallWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 vWallWorldPos;
varying vec3 vWallWorldNormal;

vec2 wallOrientedMapUv(vec2 defaultUv) {
  if (abs(vWallWorldNormal.z) < 0.6) {
    if (abs(vWallWorldNormal.x) > abs(vWallWorldNormal.y)) {
      return vec2(vWallWorldPos.y, vWallWorldPos.z) * 0.5;
    }
    return vec2(vWallWorldPos.x, vWallWorldPos.z) * 0.5;
  }
  return defaultUv;
}`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, wallOrientedMapUv(vMapUv));
  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF(sampledDiffuseColor);
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#ifdef USE_NORMALMAP_OBJECTSPACE
  normal = texture2D(normalMap, wallOrientedMapUv(vNormalMapUv)).xyz * 2.0 - 1.0;
  #ifdef FLIP_SIDED
    normal = -normal;
  #endif
  #ifdef DOUBLE_SIDED
    normal = normal * faceDirection;
  #endif
  normal = normalize(normalMatrix * normal);
#elif defined(USE_NORMALMAP_TANGENTSPACE)
  vec3 mapN = texture2D(normalMap, wallOrientedMapUv(vNormalMapUv)).xyz * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#elif defined(USE_BUMPMAP)
  normal = perturbNormalArb(-vViewPosition, normal, dHdxy_fwd(), faceDirection);
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float baseContact = 1.0 - smoothstep(0.0, 0.1, vWallWorldPos.z);
diffuseColor.rgb *= mix(1.0, 0.4, baseContact);
float topFace = smoothstep(0.6, 0.92, vWallWorldNormal.z);
diffuseColor.rgb *= mix(1.0, 0.84, topFace);`,
    )
  }
  return material
}

function createBallMaterial(textures: GameTextures, envMap: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({
    map: textures.iron,
    color: 0xffffff,
    emissive: 0x241a12,
    emissiveIntensity: 0.22,
    metalness: 0.55,
    roughness: 0.32,
    normalMap: textures.ironNormal,
    normalScale: new THREE.Vector2(0.55, 0.55),
    envMap,
    envMapIntensity: 0.82,
  })
  material.customProgramCacheKey = () => 'bright-metal-ball'
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
diffuseColor.rgb = min(diffuseColor.rgb * 1.28 + vec3(0.035), vec3(1.0));`,
    )
  }
  return material
}

function generateMazeMeshes(
  field: MazeGrid,
  wallMaterial: THREE.MeshLambertMaterial,
) {
  const walls: THREE.Vector3[] = []
  const contactPositions: THREE.Vector3[] = []

  for (let i = 0; i < field.dimension; i++) {
    for (let j = 0; j < field.dimension; j++) {
      if (!field[i][j]) {
        continue
      }

      walls.push(new THREE.Vector3(i, j, 0.498))
      contactPositions.push(new THREE.Vector3(i, j, 0.002))
    }
  }

  const geometry = new THREE.BoxGeometry(1.02, 1.02, 1.12)
  geometry.translate(0, 0, -0.06)

  const mazeMesh = new THREE.InstancedMesh(
    geometry,
    wallMaterial,
    Math.max(walls.length, 1),
  )
  mazeMesh.count = walls.length

  const matrix = new THREE.Matrix4()
  walls.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z)
    mazeMesh.setMatrixAt(index, matrix)
  })
  mazeMesh.instanceMatrix.needsUpdate = true
  mazeMesh.castShadow = true
  mazeMesh.receiveShadow = false

  const contactGeometry = new THREE.PlaneGeometry(1.035, 1.035)
  const contactMaterial = new THREE.MeshBasicMaterial({
    color: 0x1d1813,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })
  const wallContactMesh = new THREE.InstancedMesh(
    contactGeometry,
    contactMaterial,
    Math.max(contactPositions.length, 1),
  )
  wallContactMesh.count = contactPositions.length
  contactPositions.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z)
    wallContactMesh.setMatrixAt(index, matrix)
  })
  wallContactMesh.instanceMatrix.needsUpdate = true
  wallContactMesh.renderOrder = 1

  return { mazeMesh, wallContactMesh }
}

export function disposeLevelMeshes(
  scene: THREE.Scene,
  meshes: Partial<LevelMeshes>,
) {
  if (meshes.mazeMesh) {
    scene.remove(meshes.mazeMesh)
    meshes.mazeMesh.geometry.dispose()
  }

  if (meshes.wallContactMesh) {
    scene.remove(meshes.wallContactMesh)
    meshes.wallContactMesh.geometry.dispose()
    ;(meshes.wallContactMesh.material as THREE.Material).dispose()
  }

  if (meshes.planeMesh) {
    scene.remove(meshes.planeMesh)
    meshes.planeMesh.geometry.dispose()
    ;(meshes.planeMesh.material as THREE.Material).dispose()
  }

  if (meshes.grassMesh) {
    scene.remove(meshes.grassMesh)
    meshes.grassMesh.geometry.dispose()
    ;(meshes.grassMesh.material as THREE.Material).dispose()
  }

  if (meshes.ballMesh) {
    scene.remove(meshes.ballMesh)
    meshes.ballMesh.geometry.dispose()
    ;(meshes.ballMesh.material as THREE.Material).dispose()
  }
}

type BuildLevelArgs = {
  scene: THREE.Scene
  maze: MazeGrid
  layout: LevelLayout
  mazeDimension: number
  textures: GameTextures
  wallMaterial: THREE.MeshLambertMaterial
  envMap: THREE.Texture
  anisotropy: number
  camera?: THREE.PerspectiveCamera
  light?: THREE.PointLight
}

export function buildLevelScene(args: BuildLevelArgs) {
  const {
    scene,
    maze,
    layout,
    mazeDimension,
    textures,
    wallMaterial,
    envMap,
    anisotropy,
  } = args
  const { startX, startY } = layout

  const light =
    args.light ?? new THREE.PointLight(0xfff8f0, PLAY_LIGHT_INTENSITY)
  if (!args.light) {
    scene.add(light)
  }
  light.intensity = PLAY_LIGHT_INTENSITY
  light.position.set(startX, startY, 1.3)

  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 48, 32),
    createBallMaterial(textures, envMap),
  )
  ballMesh.position.set(startX, startY, BALL_RADIUS)
  ballMesh.quaternion.identity()
  ballMesh.castShadow = true
  ballMesh.receiveShadow = true
  scene.add(ballMesh)

  const aspect = window.innerWidth / window.innerHeight
  const camera = args.camera ?? new THREE.PerspectiveCamera(60, aspect, 1, 1000)
  if (!args.camera) {
    scene.add(camera)
  } else {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }
  camera.position.set(startX, startY, 5)

  const { mazeMesh, wallContactMesh } = generateMazeMeshes(maze, wallMaterial)
  scene.add(mazeMesh)
  scene.add(wallContactMesh)

  configureRepeatTexture(textures.grass, mazeDimension * 2.4, anisotropy)
  configureRepeatTexture(textures.grassNormal, mazeDimension * 2.4, anisotropy)

  const grassSize = mazeDimension * 10
  const grassMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(grassSize, grassSize, mazeDimension, mazeDimension),
    new THREE.MeshStandardMaterial({
      map: textures.grass,
      normalMap: textures.grassNormal,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    }),
  )
  grassMesh.position.set(
    (mazeDimension - 1) / 2,
    (mazeDimension - 1) / 2,
    -0.006,
  )
  grassMesh.receiveShadow = true
  scene.add(grassMesh)

  configureRepeatTexture(textures.plane, mazeDimension * 0.32, anisotropy)
  configureRepeatTexture(textures.planeNormal, mazeDimension * 0.32, anisotropy)

  const planeMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      mazeDimension,
      mazeDimension,
      mazeDimension,
      mazeDimension,
    ),
    new THREE.MeshStandardMaterial({
      map: textures.plane,
      normalMap: textures.planeNormal,
      normalScale: new THREE.Vector2(4.2, 4.2),
      color: 0xfff6ea,
      roughness: 0.52,
      metalness: 0.0,
    }),
  )
  planeMesh.position.set(
    (mazeDimension - 1) / 2,
    (mazeDimension - 1) / 2,
    -0.001,
  )
  planeMesh.receiveShadow = true
  scene.add(planeMesh)

  return {
    camera,
    light,
    meshes: {
      ballMesh,
      mazeMesh,
      wallContactMesh,
      grassMesh,
      planeMesh,
    },
  }
}

export class BallReflection {
  private frame = 0
  private lastX = 0
  private lastY = 0

  reset(x: number, y: number) {
    this.frame = 0
    this.lastX = x
    this.lastY = y
  }

  update(
    ballMesh: THREE.Mesh,
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    envCamera: THREE.CubeCamera,
    envTarget: THREE.WebGLCubeRenderTarget,
    force = false,
  ) {
    const x = ballMesh.position.x
    const y = ballMesh.position.y
    const moved =
      Math.hypot(x - this.lastX, y - this.lastY) > ENV_MAP_MOVE_THRESHOLD

    this.frame++
    if (!force && !moved && this.frame % ENV_MAP_UPDATE_INTERVAL !== 0) {
      return
    }

    this.lastX = x
    this.lastY = y

    const material = ballMesh.material as THREE.MeshStandardMaterial
    ballMesh.visible = false
    envCamera.position.copy(ballMesh.position)
    envCamera.update(renderer, scene)
    ballMesh.visible = true
    material.envMap = envTarget.texture
  }
}

export function rollBallMesh(
  ballMesh: THREE.Mesh,
  stepX: number,
  stepY: number,
) {
  const distance = Math.hypot(stepX, stepY)
  if (distance <= 0) {
    return
  }

  const rollAxis = new THREE.Vector3(-stepY, stepX, 0).normalize()
  ballMesh.rotateOnWorldAxis(rollAxis, distance / BALL_RADIUS)
}

export function setInitialSceneLighting(
  layout: LevelLayout,
  camera: THREE.PerspectiveCamera,
  light: THREE.PointLight,
  sideLight: THREE.DirectionalLight,
  sideLightTarget: THREE.Object3D,
) {
  light.intensity = PLAY_LIGHT_INTENSITY
  light.position.set(layout.startX, layout.startY, 1.3)
  camera.position.set(layout.startX, layout.startY, 5)
  sideLight.position.set(layout.startX - 9, layout.startY + 6, 12)
  sideLightTarget.position.set(layout.startX, layout.startY, 0.5)
}

export function updateFollowLighting(
  ballMesh: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  light: THREE.PointLight,
  sideLight: THREE.DirectionalLight,
  sideLightTarget: THREE.Object3D,
) {
  camera.position.x += (ballMesh.position.x - camera.position.x) * 0.1
  camera.position.y += (ballMesh.position.y - camera.position.y) * 0.1
  camera.position.z += (5 - camera.position.z) * 0.1

  light.position.x = camera.position.x
  light.position.y = camera.position.y
  light.position.z = camera.position.z - 3.7

  sideLight.position.set(ballMesh.position.x - 9, ballMesh.position.y + 6, 12)
  sideLightTarget.position.set(ballMesh.position.x, ballMesh.position.y, 0.5)
}

export function updateShadowCamera(
  sideLight: THREE.DirectionalLight,
  mazeDimension: number,
) {
  const span = mazeDimension * 0.55 + 2
  const shadowCamera = sideLight.shadow.camera
  shadowCamera.left = -span
  shadowCamera.right = span
  shadowCamera.top = span
  shadowCamera.bottom = -span
  shadowCamera.updateProjectionMatrix()
}
