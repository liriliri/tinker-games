import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import clamp from 'licia/clamp'
import max from 'licia/max'
import min from 'licia/min'
import now from 'licia/now'
import random from 'licia/random'
import $class from 'licia/$class'
import {
  BLOCK,
  BOTTLE,
  CAMERA_OFFSET,
  FRUSTUM_HEIGHT,
  GAME,
  type GameState,
} from './constants'
import { Block } from './Block'
import { Bottle } from './Bottle'
import { Ground } from './Ground'
import { TailSystem } from './TailSystem'
import { Wave } from './Wave'
import { getBestScore, setBestScore } from '../lib/storage'
import {
  playCharge,
  playFall,
  playFallEdge,
  playJump,
  playLand,
  playPop,
  playRestart,
  preloadAudio,
  unlockAudio,
} from '../lib/audio'

type HitResult = 'perfect' | 'ok' | 'current' | 'miss'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.OrthographicCamera
  private ground: Ground
  private keyLight: THREE.DirectionalLight
  /** Light-parented catcher (original shadowGround). Hidden while landed so the tabletop is the only receiver. */
  private shadowGround: THREE.Mesh
  private bottle: Bottle
  private tails: TailSystem
  private waves: Wave[] = []

  private currentBlock!: Block
  private nextBlock!: Block
  private blocks: Block[] = []

  private state: GameState = 'ready'
  private score = 0
  private best = getBestScore()
  private combo = 0
  private succeedCount = 0
  private beatBestThisRun = false
  private straight = true
  private nextGap = 8
  private pendingStraight = true
  private doubleHit = 0

  private chargeStartedAt = 0
  private predictedHit: HitResult = 'miss'
  private jumpAxis = new THREE.Vector3(1, 0, 0)
  private cameraTarget = new THREE.Vector3()
  private lastTime = 0
  private pointerDown = false

  private scoreEl: HTMLElement
  private bestEl: HTMLElement
  private overlayEl: HTMLElement
  private finalScoreEl: HTMLElement
  private hintEl: HTMLElement
  private floatEl: HTMLElement

  constructor() {
    preloadAudio()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    // Original jump-jump has no filmic curve — keep midtones bright and flat.
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.setPixelRatio(min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.BasicShadowMap
    document.body.appendChild(this.renderer.domElement)

    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.OrthographicCamera(
      (-FRUSTUM_HEIGHT * aspect) / 2,
      (FRUSTUM_HEIGHT * aspect) / 2,
      FRUSTUM_HEIGHT / 2,
      -FRUSTUM_HEIGHT / 2,
      -50,
      120,
    )
    this.scene.add(this.camera)

    // Soft room lighting so bottle clearcoat picks up opaque-glass reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture
    this.scene.environmentIntensity = 0.55
    pmrem.dispose()

    this.ground = new Ground(this.scene)

    // Original intensities were for legacy lights; ×π for physically-correct Three r155+.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8 * Math.PI))
    // Bottle casts; blocks use fake drop planes. Shadow catcher is parented to the light
    // (original index.js addLight) so it doesn't stack under every platform.
    this.keyLight = new THREE.DirectionalLight(0xffffff, 0.28 * Math.PI)
    this.keyLight.castShadow = true
    this.keyLight.shadow.mapSize.set(512, 512)
    this.keyLight.shadow.camera.near = 5
    this.keyLight.shadow.camera.far = 32
    this.keyLight.shadow.camera.left = -10
    this.keyLight.shadow.camera.right = 10
    this.keyLight.shadow.camera.top = 10
    this.keyLight.shadow.camera.bottom = -10
    this.keyLight.position.set(0, 15, 10)
    this.scene.add(this.keyLight)
    this.scene.add(this.keyLight.target)

    this.shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 25),
      new THREE.ShadowMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
      }),
    )
    this.shadowGround.receiveShadow = true
    this.shadowGround.position.set(0, -18, -14)
    this.shadowGround.rotation.x = -Math.PI / 2
    this.shadowGround.renderOrder = 1
    this.keyLight.add(this.shadowGround)

    this.bottle = new Bottle()
    this.scene.add(this.bottle.obj)
    this.tails = new TailSystem(this.scene, this.bottle)

    for (let i = 0; i < 4; i++) {
      const wave = new Wave()
      this.waves.push(wave)
      this.scene.add(wave.obj)
    }

    this.scoreEl = document.getElementById('score')!
    this.bestEl = document.getElementById('best')!
    this.overlayEl = document.getElementById('overlay')!
    this.finalScoreEl = document.getElementById('final-score')!
    this.hintEl = document.getElementById('hint')!
    this.floatEl = document.getElementById('float-score')!

    this.bestEl.textContent = String(this.best)

    document.getElementById('restart-btn')!.addEventListener('click', () => {
      this.restart()
    })

    window.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('blur', this.onPointerUp)
    window.addEventListener('resize', () => this.onResize())
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.code === 'Space') {
          e.preventDefault()
          if (this.state === 'gameover') {
            this.restart()
          } else if (!this.pointerDown) {
            this.beginCharge()
          }
        }
      },
      { passive: false },
    )
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.endCharge()
      }
    })

    this.resetLevel(false)
  }

  start() {
    this.lastTime = now()
    this.animate()
  }

  private resetLevel(animateBottle: boolean) {
    for (const block of this.blocks) {
      this.scene.remove(block.obj)
      block.dispose()
    }
    this.blocks = []
    for (const wave of this.waves) wave.reset()

    this.score = 0
    this.combo = 0
    this.doubleHit = 0
    this.succeedCount = 0
    this.beatBestThisRun = false
    this.straight = true
    this.nextGap = 8
    this.state = 'ready'
    this.predictedHit = 'miss'
    this.updateScoreUi()
    this.hideOverlay()
    $class.remove(this.hintEl, 'hidden')

    this.currentBlock = Block.createStarter()
    this.currentBlock.showAt(0, 0, false)
    this.scene.add(this.currentBlock.obj)
    this.blocks.push(this.currentBlock)

    this.nextBlock = Block.createRandom([this.currentBlock.color])
    this.nextBlock.showAt(
      this.currentBlock.radius + this.nextGap + this.nextBlock.radius,
      0,
      false,
    )
    this.scene.add(this.nextBlock.obj)
    this.blocks.push(this.nextBlock)

    this.bottle.stop()
    this.bottle.obj.position.set(0, BLOCK.height / 2, 0)
    this.bottle.lookAt('straight')
    this.tails.reset()

    this.cameraTarget.copy(this.midPoint(this.currentBlock, this.nextBlock))
    this.snapCamera()
    this.pendingStraight = random(0, 1) === 1

    if (animateBottle) {
      this.bottle.showup()
    }
  }

  private restart() {
    playRestart()
    this.resetLevel(true)
  }

  private animate = () => {
    requestAnimationFrame(this.animate)
    const t = now()
    const dt = clamp((t - this.lastTime) / 1000, 0, 0.05)
    this.lastTime = t

    if (this.state === 'charging') {
      this.currentBlock.update(dt)
      this.bottle.update(dt)
    } else if (this.state === 'jumping') {
      this.bottle.update(dt)
      this.resolveLanding()
    } else if (this.state === 'gameover' && this.bottle.status === 'fall') {
      this.bottle.update(dt)
    }

    this.tails.update(dt)
    this.updateCamera(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private beginCharge() {
    if (this.state !== 'ready' || this.pointerDown) return
    if (this.bottle.status === 'showup') return
    unlockAudio()
    this.pointerDown = true
    this.state = 'charging'
    this.chargeStartedAt = now()
    this.bottle.prepare()
    this.currentBlock.shrink()
    $class.add(this.hintEl, 'hidden')
    playCharge()
  }

  private endCharge() {
    if (!this.pointerDown) return
    this.pointerDown = false
    if (this.state !== 'charging') return
    const duration = (now() - this.chargeStartedAt) / 1000
    this.launch(duration)
  }

  private launch(duration: number) {
    this.bottle.velocity.vz = min(
      duration * BOTTLE.velocityZIncrement,
      BOTTLE.maxVelocityZ,
    )
    this.bottle.velocity.vy = min(
      BOTTLE.velocityY + duration * BOTTLE.velocityYIncrement,
      BOTTLE.maxVelocityY,
    )

    const dir = new THREE.Vector2(
      this.nextBlock.obj.position.x - this.bottle.obj.position.x,
      this.nextBlock.obj.position.z - this.bottle.obj.position.z,
    )
    this.jumpAxis.set(dir.x, 0, dir.y).normalize()

    this.predictedHit = this.predictHit()
    this.nextGap = random(BLOCK.minDistance, BLOCK.maxDistance, true)
    this.pendingStraight = random(0, 1) === 1

    this.currentBlock.rebound()
    this.bottle.jump(this.jumpAxis)
    this.state = 'jumping'
    playJump()
  }

  private predictHit(): HitResult {
    const startY = this.bottle.obj.position.y
    const total = (this.bottle.velocity.vy / GAME.gravity) * 2
    const rise = BLOCK.height / 2 - startY
    const disc = Math.pow(this.bottle.velocity.vy, 2) - 2 * GAME.gravity * rise
    let flyingTime = total
    if (disc >= 0) {
      const toTop = (-this.bottle.velocity.vy + Math.sqrt(disc)) / -GAME.gravity
      flyingTime = max(0.05, total - toTop)
    }

    const landX =
      this.bottle.obj.position.x +
      this.jumpAxis.x * this.bottle.velocity.vz * flyingTime
    const landZ =
      this.bottle.obj.position.z +
      this.jumpAxis.z * this.bottle.velocity.vz * flyingTime
    this.bottle.destination = [landX, landZ]

    const nextDist = Math.hypot(
      landX - this.nextBlock.obj.position.x,
      landZ - this.nextBlock.obj.position.z,
    )

    if (this.nextBlock.containsPoint(landX, landZ)) {
      return nextDist <= BLOCK.perfectDistance ? 'perfect' : 'ok'
    }
    if (this.currentBlock.containsPoint(landX, landZ)) {
      return 'current'
    }
    return 'miss'
  }

  private resolveLanding() {
    if (
      this.bottle.obj.position.y > BLOCK.height / 2 + 0.12 ||
      this.bottle.flyingTime < 0.25
    ) {
      return
    }

    if (this.bottle.obj.position.y <= GAME.groundY) {
      this.bottle.obj.position.y = GAME.groundY
      this.bottle.status = 'fall'
      this.tails.correctPosition()
      this.doubleHit = 0
      playFall()
      this.state = 'gameover'
      window.setTimeout(() => this.finishGameOver(), 600)
      return
    }

    const hit = this.predictedHit
    if (hit === 'perfect' || hit === 'ok') {
      this.bottle.obj.position.x = this.bottle.destination[0]
      this.bottle.obj.position.z = this.bottle.destination[1]
      this.bottle.stop()
      this.tails.correctPosition()
      this.onSuccess(hit === 'perfect')
      return
    }

    if (hit === 'current') {
      this.bottle.obj.position.x = this.bottle.destination[0]
      this.bottle.obj.position.z = this.bottle.destination[1]
      this.bottle.stop()
      this.tails.correctPosition()
      this.state = 'ready'
      this.doubleHit = 0
      return
    }

    this.bottle.obj.position.y = BLOCK.height / 2
    this.bottle.fall()
    this.tails.correctPosition()
    this.doubleHit = 0
    playFallEdge()
    this.state = 'gameover'
    window.setTimeout(() => this.finishGameOver(), 900)
  }

  private onSuccess(perfect: boolean) {
    this.succeedCount += 1
    if (perfect) {
      this.doubleHit += 1
      this.combo = this.combo === 0 ? 2 : this.combo + 2
      this.combo = clamp(this.combo, 0, 32)
      this.playWaves(min(this.doubleHit, 4))
    } else {
      this.doubleHit = 0
      this.combo = 1
    }

    const gained = this.combo
    this.score += gained
    if (this.score > this.best) {
      this.best = this.score
      setBestScore(this.best)
      this.beatBestThisRun = true
    }
    this.updateScoreUi()
    this.showFloatScore(gained, perfect)
    playLand(perfect, this.doubleHit)
    this.bottle.scatterParticles()
    this.bottle.squeeze()

    if (this.succeedCount % 15 === 0) {
      this.ground.changeColor()
    }

    this.advancePlatforms()
    this.state = 'ready'
  }

  private playWaves(count: number) {
    const { x, z } = this.bottle.obj.position
    for (let i = 0; i < count; i++) {
      this.waves[i]?.play(x, BLOCK.height / 2 + 0.1 * i + 0.2, z, i)
    }
  }

  private advancePlatforms() {
    const landed = this.nextBlock
    this.straight = this.pendingStraight

    const next = Block.createRandom([landed.color, this.currentBlock.color])
    const gap = landed.radius + this.nextGap + next.radius
    const pos = landed.obj.position.clone()
    if (this.straight) {
      pos.x += gap
      this.bottle.lookAt('straight')
    } else {
      pos.z -= gap
      this.bottle.lookAt('left')
    }
    next.showAt(pos.x, pos.z, true)
    playPop()
    this.scene.add(next.obj)
    this.blocks.push(next)

    this.currentBlock = landed
    this.nextBlock = next

    while (this.blocks.length > 6) {
      const old = this.blocks.shift()!
      this.scene.remove(old.obj)
      old.dispose()
    }

    this.cameraTarget.copy(this.midPoint(this.currentBlock, this.nextBlock))
  }

  private finishGameOver() {
    this.state = 'gameover'
    this.pointerDown = false
    this.finalScoreEl.textContent = String(this.score)
    const recordEl = document.getElementById('overlay-record')
    if (recordEl) {
      if (this.beatBestThisRun) $class.remove(recordEl, 'hidden')
      else $class.add(recordEl, 'hidden')
    }
    $class.remove(this.overlayEl, 'hidden')
    this.overlayEl.setAttribute('aria-hidden', 'false')
  }

  private hideOverlay() {
    $class.add(this.overlayEl, 'hidden')
    this.overlayEl.setAttribute('aria-hidden', 'true')
  }

  private updateScoreUi() {
    this.scoreEl.textContent = String(this.score)
    this.bestEl.textContent = String(this.best)
  }

  private showFloatScore(value: number, perfect: boolean) {
    this.floatEl.textContent = `+${value}`
    if (perfect) $class.add(this.floatEl, 'is-perfect')
    else $class.remove(this.floatEl, 'is-perfect')
    $class.remove(this.floatEl, 'is-show')
    void this.floatEl.offsetWidth
    $class.add(this.floatEl, 'is-show')
  }

  private midPoint(a: Block, b: Block) {
    return new THREE.Vector3(
      (a.obj.position.x + b.obj.position.x) / 2,
      0,
      (a.obj.position.z + b.obj.position.z) / 2,
    )
  }

  private snapCamera() {
    this.camera.position.set(
      this.cameraTarget.x + CAMERA_OFFSET.x,
      this.cameraTarget.y + CAMERA_OFFSET.y,
      this.cameraTarget.z + CAMERA_OFFSET.z,
    )
    // Orientation is set once; later updates only translate (like the original).
    this.camera.up.set(0, 1, 0)
    this.camera.lookAt(
      this.cameraTarget.x,
      this.cameraTarget.y,
      this.cameraTarget.z,
    )
    this.syncLightAndGround()
  }

  private updateCamera(dt: number) {
    const desired = new THREE.Vector3(
      this.cameraTarget.x + CAMERA_OFFSET.x,
      this.cameraTarget.y + CAMERA_OFFSET.y,
      this.cameraTarget.z + CAMERA_OFFSET.z,
    )
    // Pure translation — do not re-lookAt, or a lagging position would yaw/pitch.
    this.camera.position.lerp(desired, clamp(dt * 3.2, 0, 1))
    this.syncLightAndGround()
  }

  /**
   * Follow bottle like original update(): light at (x, 15, z+10).
   * Shadow maps don't get occluded by receive-only meshes — only casters block.
   * Blocks don't cast (avoids double fake+realtime contact shadows), so while the
   * bottle is seated we hide shadowGround and let the tabletop be the sole receiver.
   */
  private syncLightAndGround() {
    const b = this.bottle.obj.position
    this.keyLight.position.set(b.x, 15, b.z + 10)
    this.keyLight.target.position.set(b.x, 0, b.z)
    this.keyLight.target.updateMatrixWorld()
    const airborne =
      this.bottle.status === 'jump' ||
      this.bottle.status === 'fall' ||
      this.bottle.status === 'showup'
    this.shadowGround.visible = airborne
  }

  private onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement | null)?.closest?.('#overlay')) return
    this.beginCharge()
  }

  private onPointerUp = () => {
    this.endCharge()
  }

  private onResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const aspect = w / h
    this.renderer.setSize(w, h)
    this.camera.left = (-FRUSTUM_HEIGHT * aspect) / 2
    this.camera.right = (FRUSTUM_HEIGHT * aspect) / 2
    this.camera.top = FRUSTUM_HEIGHT / 2
    this.camera.bottom = -FRUSTUM_HEIGHT / 2
    this.camera.updateProjectionMatrix()
  }
}
