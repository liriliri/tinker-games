import * as THREE from 'three'

export class Game {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private cube: THREE.Mesh
  private clock = new THREE.Clock()

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setClearColor(0x1a1a2e)
    document.body.appendChild(this.renderer.domElement)

    // Scene
    this.scene = new THREE.Scene()

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    )
    this.camera.position.z = 4

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(2, 3, 4)
    this.scene.add(directionalLight)

    // Cube
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
    const material = new THREE.MeshStandardMaterial({
      color: 0xe94560,
      metalness: 0.3,
      roughness: 0.4,
    })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)

    // Edges for style
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x16213e })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    this.cube.add(wireframe)

    // Handle resize
    window.addEventListener('resize', () => this.onResize())
  }

  start() {
    this.animate()
  }

  private animate() {
    requestAnimationFrame(() => this.animate())

    const elapsed = this.clock.getElapsedTime()
    this.cube.rotation.x = elapsed * 0.5
    this.cube.rotation.y = elapsed * 0.8

    // Gentle floating
    this.cube.position.y = Math.sin(elapsed * 1.2) * 0.2

    this.renderer.render(this.scene, this.camera)
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
