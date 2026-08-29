import * as THREE from "three";
import clamp from "licia/clamp";
import { BOARD_SIZE, BLACK, type Stone } from "./game/rules";

export const GRID_SPAN = BOARD_SIZE - 1;
export const BOARD_TOP = 16.25;
const BOARD_Y = 0.72;
const STONE_SCALE_Y = 0.42;
const STONE_Y = BOARD_Y + 0.41 * STONE_SCALE_Y;
const WIN_LINE_Y = STONE_Y + 0.25;

export type Cell = { row: number; column: number };

export type GomokuScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cursor: THREE.Group;
  lastMark: THREE.Mesh;
  winGroup: THREE.Group;
  winBar: THREE.Mesh;
  winRings: THREE.Mesh[];
  addStone: (
    stone: Stone,
    row: number,
    column: number,
    animate: boolean,
  ) => THREE.Object3D;
  clearStones: () => void;
  updateWinLine: (line: [number, number][]) => void;
  pickCell: (clientX: number, clientY: number) => Cell | null;
  orbit: (deltaX: number, deltaY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  resize: () => void;
};

export function cellToWorld(row: number, column: number) {
  return {
    x: column - GRID_SPAN / 2,
    z: row - GRID_SPAN / 2,
  };
}

function makeTableTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#141a22";
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1700; i++) {
    const shade = 20 + Math.floor(Math.random() * 20);
    context.fillStyle = `rgba(${shade + 6}, ${shade + 10}, ${shade + 15}, .16)`;
    context.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  return texture;
}

function loadWoodTextures() {
  const loader = new THREE.TextureLoader();
  const color = loader.load("images/wood.jpg");
  const normal = loader.load("images/wood_normal.jpg");
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  color.repeat.set(1.6, 1.6);
  normal.repeat.set(1.6, 1.6);
  color.center.set(0.5, 0.5);
  normal.center.set(0.5, 0.5);
  color.rotation = Math.PI / 2;
  normal.rotation = Math.PI / 2;
  color.anisotropy = 4;
  normal.anisotropy = 4;
  return { color, normal };
}

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(13, 13, 13, 0.56)");
  gradient.addColorStop(0.5, "rgba(13, 13, 13, 0.46)");
  gradient.addColorStop(0.82, "rgba(13, 13, 13, 0.2)");
  gradient.addColorStop(1, "rgba(13, 13, 13, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function roundedBoardShape(size = BOARD_TOP) {
  const shape = new THREE.Shape();
  const half = size / 2;
  const radius = 0.35;
  shape.moveTo(-half + radius, -half);
  shape.lineTo(half - radius, -half);
  shape.quadraticCurveTo(half, -half, half, -half + radius);
  shape.lineTo(half, half - radius);
  shape.quadraticCurveTo(half, half, half - radius, half);
  shape.lineTo(-half + radius, half);
  shape.quadraticCurveTo(-half, half, -half, half - radius);
  shape.lineTo(-half, -half + radius);
  shape.quadraticCurveTo(-half, -half, -half + radius, -half);
  return shape;
}

function roundedBoardGeometry() {
  const shape = roundedBoardShape();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.1,
    bevelSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function roundedFaceGeometry() {
  const faceSize = BOARD_TOP - 0.2;
  const geometry = new THREE.ShapeGeometry(roundedBoardShape(faceSize));
  const position = geometry.getAttribute("position");
  const uv: number[] = [];
  for (let i = 0; i < position.count; i++) {
    uv.push(
      (position.getX(i) + faceSize / 2) / faceSize,
      (position.getY(i) + faceSize / 2) / faceSize,
    );
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function makeGridOverlay() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0x211008 });
  const horizontalGeometry = new THREE.BoxGeometry(GRID_SPAN, 0.018, 0.038);
  const verticalGeometry = new THREE.BoxGeometry(0.038, 0.018, GRID_SPAN);

  for (let i = 0; i < BOARD_SIZE; i++) {
    const coordinate = i - GRID_SPAN / 2;
    const horizontal = new THREE.Mesh(horizontalGeometry, material);
    horizontal.position.set(0, BOARD_Y + 0.012, coordinate);
    group.add(horizontal);
    const vertical = new THREE.Mesh(verticalGeometry, material);
    vertical.position.set(coordinate, BOARD_Y + 0.012, 0);
    group.add(vertical);
  }
  return group;
}

