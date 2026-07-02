import * as THREE from 'three'
import { Howl, Howler } from 'howler'
import { Body, Box, Circle, Contact, ContactImpulse, Vec2, World } from 'planck'
import {
  AMBIENT_LIGHT_INTENSITY,
  BALL_RADIUS,
  ENV_MAP_SIZE,
  type GameState,
  HIT_SOUND_COOLDOWN_MS,
  HIT_SOUND_MAX_IMPULSE,
  HIT_SOUND_MAX_VOLUME,
  HIT_SOUND_MIN_IMPULSE,
  HIT_SOUND_MIN_VOLUME,
  PLAY_LIGHT_INTENSITY,
  ROLLING_SOUND_MAX_SPEED,
  ROLLING_SOUND_MAX_VOLUME,
  ROLLING_SOUND_MIN_SPEED,
  ROLLING_SOUND_SPEED_SMOOTHING,
  ROLLING_SOUND_VOLUME_SMOOTHING,
  SHADOW_INTENSITY,
  SHADOW_MAP_SIZE,
  SHADOW_NORMAL_BIAS,
  SHADOW_RADIUS,
  SHADOW_WARMUP_FRAMES,
  type ScreenFlashPhase,
  TONE_MAPPING_EXPOSURE,
  VICTORY_FLASH_FADE_IN_MS,
  VICTORY_FLASH_FADE_OUT_MS,
  VICTORY_FLASH_MIN_HOLD_MS,
  VICTORY_FLASH_PEAK_EXPOSURE,
} from './constants'
import { AxisInput } from './input'
import { Minimap } from './minimap'
import {
  braidMaze,
  BRAID_CHANCE,
  generateSquareMaze,
  pickLevelLayout,
  type LevelLayout,
  type MazeGrid,
} from './maze'
import {
  BallReflection,
  buildLevelScene,
  createWallMaterial,
  disposeLevelMeshes,
  loadGameTextures,
  rollBallMesh,
  setInitialSceneLighting,
  updateFollowLighting,
  updateShadowCamera,
  type LevelMeshes,
} from './scene'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera!: THREE.PerspectiveCamera
  private light!: THREE.PointLight
  private sideLight: THREE.DirectionalLight
  private sideLightTarget: THREE.Object3D
  private levelMeshes!: LevelMeshes

  private world?: World
  private ballBody?: Body

  private maze?: MazeGrid
  private levelLayout?: LevelLayout
  private mazeDimension = 11
  private gameState: GameState = 'boot'
  private axisInput: AxisInput

  private textures = loadGameTextures()
  private wallMaterial: THREE.MeshLambertMaterial
  private envTarget: THREE.WebGLCubeRenderTarget
  private envCamera: THREE.CubeCamera
  private ballReflection = new BallReflection()

  private levelNumberEl: HTMLElement
  private minimap: Minimap
  private victoryFlashEl: HTMLElement
  private screenFlashPhase: ScreenFlashPhase = 'hold'
  private screenFlashStartTime = 0
  private levelReadyAt = 0
  private shadowWarmUpFrames = 0
  private shadowsReady = false

  private rollingSound: Howl
  private hitSound: Howl
  private audioUnlocked = false
  private rollingSpeedSmoothed = 0
  private rollingSoundVolume = 0
  private lastHitSoundTime = 0

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    document.body.appendChild(this.renderer.domElement)

    this.scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY))

    this.sideLightTarget = new THREE.Object3D()
    this.scene.add(this.sideLightTarget)
    this.sideLight = new THREE.DirectionalLight(0xffeedd, 0.72)
    this.sideLight.castShadow = true
    this.sideLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
    this.sideLight.shadow.intensity = SHADOW_INTENSITY
    this.sideLight.shadow.bias = -0.00045
    this.sideLight.shadow.normalBias = SHADOW_NORMAL_BIAS
    this.sideLight.shadow.radius = SHADOW_RADIUS
    this.sideLight.shadow.camera.near = 0.5
    this.sideLight.shadow.camera.far = 60
    this.sideLight.target = this.sideLightTarget
    this.scene.add(this.sideLight)

    this.envTarget = new THREE.WebGLCubeRenderTarget(ENV_MAP_SIZE)
    this.envCamera = new THREE.CubeCamera(0.1, 100, this.envTarget)
    this.wallMaterial = createWallMaterial(
      this.textures,
      this.renderer.capabilities.getMaxAnisotropy(),
    )

    this.levelNumberEl = document.getElementById('level-number')!
    this.minimap = new Minimap(
      document.getElementById('minimap-canvas') as HTMLCanvasElement,
    )
    this.victoryFlashEl = document.getElementById('victory-flash')!
    this.victoryFlashEl.style.opacity = '1'

    this.axisInput = new AxisInput()
    this.rollingSound = new Howl({
      src: ['sound/rolling.mp3'],
      loop: true,
      volume: 0,
      preload: true,
    })
    this.hitSound = new Howl({
      src: ['sound/hit.mp3'],
      preload: true,
    })
    this.unlockAudio()

    window.addEventListener('resize', () => this.onResize())
  }

  start() {
    this.animate()
  }

  private animate = () => {
    requestAnimationFrame(this.animate)

    switch (this.gameState) {
      case 'boot':
        this.boot()
        break
      case 'play':
        this.play()
        break
      case 'victory flash':
        this.victoryFlash()
        break
    }
  }

  private boot() {
    if (!this.maze) {
      this.prepareNextLevel()
    }

    if (this.screenFlashPhase === 'hold') {
      if (this.updateWhiteHold()) {
        this.screenFlashPhase = 'fade-out'
        this.screenFlashStartTime = performance.now()
      }
      return
    }

    if (this.updateWhiteFadeOut()) {
      this.finishWhiteReveal()
    }
  }

  private prepareNextLevel() {
    this.clearLevel()

    const level = Math.floor((this.mazeDimension - 1) / 2 - 4)

    this.maze = generateSquareMaze(this.mazeDimension)
    braidMaze(this.maze, BRAID_CHANCE)
    this.levelLayout = pickLevelLayout(this.maze)

    this.createPhysicsWorld()

    const built = buildLevelScene({
      scene: this.scene,
      maze: this.maze,
      layout: this.levelLayout,
      mazeDimension: this.mazeDimension,
      textures: this.textures,
      wallMaterial: this.wallMaterial,
      envMap: this.envTarget.texture,
      anisotropy: this.renderer.capabilities.getMaxAnisotropy(),
      camera: this.camera,
      light: this.light,
    })
    this.camera = built.camera
    this.light = built.light
    this.levelMeshes = built.meshes

    updateShadowCamera(this.sideLight, this.mazeDimension)

    const { startX, startY } = this.levelLayout
    this.camera.position.set(startX, startY, 5)
    this.light.position.set(startX, startY, 1.3)
    this.levelNumberEl.textContent = String(level)
    this.ballReflection.reset(startX, startY)
    this.shadowWarmUpFrames = 0
    this.shadowsReady = false
    this.levelReadyAt = 0
  }

  private play() {
    this.updatePhysicsWorld()
    this.updateRenderWorld()
    this.renderer.render(this.scene, this.camera)

    const mazeX = Math.floor(this.levelMeshes.ballMesh.position.x + 0.5)
    const mazeY = Math.floor(this.levelMeshes.ballMesh.position.y + 0.5)
    const { escapeX, escapeY } = this.levelLayout!
    if (mazeX === escapeX && mazeY === escapeY) {
      this.mazeDimension += 2
      this.startVictoryFlash()
    }
  }

  private startVictoryFlash() {
    this.stopRollingSound()
    this.screenFlashPhase = 'fade-in'
    this.screenFlashStartTime = performance.now()
    this.gameState = 'victory flash'
  }

  private victoryFlash() {
    const elapsed = performance.now() - this.screenFlashStartTime

    if (this.screenFlashPhase === 'fade-in') {
      const flash = Math.min(elapsed / VICTORY_FLASH_FADE_IN_MS, 1)
      this.setVictoryFlashVisuals(flash)
      this.updatePhysicsWorld()
      this.updateRenderWorld()
      this.renderer.render(this.scene, this.camera)

      if (flash >= 1) {
        this.prepareNextLevel()
        this.screenFlashPhase = 'hold'
        this.screenFlashStartTime = performance.now()
      }
      return
    }

    if (this.screenFlashPhase === 'hold') {
      if (this.updateWhiteHold()) {
        this.screenFlashPhase = 'fade-out'
        this.screenFlashStartTime = performance.now()
      }
      return
    }

    if (this.updateWhiteFadeOut()) {
      this.finishWhiteReveal()
    }
  }

  private updateWhiteHold() {
    this.renderSceneUnderWhite()

    if (!this.shadowsReady) {
      this.shadowWarmUpFrames++
      if (this.shadowWarmUpFrames >= SHADOW_WARMUP_FRAMES) {
        this.shadowsReady = true
        this.levelReadyAt = performance.now()
      }
      return false
    }

    return performance.now() - this.levelReadyAt >= VICTORY_FLASH_MIN_HOLD_MS
  }

  private updateWhiteFadeOut() {
    const elapsed = performance.now() - this.screenFlashStartTime
    const flash = 1 - Math.min(elapsed / VICTORY_FLASH_FADE_OUT_MS, 1)
    this.renderSceneUnderWhite(flash)
    return flash <= 0
  }

  private renderSceneUnderWhite(flashOpacity = 1) {
    this.victoryFlashEl.style.opacity = String(flashOpacity)
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE
    setInitialSceneLighting(
      this.levelLayout!,
      this.camera,
      this.light,
      this.sideLight,
      this.sideLightTarget,
    )
    this.updateBallReflection(true)
    this.updateMinimap()
    this.renderer.render(this.scene, this.camera)
  }

  private finishWhiteReveal() {
    this.victoryFlashEl.style.opacity = '0'
    this.renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE
    this.levelReadyAt = 0
    this.shadowWarmUpFrames = 0
    this.shadowsReady = false
    this.screenFlashPhase = 'fade-in'
    this.light.intensity = PLAY_LIGHT_INTENSITY
    this.gameState = 'play'
  }

  private setVictoryFlashVisuals(flash: number) {
    this.victoryFlashEl.style.opacity = String(flash)
    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
      TONE_MAPPING_EXPOSURE,
      VICTORY_FLASH_PEAK_EXPOSURE,
      flash,
    )
  }

  private clearLevel() {
    if (this.levelMeshes) {
      disposeLevelMeshes(this.scene, this.levelMeshes)
    }
    this.stopRollingSound()

    if (this.world) {
      this.world.off('post-solve', this.handlePostSolve)
    }

    this.world = undefined
    this.ballBody = undefined
  }

  private createPhysicsWorld() {
    const maze = this.maze!
    const { startX, startY } = this.levelLayout!

    const world = new World(Vec2(0, 0))
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
        wall.createFixture({ shape: Box(0.5, 0.5) })
      }
    }

    this.world = world
    this.ballBody = ballBody
    world.on('post-solve', this.handlePostSolve)
  }

  private handlePostSolve = (contact: Contact, impulse: ContactImpulse) => {
    if (!this.audioUnlocked || !this.ballBody) {
      return
    }

    const fixtureA = contact.getFixtureA()
    const fixtureB = contact.getFixtureB()
    const bodyA = fixtureA.getBody()
    const bodyB = fixtureB.getBody()

    const involvesBall = bodyA === this.ballBody || bodyB === this.ballBody
    if (!involvesBall) {
      return
    }

    const other = bodyA === this.ballBody ? bodyB : bodyA
    if (other.getType() !== 'static') {
      return
    }

    let impact = 0
    for (const normalImpulse of impulse.normalImpulses) {
      impact += Math.abs(normalImpulse)
    }

    if (impact < HIT_SOUND_MIN_IMPULSE) {
      return
    }

    const now = performance.now()
    if (now - this.lastHitSoundTime < HIT_SOUND_COOLDOWN_MS) {
      return
    }
    this.lastHitSoundTime = now

    const t = Math.min(
      (impact - HIT_SOUND_MIN_IMPULSE) /
        (HIT_SOUND_MAX_IMPULSE - HIT_SOUND_MIN_IMPULSE),
      1,
    )
    const volume =
      HIT_SOUND_MIN_VOLUME + t * (HIT_SOUND_MAX_VOLUME - HIT_SOUND_MIN_VOLUME)

    this.hitSound.volume(volume)
    this.hitSound.rate(0.92 + Math.random() * 0.16)
    this.hitSound.play()
  }

  private updatePhysicsWorld() {
    const ballBody = this.ballBody!
    const world = this.world!

    const velocity = ballBody.getLinearVelocity()
    ballBody.setLinearVelocity(Vec2(velocity.x * 0.95, velocity.y * 0.95))

    const [axisX, axisY] = this.axisInput.getAxis()
    const mass = ballBody.getMass()
    ballBody.applyLinearImpulse(
      Vec2(axisX * mass * 0.25, axisY * mass * 0.25),
      ballBody.getPosition(),
      true,
    )

    world.step(1 / 60, 8, 3)
  }

  private updateRenderWorld() {
    const ballMesh = this.levelMeshes.ballMesh
    const position = this.ballBody!.getPosition()
    const velocity = this.ballBody!.getLinearVelocity()
    const stepX = position.x - ballMesh.position.x
    const stepY = position.y - ballMesh.position.y

    ballMesh.position.set(position.x, position.y, BALL_RADIUS)
    rollBallMesh(ballMesh, stepX, stepY)
    this.updateRollingSound(Math.hypot(velocity.x, velocity.y))
    updateFollowLighting(
      ballMesh,
      this.camera,
      this.light,
      this.sideLight,
      this.sideLightTarget,
    )
    this.updateBallReflection()
    this.updateMinimap()
  }

  private updateMinimap() {
    const ballMesh = this.levelMeshes?.ballMesh
    if (!ballMesh) {
      return
    }

    this.minimap.draw(
      this.mazeDimension,
      ballMesh.position.x,
      ballMesh.position.y,
    )
  }

  private updateBallReflection(force = false) {
    this.ballReflection.update(
      this.levelMeshes.ballMesh,
      this.renderer,
      this.scene,
      this.envCamera,
      this.envTarget,
      force,
    )
  }

  private unlockAudio() {
    const unlock = () => {
      if (Howler.ctx?.state === 'suspended') {
        void Howler.ctx.resume()
      }

      if (!this.rollingSound.playing()) {
        this.rollingSound.play()
      }

      this.rollingSound.volume(0)
      this.audioUnlocked = true
    }

    window.addEventListener('keydown', unlock, { once: true })
    window.addEventListener('pointerdown', unlock, { once: true })
  }

  private updateRollingSound(speed: number) {
    if (!this.audioUnlocked) {
      return
    }

    this.rollingSpeedSmoothed +=
      (speed - this.rollingSpeedSmoothed) * ROLLING_SOUND_SPEED_SMOOTHING

    const t =
      (this.rollingSpeedSmoothed - ROLLING_SOUND_MIN_SPEED) /
      (ROLLING_SOUND_MAX_SPEED - ROLLING_SOUND_MIN_SPEED)
    const targetVolume = Math.min(Math.max(t, 0), 1) * ROLLING_SOUND_MAX_VOLUME
    this.rollingSoundVolume +=
      (targetVolume - this.rollingSoundVolume) * ROLLING_SOUND_VOLUME_SMOOTHING
    this.rollingSound.volume(this.rollingSoundVolume)
  }

  private stopRollingSound() {
    this.rollingSpeedSmoothed = 0
    this.rollingSoundVolume = 0
    this.rollingSound.volume(0)
  }

  private onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    if (this.camera) {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
    }
  }
}
