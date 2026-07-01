import * as THREE from 'three'
import { Body, Box, Circle, Vec2, World } from 'planck'
import { AxisInput } from './input'
import {
  braidMaze,
  BRAID_CHANCE,
  generateSquareMaze,
  pickLevelLayout,
  type LevelLayout,
  type MazeGrid,
} from './maze'

type GameState = 'initialize' | 'fade in' | 'play' | 'fade out'

const BALL_RADIUS = 0.25
const POINT_LIGHT_INTENSITY = 2.0
const AMBIENT_LIGHT_INTENSITY = 0.52
const SHADOW_INTENSITY = 1.15
const SHADOW_NORMAL_BIAS = 0.0002
const SHADOW_RADIUS = 1

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera!: THREE.PerspectiveCamera
  private light!: THREE.PointLight
  private ambientLight: THREE.AmbientLight
  private sideLight: THREE.DirectionalLight
  private sideLightTarget: THREE.Object3D
  private ballMesh!: THREE.Mesh
  private mazeMesh?: THREE.InstancedMesh
  private wallContactMesh?: THREE.InstancedMesh
  private planeMesh?: THREE.Mesh
  private grassMesh?: THREE.Mesh

  private world?: World
  private ballBody?: Body

  private maze?: MazeGrid
  private levelLayout?: LevelLayout
  private mazeDimension = 11
  private gameState: GameState = 'initialize'
  private axisInput: AxisInput

  private ironTexture: THREE.Texture
  private ironNormalTexture: THREE.Texture
  private planeTexture: THREE.Texture
  private planeNormalTexture: THREE.Texture
  private grassTexture: THREE.Texture
  private grassNormalTexture: THREE.Texture
  private brickTexture: THREE.Texture
  private brickNormalTexture: THREE.Texture
  private wallMaterial!: THREE.MeshLambertMaterial
  private envTarget: THREE.WebGLCubeRenderTarget
  private envCamera: THREE.CubeCamera

  private levelEl: HTMLElement

  constructor() {
    this.ironTexture = new THREE.TextureLoader().load('metal_ball.jpg')
    this.ironTexture.colorSpace = THREE.SRGBColorSpace
    this.ironNormalTexture = new THREE.TextureLoader().load(
      'metal_ball_normal.jpg',
    )
    this.planeTexture = new THREE.TextureLoader().load('stone_floor.jpg')
    this.planeTexture.colorSpace = THREE.SRGBColorSpace
    this.planeNormalTexture = new THREE.TextureLoader().load(
      'stone_floor_normal.jpg',
    )
    this.grassTexture = new THREE.TextureLoader().load('grass_ground.jpg')
    this.grassTexture.colorSpace = THREE.SRGBColorSpace
    this.grassNormalTexture = new THREE.TextureLoader().load(
      'grass_ground_normal.jpg',
    )
    this.brickTexture = new THREE.TextureLoader().load('stone_wall.jpg')
    this.brickTexture.colorSpace = THREE.SRGBColorSpace
    this.brickNormalTexture = new THREE.TextureLoader().load(
      'stone_wall_normal.jpg',
    )

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.42
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    document.body.appendChild(this.renderer.domElement)

    this.ambientLight = new THREE.AmbientLight(
      0xffffff,
      AMBIENT_LIGHT_INTENSITY,
    )
    this.scene.add(this.ambientLight)

    this.sideLightTarget = new THREE.Object3D()
    this.scene.add(this.sideLightTarget)
    this.sideLight = new THREE.DirectionalLight(0xffeedd, 0.72)
    this.sideLight.castShadow = true
    this.sideLight.shadow.mapSize.set(4096, 4096)
    this.sideLight.shadow.intensity = SHADOW_INTENSITY
    this.sideLight.shadow.bias = -0.00045
    this.sideLight.shadow.normalBias = SHADOW_NORMAL_BIAS
    this.sideLight.shadow.radius = SHADOW_RADIUS
    this.sideLight.shadow.camera.near = 0.5
    this.sideLight.shadow.camera.far = 60
    this.sideLight.target = this.sideLightTarget
    this.scene.add(this.sideLight)

    this.envTarget = new THREE.WebGLCubeRenderTarget(256)
    this.envCamera = new THREE.CubeCamera(0.1, 100, this.envTarget)

    this.setupWallMaterial()

    this.levelEl = document.getElementById('level')!

    this.axisInput = new AxisInput()

    window.addEventListener('resize', () => this.onResize())
  }

  start() {
    this.animate()
  }

  private animate = () => {
    requestAnimationFrame(this.animate)

    switch (this.gameState) {
      case 'initialize':
        this.initializeLevel()
        break
      case 'fade in':
        this.fadeIn()
        break
      case 'play':
        this.play()
        break
      case 'fade out':
        this.fadeOut()
        break
    }
  }

  private initializeLevel() {
    this.clearLevel()

    const level = Math.floor((this.mazeDimension - 1) / 2 - 4)

    this.maze = generateSquareMaze(this.mazeDimension)
    braidMaze(this.maze, BRAID_CHANCE)
    this.levelLayout = pickLevelLayout(this.maze)

    this.createPhysicsWorld()
    this.createRenderWorld()
    this.updateShadowCamera()

    const { startX, startY } = this.levelLayout
    this.camera.position.set(startX, startY, 5)
    this.light.position.set(startX, startY, 1.3)
    this.light.intensity = 0

    this.levelEl.textContent = `Level ${level}`

    this.gameState = 'fade in'
  }

  private fadeIn() {
    this.updateBallReflection()
    this.light.intensity +=
      0.1 * (POINT_LIGHT_INTENSITY * 0.85 - this.light.intensity)
    this.renderer.render(this.scene, this.camera)
    if (Math.abs(this.light.intensity - POINT_LIGHT_INTENSITY * 0.85) < 0.05) {
      this.light.intensity = POINT_LIGHT_INTENSITY * 0.85
      this.gameState = 'play'
    }
  }

  private play() {
    this.updatePhysicsWorld()
    this.updateRenderWorld()
    this.renderer.render(this.scene, this.camera)

    const mazeX = Math.floor(this.ballMesh.position.x + 0.5)
    const mazeY = Math.floor(this.ballMesh.position.y + 0.5)
    const { escapeX, escapeY } = this.levelLayout!
    if (mazeX === escapeX && mazeY === escapeY) {
      this.mazeDimension += 2
      this.gameState = 'fade out'
    }
  }

  private fadeOut() {
    this.updatePhysicsWorld()
    this.updateRenderWorld()
    this.light.intensity += 0.1 * (0.0 - this.light.intensity)
    this.renderer.render(this.scene, this.camera)
    if (Math.abs(this.light.intensity) < 0.1) {
      this.light.intensity = 0.0
      this.renderer.render(this.scene, this.camera)
      this.gameState = 'initialize'
    }
  }

  private clearLevel() {
    if (this.mazeMesh) {
      this.scene.remove(this.mazeMesh)
      this.mazeMesh.geometry.dispose()
      this.mazeMesh = undefined
    }

    if (this.wallContactMesh) {
      this.scene.remove(this.wallContactMesh)
      this.wallContactMesh.geometry.dispose()
      ;(this.wallContactMesh.material as THREE.Material).dispose()
      this.wallContactMesh = undefined
    }

    if (this.planeMesh) {
      this.scene.remove(this.planeMesh)
      this.planeMesh.geometry.dispose()
      ;(this.planeMesh.material as THREE.Material).dispose()
      this.planeMesh = undefined
    }

    if (this.grassMesh) {
      this.scene.remove(this.grassMesh)
      this.grassMesh.geometry.dispose()
      ;(this.grassMesh.material as THREE.Material).dispose()
      this.grassMesh = undefined
    }

    if (this.ballMesh) {
      this.scene.remove(this.ballMesh)
      this.ballMesh.geometry.dispose()
      ;(this.ballMesh.material as THREE.Material).dispose()
    }

    if (this.camera) {
      this.scene.remove(this.camera)
    }

    if (this.light) {
      this.scene.remove(this.light)
    }

    this.world = undefined
    this.ballBody = undefined
  }

  private createPhysicsWorld() {
    const world = new World(Vec2(0, 0))
    const maze = this.maze!
    const { startX, startY } = this.levelLayout!

    const ballBody = world.createBody({
      type: 'dynamic',
      position: Vec2(startX, startY),
    })
    ballBody.createFixture({
      shape: Circle(BALL_RADIUS),
      density: 1.0,
      friction: 0.0,
      restitution: 0.25,
    })

    for (let i = 0; i < maze.dimension; i++) {
      for (let j = 0; j < maze.dimension; j++) {
        if (!maze[i][j]) {
          continue
        }
        const wall = world.createBody({
          type: 'static',
          position: Vec2(i, j),
        })
        wall.createFixture({
          shape: Box(0.5, 0.5),
        })
      }
    }

    this.world = world
    this.ballBody = ballBody
  }

  private setupWallMaterial() {
    const anisotropy = this.renderer.capabilities.getMaxAnisotropy()

    for (const texture of [this.brickTexture, this.brickNormalTexture]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(0.5, 0.5)
      texture.anisotropy = anisotropy
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
    }

    this.wallMaterial = new THREE.MeshLambertMaterial({
      map: this.brickTexture,
      normalMap: this.brickNormalTexture,
      normalScale: new THREE.Vector2(1.9, 1.9),
      color: 0xf2ebe2,
      flatShading: true,
    })
    this.wallMaterial.customProgramCacheKey = () => 'wall-lambert-contact'
    this.wallMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
varying float vWallWorldZ;
varying vec3 vWallWorldNormal;`,
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vec4 wallWorldPos = modelMatrix * vec4(transformed, 1.0);
vWallWorldZ = wallWorldPos.z;
vWallWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
varying float vWallWorldZ;
varying vec3 vWallWorldNormal;`,
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float baseContact = 1.0 - smoothstep(0.0, 0.1, vWallWorldZ);
diffuseColor.rgb *= mix(1.0, 0.4, baseContact);
float topFace = smoothstep(0.6, 0.92, vWallWorldNormal.z);
diffuseColor.rgb *= mix(1.0, 0.84, topFace);`,
      )
    }
  }

  private generateMazeMesh(field: MazeGrid) {
    const walls: { position: THREE.Vector3; rotateTexture: boolean }[] = []

    for (let i = 0; i < field.dimension; i++) {
      for (let j = 0; j < field.dimension; j++) {
        if (field[i][j]) {
          const horizontal =
            field[i - 1]?.[j] === true || field[i + 1]?.[j] === true
          const vertical =
            field[i]?.[j - 1] === true || field[i]?.[j + 1] === true

          walls.push({
            position: new THREE.Vector3(i, j, 0.498),
            rotateTexture: vertical && !horizontal,
          })
        }
      }
    }

    // Slightly oversize the boxes horizontally so neighbouring walls overlap.
    // Exactly-adjacent 1x1 boxes leave a hairline crack where MSAA samples the
    // bright floor beneath, showing up as a white edge along the wall seams.
    // The box is also extended downward and sunk below the floor so the shadow
    // stays attached at the wall base (avoids peter-panning bright edges).
    const geometry = new THREE.BoxGeometry(1.02, 1.02, 1.12)
    geometry.translate(0, 0, -0.06)

    const mesh = new THREE.InstancedMesh(
      geometry,
      this.wallMaterial,
      Math.max(walls.length, 1),
    )
    mesh.count = walls.length

    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const verticalQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      Math.PI / 2,
    )
    const scale = new THREE.Vector3(1, 1, 1)
    walls.forEach(({ position, rotateTexture }, index) => {
      matrix.compose(
        position,
        rotateTexture ? verticalQuaternion : quaternion,
        scale,
      )
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = false

    return mesh
  }

  private generateWallContactMesh(field: MazeGrid) {
    const positions: THREE.Vector3[] = []

    for (let i = 0; i < field.dimension; i++) {
      for (let j = 0; j < field.dimension; j++) {
        if (field[i][j]) {
          positions.push(new THREE.Vector3(i, j, 0.002))
        }
      }
    }

    // Thin dark plates hidden just under every wall footprint.  They cover the
    // MSAA/shadow-map samples where the floor can peek through at the wall base,
    // which otherwise appears as broken bright rims in shadow.
    const geometry = new THREE.PlaneGeometry(1.035, 1.035)
    const material = new THREE.MeshBasicMaterial({
      color: 0x1d1813,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })

    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      Math.max(positions.length, 1),
    )
    mesh.count = positions.length

    const matrix = new THREE.Matrix4()
    positions.forEach((position, index) => {
      matrix.makeTranslation(position.x, position.y, position.z)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.renderOrder = 1

    return mesh
  }

  private updateShadowCamera() {
    const span = this.mazeDimension * 0.55 + 2
    const shadowCamera = this.sideLight.shadow.camera
    shadowCamera.left = -span
    shadowCamera.right = span
    shadowCamera.top = span
    shadowCamera.bottom = -span
    shadowCamera.updateProjectionMatrix()
  }

  private createRenderWorld() {
    const maze = this.maze!
    const { startX, startY } = this.levelLayout!

    this.light = new THREE.PointLight(0xfff8f0, POINT_LIGHT_INTENSITY * 0.85)
    this.light.position.set(startX, startY, 1.3)
    this.scene.add(this.light)

    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 48, 32)
    const ballMaterial = new THREE.MeshStandardMaterial({
      map: this.ironTexture,
      color: 0xffffff,
      emissive: 0x241a12,
      emissiveIntensity: 0.22,
      metalness: 0.55,
      roughness: 0.32,
      normalMap: this.ironNormalTexture,
      normalScale: new THREE.Vector2(0.55, 0.55),
      envMapIntensity: 0.82,
    })
    ballMaterial.customProgramCacheKey = () => 'bright-metal-ball'
    ballMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
diffuseColor.rgb = min(diffuseColor.rgb * 1.28 + vec3(0.035), vec3(1.0));`,
      )
    }
    this.ballMesh = new THREE.Mesh(ballGeometry, ballMaterial)
    this.ballMesh.position.set(startX, startY, BALL_RADIUS)
    this.ballMesh.quaternion.identity()
    this.ballMesh.castShadow = true
    this.ballMesh.receiveShadow = true
    this.scene.add(this.ballMesh)

    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(60, aspect, 1, 1000)
    this.camera.position.set(startX, startY, 5)
    this.scene.add(this.camera)

    this.mazeMesh = this.generateMazeMesh(maze)
    this.scene.add(this.mazeMesh)

    this.wallContactMesh = this.generateWallContactMesh(maze)
    this.scene.add(this.wallContactMesh)

    for (const texture of [this.grassTexture, this.grassNormalTexture]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(this.mazeDimension * 2.4, this.mazeDimension * 2.4)
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
    }

    const grassSize = this.mazeDimension * 10
    const grassGeometry = new THREE.PlaneGeometry(
      grassSize,
      grassSize,
      this.mazeDimension,
      this.mazeDimension,
    )
    const grassMaterial = new THREE.MeshStandardMaterial({
      map: this.grassTexture,
      normalMap: this.grassNormalTexture,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.0,
    })
    this.grassMesh = new THREE.Mesh(grassGeometry, grassMaterial)
    this.grassMesh.position.set(
      (this.mazeDimension - 1) / 2,
      (this.mazeDimension - 1) / 2,
      -0.006,
    )
    this.grassMesh.receiveShadow = true
    this.scene.add(this.grassMesh)

    for (const texture of [this.planeTexture, this.planeNormalTexture]) {
      texture.wrapS = THREE.RepeatWrapping
      texture.wrapT = THREE.RepeatWrapping
      texture.repeat.set(this.mazeDimension * 0.32, this.mazeDimension * 0.32)
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
    }

    const planeGeometry = new THREE.PlaneGeometry(
      this.mazeDimension,
      this.mazeDimension,
      this.mazeDimension,
      this.mazeDimension,
    )
    const planeMaterial = new THREE.MeshStandardMaterial({
      map: this.planeTexture,
      normalMap: this.planeNormalTexture,
      normalScale: new THREE.Vector2(4.2, 4.2),
      color: 0xfff6ea,
      roughness: 0.52,
      metalness: 0.0,
    })
    this.planeMesh = new THREE.Mesh(planeGeometry, planeMaterial)
    this.planeMesh.position.set(
      (this.mazeDimension - 1) / 2,
      (this.mazeDimension - 1) / 2,
      -0.001,
    )
    this.planeMesh.receiveShadow = true
    this.scene.add(this.planeMesh)
  }

  private updatePhysicsWorld() {
    const ballBody = this.ballBody!
    const world = this.world!

    const velocity = ballBody.getLinearVelocity()
    ballBody.setLinearVelocity(Vec2(velocity.x * 0.95, velocity.y * 0.95))

    const [axisX, axisY] = this.axisInput.getAxis()
    const mass = ballBody.getMass()
    const impulse = Vec2(axisX * mass * 0.25, axisY * mass * 0.25)
    ballBody.applyLinearImpulse(impulse, ballBody.getPosition(), true)

    world.step(1 / 60, 8, 3)
  }

  private updateRenderWorld() {
    const position = this.ballBody!.getPosition()
    const stepX = position.x - this.ballMesh.position.x
    const stepY = position.y - this.ballMesh.position.y

    this.ballMesh.position.set(position.x, position.y, BALL_RADIUS)

    const distance = Math.hypot(stepX, stepY)
    if (distance > 0) {
      const rollAxis = new THREE.Vector3(-stepY, stepX, 0).normalize()
      this.ballMesh.rotateOnWorldAxis(rollAxis, distance / BALL_RADIUS)
    }

    this.camera.position.x +=
      (this.ballMesh.position.x - this.camera.position.x) * 0.1
    this.camera.position.y +=
      (this.ballMesh.position.y - this.camera.position.y) * 0.1
    this.camera.position.z += (5 - this.camera.position.z) * 0.1

    this.light.position.x = this.camera.position.x
    this.light.position.y = this.camera.position.y
    this.light.position.z = this.camera.position.z - 3.7

    this.sideLight.position.set(
      this.ballMesh.position.x - 9,
      this.ballMesh.position.y + 6,
      12,
    )
    this.sideLightTarget.position.set(
      this.ballMesh.position.x,
      this.ballMesh.position.y,
      0.5,
    )
    this.sideLight.shadow.camera.updateProjectionMatrix()

    this.updateBallReflection()
  }

  private updateBallReflection() {
    if (!this.ballMesh) {
      return
    }

    const material = this.ballMesh.material as THREE.MeshStandardMaterial
    this.ballMesh.visible = false
    this.envCamera.position.copy(this.ballMesh.position)
    this.envCamera.update(this.renderer, this.scene)
    this.ballMesh.visible = true
    material.envMap = this.envTarget.texture
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    if (this.camera) {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
    }
  }
}