export function createScene(): GomokuScene {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0e131a");
  scene.fog = new THREE.Fog("#0e131a", 30, 65);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(camera);

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      map: makeTableTexture(),
      color: 0x9aa3ac,
      roughness: 0.96,
    }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.46;
  table.receiveShadow = true;
  scene.add(table);

  const boardBody = new THREE.Mesh(
    roundedBoardGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x6e421f,
      roughness: 0.5,
      metalness: 0.02,
    }),
  );
  boardBody.position.y = -0.1;
  boardBody.castShadow = false;
  boardBody.receiveShadow = true;
  scene.add(boardBody);

  const woodTextures = loadWoodTextures();
  const boardFace = new THREE.Mesh(
    roundedFaceGeometry(),
    new THREE.MeshStandardMaterial({
      map: woodTextures.color,
      normalMap: woodTextures.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0xffffff,
      roughness: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  const boardFaceMaterial = boardFace.material as THREE.MeshStandardMaterial;
  boardFaceMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float woodLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(vec3(woodLuminance), diffuseColor.rgb, 0.72);
      diffuseColor.rgb *= vec3(0.96, 1.0, 1.03);`,
    );
  };
  boardFace.position.y = BOARD_Y;
  boardFace.receiveShadow = true;
  scene.add(boardFace);

  const gridOverlay = makeGridOverlay();
  scene.add(gridOverlay);
  const starMaterial = new THREE.MeshBasicMaterial({ color: 0x3a2416 });
  for (const [row, column] of [
    [3, 3],
    [3, 11],
    [7, 7],
    [11, 3],
    [11, 11],
  ]) {
    const star = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 16),
      starMaterial,
    );
    const point = cellToWorld(row, column);
    star.rotation.x = -Math.PI / 2;
    star.position.set(point.x, BOARD_Y + 0.02, point.z);
    scene.add(star);
  }

  const blackMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x10151b,
    roughness: 0.18,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });
  const whiteMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf3ead8,
    roughness: 0.24,
    clearcoat: 0.65,
    clearcoatRoughness: 0.16,
  });
  const stoneGeometry = new THREE.SphereGeometry(0.41, 28, 18);
  const shadowGeometry = new THREE.CircleGeometry(0.44, 32);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: makeContactShadowTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const stones: THREE.Object3D[] = [];
  const stoneShadows: THREE.Object3D[] = [];

  const cursor = new THREE.Group();
  const cursorMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.86,
    depthTest: false,
  });
  const cursorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.43, 0.47, 32),
    cursorMaterial,
  );
  cursorRing.rotation.x = -Math.PI / 2;
  cursor.add(cursorRing);
  cursor.position.y = BOARD_Y + 0.025;
  cursor.renderOrder = 4;
  scene.add(cursor);

  const lastMark = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.2, 32),
    new THREE.MeshBasicMaterial({
      color: 0xe05d45,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  );
  lastMark.rotation.x = -Math.PI / 2;
  lastMark.position.y = BOARD_Y + 0.035;
  lastMark.renderOrder = 5;
  lastMark.visible = false;
  scene.add(lastMark);

  const winGroup = new THREE.Group();
  const winBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
      roughness: 0.3,
    }),
  );
  winGroup.add(winBar);
  winGroup.visible = false;
  scene.add(winGroup);

  const winRings: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.026, 8, 32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.5,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    winRings.push(ring);
  }

  const keyLight = new THREE.DirectionalLight(0xffe7c2, 2.2);
  keyLight.position.set(-5, 20, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.001;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xd6e3f0, 0x1f1713, 0.65));
  const rimLight = new THREE.PointLight(0x5e9bca, 18, 35, 2);
  rimLight.position.set(7, 8, -11);
  scene.add(rimLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_Y);
  const hit = new THREE.Vector3();
  let orbitYaw = 0;
  let orbitPitch = 0.45;
  let orbitDistance = 20;
  const orbitTarget = new THREE.Vector3();

  const applyCameraOrbit = () => {
    const topDown = orbitPitch < 0.001;
    const horizontal = Math.sin(orbitPitch) * orbitDistance;
    camera.up.set(0, topDown ? 0 : 1, topDown ? -1 : 0);
    camera.position.set(
      orbitTarget.x + Math.sin(orbitYaw) * horizontal,
      orbitTarget.y +
        (topDown ? orbitDistance : Math.cos(orbitPitch) * orbitDistance),
      orbitTarget.z + Math.cos(orbitYaw) * horizontal,
    );
    camera.lookAt(orbitTarget);
  };

  const orbit = (deltaX: number, deltaY: number) => {
    orbitYaw -= deltaX * 0.008;
    orbitPitch = clamp(orbitPitch - deltaY * 0.006, 0, 1.15);
    applyCameraOrbit();
  };

  const pan = (deltaX: number, deltaY: number) => {
    const right = new THREE.Vector3().setFromMatrixColumn(
      camera.matrixWorld,
      0,
    );
    right.y = 0;
    right.normalize();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();
    else forward.set(0, 0, -1);
    const panScale = orbitDistance * 0.0012;
    orbitTarget.addScaledVector(right, -deltaX * panScale);
    orbitTarget.addScaledVector(forward, deltaY * panScale);
    applyCameraOrbit();
  };

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = width / height;
    const aspect = width / height;
    const verticalFit =
      BOARD_TOP / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    orbitDistance = verticalFit * Math.max(1, 1 / aspect) * 1.12;
    applyCameraOrbit();
    camera.updateProjectionMatrix();
  };

  const pickCell = (clientX: number, clientY: number): Cell | null => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
    const column = Math.round(hit.x + GRID_SPAN / 2);
    const row = Math.round(hit.z + GRID_SPAN / 2);
    if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE)
      return null;
    return { row, column };
  };

  const addStone = (
    stone: Stone,
    row: number,
    column: number,
    animate: boolean,
  ) => {
    const { x, z } = cellToWorld(row, column);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x + 0.09, BOARD_Y + 0.006, z - 0.09);
    shadow.renderOrder = 1;
    scene.add(shadow);
    stoneShadows.push(shadow);

    const mesh = new THREE.Mesh(
      stoneGeometry,
      stone === BLACK ? blackMaterial : whiteMaterial,
    );
    mesh.position.set(x, STONE_Y + (animate ? 1.1 : 0), z);
    mesh.scale.set(1, STONE_SCALE_Y, 1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.dropStart = animate ? performance.now() : 0;
    scene.add(mesh);
    stones.push(mesh);
    return mesh;
  };

  const clearStones = () => {
    for (const stone of stones) scene.remove(stone);
    for (const shadow of stoneShadows) scene.remove(shadow);
    stones.length = 0;
    stoneShadows.length = 0;
    lastMark.visible = false;
    winGroup.visible = false;
    for (const ring of winRings) ring.visible = false;
  };

  const updateWinLine = (line: [number, number][]) => {
    if (line.length < 2) return;
    const first = cellToWorld(line[0][0], line[0][1]);
    const final = cellToWorld(
      line[line.length - 1][0],
      line[line.length - 1][1],
    );
    const dx = final.x - first.x;
    const dz = final.z - first.z;
    const length = Math.hypot(dx, dz);
    winGroup.position.set(
      (first.x + final.x) / 2,
      WIN_LINE_Y,
      (first.z + final.z) / 2,
    );
    winBar.scale.set(1, 0.001, 1);
    winGroup.userData.winStart = performance.now();
    winGroup.userData.winLength = length + 0.55;
    winBar.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx, 0, dz).normalize(),
    );
    winGroup.visible = true;
    line.slice(0, 5).forEach(([row, column], index) => {
      const point = cellToWorld(row, column);
      winRings[index].position.set(point.x, WIN_LINE_Y, point.z);
      winRings[index].scale.setScalar(0.001);
      winRings[index].visible = true;
    });
  };

  resize();
  return {
    renderer,
    scene,
    camera,
    cursor,
    lastMark,
    winGroup,
    winBar,
    winRings,
    addStone,
    clearStones,
    updateWinLine,
    pickCell,
    orbit,
    pan,
    resize,
  };
}

export function updateSceneMotion(gameScene: GomokuScene, now: number) {
  const pulse = 1 + Math.sin(now * 0.005) * 0.055;
  gameScene.cursor.scale.set(pulse, 1, pulse);
  if (gameScene.winGroup.visible) {
    const winStart = gameScene.winGroup.userData.winStart as number | undefined;
    if (winStart) {
      const progress = clamp((now - winStart) / 1000, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const winLength = gameScene.winGroup.userData.winLength as number;
      gameScene.winBar.scale.y = winLength * eased;
      gameScene.winRings.forEach((ring, index) => {
        const ringProgress = clamp((progress - index * 0.08) * 4, 0, 1);
        ring.scale.setScalar(clamp(ringProgress, 0.001, 1));
      });
      if (progress >= 1) gameScene.winGroup.userData.winStart = 0;
    }
    const intensity = 1.2 + Math.sin(now * 0.006) * 0.55;
    (
      gameScene.winBar.material as THREE.MeshStandardMaterial
    ).emissiveIntensity = intensity;
    for (const ring of gameScene.winRings) {
      (ring.material as THREE.MeshStandardMaterial).emissiveIntensity =
        intensity;
    }
  }
  if (gameScene.lastMark.visible) {
    const markScale = 1 + Math.sin(now * 0.007) * 0.1;
    gameScene.lastMark.scale.set(markScale, markScale, 1);
  }

  for (const child of gameScene.scene.children) {
    const start = child.userData.dropStart as number | undefined;
    if (!start) continue;
    const progress = clamp((now - start) / 320, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    child.position.y = STONE_Y + 1.1 * (1 - eased);
    child.scale.y = STONE_SCALE_Y + Math.sin(progress * Math.PI) * 0.06;
    if (progress >= 1) {
      child.userData.dropStart = 0;
      child.position.y = STONE_Y;
      child.scale.y = STONE_SCALE_Y;
    }
  }
}
