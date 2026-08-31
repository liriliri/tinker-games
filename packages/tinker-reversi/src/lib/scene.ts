import * as THREE from "three";
import clamp from "licia/clamp";
import random from "licia/random";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  BOARD_SIZE,
  BLACK,
  CELL_COUNT,
  EMPTY,
  type Move,
  type Stone,
} from "../game/rules";

export const CELL_SPACING = 1.05;
export const GRID_SPAN = CELL_SPACING * BOARD_SIZE;
export const BOARD_TOP = 10.4;
const BOARD_Y = 0.72;
const STONE_Y = BOARD_Y + 0.075;
const DIAGONAL_FLIP_AXIS = new THREE.Vector3(1, 0, -1).normalize();

export type Cell = { row: number; column: number };

export type ReversiScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cursor: THREE.Group;
  animatedStones: Set<THREE.Object3D>;
  syncBoard: (
    board: Uint8Array,
    animatedCell?: number,
    flippedCells?: number[],
  ) => void;
  clearStones: () => void;
  updateLegalMoves: (moves: Move[]) => void;
  pickCell: (clientX: number, clientY: number) => Cell | null;
  orbit: (deltaX: number, deltaY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  resize: () => void;
};

export function cellToWorld(row: number, column: number) {
  return {
    x: (column + 0.5 - BOARD_SIZE / 2) * CELL_SPACING,
    z: (row + 0.5 - BOARD_SIZE / 2) * CELL_SPACING,
  };
}

function loadFabricTextures() {
  const loader = new THREE.TextureLoader();
  const color = loader.load("images/fabric.jpg");
  const normal = loader.load("images/fabric_normal.jpg");
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  color.repeat.set(1.4, 1.4);
  normal.repeat.set(1.4, 1.4);
  return { color, normal };
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

function makeTableTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#0b1b22";
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1700; i++) {
    const shade = random(12, 33);
    context.fillStyle = `rgba(${shade}, ${shade + 17}, ${shade + 22}, .2)`;
    context.fillRect(random(0, 256, true), random(0, 256, true), 1, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  return texture;
}

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(4, 16, 17, .6)");
  gradient.addColorStop(0.7, "rgba(4, 16, 17, .18)");
  gradient.addColorStop(1, "rgba(4, 16, 17, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function roundedBoardShape(size = BOARD_TOP) {
  const shape = new THREE.Shape();
  const half = size / 2;
  const radius = 0.3;
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
  const geometry = new THREE.ExtrudeGeometry(roundedBoardShape(), {
    depth: 0.6,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.09,
    bevelSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function roundedFrameGeometry(
  outerSize: number,
  innerSize: number,
  depth = 0.16,
) {
  const shape = roundedBoardShape(outerSize);
  const half = innerSize / 2;
  const radius = 0.24;
  const hole = new THREE.Path();
  hole.moveTo(-half + radius, -half);
  hole.lineTo(half - radius, -half);
  hole.quadraticCurveTo(half, -half, half, -half + radius);
  hole.lineTo(half, half - radius);
  hole.quadraticCurveTo(half, half, half - radius, half);
  hole.lineTo(-half + radius, half);
  hole.quadraticCurveTo(-half, half, -half, half - radius);
  hole.lineTo(-half, -half + radius);
  hole.quadraticCurveTo(-half, -half, -half + radius, -half);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.11,
    bevelSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function roundedFaceGeometry() {
  const faceSize = BOARD_TOP - 1.32;
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
  const material = new THREE.MeshBasicMaterial({
    color: 0x101b1b,
    transparent: true,
    opacity: 0.8,
  });
  const horizontalGeometry = new THREE.BoxGeometry(GRID_SPAN, 0.018, 0.04);
  const verticalGeometry = new THREE.BoxGeometry(0.04, 0.018, GRID_SPAN);
  for (let i = 0; i <= BOARD_SIZE; i++) {
    const coordinate = (i - BOARD_SIZE / 2) * CELL_SPACING;
    const horizontal = new THREE.Mesh(horizontalGeometry, material);
    horizontal.position.set(0, BOARD_Y + 0.018, coordinate);
    group.add(horizontal);
    const vertical = new THREE.Mesh(verticalGeometry, material);
    vertical.position.set(coordinate, BOARD_Y + 0.018, 0);
    group.add(vertical);
  }
  return group;
}

function makeCornerStarPoints() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0x050b0c,
    depthWrite: false,
  });
  for (const row of [2, BOARD_SIZE - 2]) {
    for (const column of [2, BOARD_SIZE - 2]) {
      const point = cellToWorld(row - 0.5, column - 0.5);
      const marker = new THREE.Mesh(
        new THREE.CircleGeometry(0.085, 24),
        material,
      );
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(point.x, BOARD_Y + 0.03, point.z);
      marker.renderOrder = 2;
      group.add(marker);
    }
  }
  return group;
}

function makeCornerMarker(color: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false,
  });
  const length = 0.18;
  const half = 0.54;
  const thickness = 0.035;
  const horizontalGeometry = new THREE.BoxGeometry(length, 0.018, thickness);
  const verticalGeometry = new THREE.BoxGeometry(thickness, 0.018, length);
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const horizontal = new THREE.Mesh(horizontalGeometry, material);
      horizontal.position.set(xSign * (half - length / 2), 0, zSign * half);
      horizontal.renderOrder = 10;
      group.add(horizontal);

      const vertical = new THREE.Mesh(verticalGeometry, material);
      vertical.position.set(xSign * half, 0, zSign * (half - length / 2));
      vertical.renderOrder = 10;
      group.add(vertical);
    }
  }
  return group;
}

export function createScene(): ReversiScene {
  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#091920");
  scene.fog = new THREE.Fog("#091920", 24, 52);
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  scene.environmentIntensity = 0.5;
  scene.environmentRotation.set(
    THREE.MathUtils.degToRad(25),
    THREE.MathUtils.degToRad(35),
    0,
  );
  environmentGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(camera);

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({
      map: makeTableTexture(),
      color: 0x829696,
      roughness: 0.95,
    }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.43;
  table.receiveShadow = true;
  scene.add(table);

  const boardBody = new THREE.Mesh(
    roundedBoardGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x172d2c,
      roughness: 0.78,
      metalness: 0,
    }),
  );
  boardBody.position.y = -0.05;
  boardBody.receiveShadow = true;
  scene.add(boardBody);

  const fabricTextures = loadFabricTextures();
  const boardFaceMaterial = new THREE.MeshPhysicalMaterial({
    map: fabricTextures.color,
    normalMap: fabricTextures.normal,
    normalScale: new THREE.Vector2(0.42, 0.42),
    color: 0x70977f,
    roughness: 0.48,
    metalness: 0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.92,
    side: THREE.DoubleSide,
  });
  boardFaceMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.boardLightPosition = {
      value: new THREE.Vector3(-8.5, 9, 12.5),
    };
    shader.uniforms.boardReflectionColor = {
      value: new THREE.Color(0xc9e5d9),
    };
    shader.fragmentShader = `
      uniform vec3 boardLightPosition;
      uniform vec3 boardReflectionColor;
      float boardHash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
      }
      float boardNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(
            boardHash(cell),
            boardHash(cell + vec2(1.0, 0.0)),
            local.x
          ),
          mix(
            boardHash(cell + vec2(0.0, 1.0)),
            boardHash(cell + vec2(1.0, 1.0)),
            local.x
          ),
          local.y
        );
      }
    ${shader.fragmentShader}`;
    shader.fragmentShader = shader.fragmentShader.replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      `float boardVariation = mix(
        0.84,
        1.12,
        boardNoise(vMapUv * 4.5) * 0.72 + boardNoise(vMapUv * 18.0) * 0.28
      );
      vec3 outgoingLight =
        totalDiffuse * boardVariation + totalSpecular + totalEmissiveRadiance;
      vec3 boardLightDirection = normalize(
        (viewMatrix * vec4(boardLightPosition, 1.0)).xyz - vViewPosition
      );
      vec3 boardViewDirection = normalize(-vViewPosition);
      vec3 boardHalfVector = normalize(boardLightDirection + boardViewDirection);
      float boardSpecular = pow(
        max(dot(normal, boardHalfVector), 0.0),
        10.0
      );
      float boardFresnel = pow(
        1.0 - max(dot(normal, boardViewDirection), 0.0),
        2.0
      );
      outgoingLight += boardReflectionColor *
        (boardSpecular * 0.48 + boardFresnel * 0.08);`,
    );
  };
  const boardFace = new THREE.Mesh(roundedFaceGeometry(), boardFaceMaterial);
  boardFace.position.y = BOARD_Y;
  boardFace.receiveShadow = true;
  scene.add(boardFace);

  const woodTextures = loadWoodTextures();
  const frame = new THREE.Mesh(
    roundedFrameGeometry(BOARD_TOP - 0.08, BOARD_TOP - 1.3),
    new THREE.MeshPhysicalMaterial({
      map: woodTextures.color,
      normalMap: woodTextures.normal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0xffffff,
      emissive: 0x4d2817,
      emissiveIntensity: 0.22,
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.52,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.56,
    }),
  );
  frame.position.y = BOARD_Y - 0.06;
  frame.castShadow = false;
  frame.receiveShadow = true;
  scene.add(frame);

  const frameProjectionShadow = new THREE.Mesh(
    roundedFrameGeometry(BOARD_TOP - 1.36, BOARD_TOP - 1.78, 0.008),
    new THREE.MeshBasicMaterial({
      color: 0x020808,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    }),
  );
  frameProjectionShadow.position.y = BOARD_Y + 0.006;
  frameProjectionShadow.renderOrder = 2;
  scene.add(frameProjectionShadow);

  const frameProjectionCore = new THREE.Mesh(
    roundedFrameGeometry(BOARD_TOP - 1.4, BOARD_TOP - 1.68, 0.008),
    new THREE.MeshBasicMaterial({
      color: 0x020808,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    }),
  );
  frameProjectionCore.position.y = BOARD_Y + 0.008;
  frameProjectionCore.renderOrder = 3;
  scene.add(frameProjectionCore);

  const frameProjectionInner = new THREE.Mesh(
    roundedFrameGeometry(BOARD_TOP - 1.46, BOARD_TOP - 1.58, 0.008),
    new THREE.MeshBasicMaterial({
      color: 0x020808,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  frameProjectionInner.position.y = BOARD_Y + 0.01;
  frameProjectionInner.renderOrder = 4;
  scene.add(frameProjectionInner);

  scene.add(makeGridOverlay());
  scene.add(makeCornerStarPoints());

  const blackTopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x101418,
    roughness: 0.11,
    metalness: 0.1,
    clearcoat: 0.78,
    clearcoatRoughness: 0.05,
    specularIntensity: 0.85,
    envMapIntensity: 0.92,
  });
  const whiteTopMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf1f1ec,
    roughness: 0.13,
    metalness: 0.07,
    clearcoat: 0.78,
    clearcoatRoughness: 0.055,
    specularIntensity: 0.85,
    envMapIntensity: 0.92,
  });
  const blackSideMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x151a1c,
    roughness: 0.16,
    metalness: 0.08,
    clearcoat: 0.72,
    clearcoatRoughness: 0.06,
  });
  const whiteSideMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8d7d0,
    roughness: 0.18,
    metalness: 0.06,
    clearcoat: 0.68,
    clearcoatRoughness: 0.07,
  });
  const stoneProfile = [
    new THREE.Vector2(0, -0.075),
    new THREE.Vector2(0.445, -0.075),
    new THREE.Vector2(0.455, -0.07),
    new THREE.Vector2(0.46, -0.062),
    new THREE.Vector2(0.46, 0),
    new THREE.Vector2(0.46, 0.062),
    new THREE.Vector2(0.455, 0.07),
    new THREE.Vector2(0.445, 0.075),
    new THREE.Vector2(0, 0.075),
  ];
  const stoneGeometry = new THREE.LatheGeometry(stoneProfile, 36);
  const stoneSurfaceCount = stoneProfile.length - 1;
  for (let segment = 0; segment < 36; segment++) {
    for (let surface = 0; surface < stoneSurfaceCount; surface++) {
      const groupStart = (segment * stoneSurfaceCount + surface) * 6;
      stoneGeometry.addGroup(
        groupStart,
        6,
        surface <= 3 ? 0 : surface <= 6 ? 1 : 2,
      );
    }
  }
  const shadowGeometry = new THREE.CircleGeometry(0.41, 32);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: makeContactShadowTexture(),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const stones: Array<THREE.Mesh | null> = Array(CELL_COUNT).fill(null);
  const stoneShadows: Array<THREE.Mesh | null> = Array(CELL_COUNT).fill(null);
  const animatedStones = new Set<THREE.Object3D>();

  const cursor = new THREE.Group();
  cursor.add(makeCornerMarker(0x4cb4ff));
  cursor.position.y = BOARD_Y + 0.035;
  cursor.renderOrder = 10;
  scene.add(cursor);

  const legalMarkers: THREE.Mesh[] = [];
  const legalMarkerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
  });
  for (let i = 0; i < CELL_COUNT; i++) {
    const marker = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 18),
      legalMarkerMaterial,
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = BOARD_Y + 0.035;
    marker.renderOrder = 3;
    marker.visible = false;
    scene.add(marker);
    legalMarkers.push(marker);
  }

  const keyLight = new THREE.DirectionalLight(0xd8f2dc, 1.05);
  keyLight.position.set(-8.5, 9, 12.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.bias = -0.001;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xc4e5e0, 0x10272a, 0.3));
  const rimLight = new THREE.PointLight(0xe1a561, 4, 28, 2);
  rimLight.position.set(5, 4, -10);
  scene.add(rimLight);
  const sideFillLight = new THREE.PointLight(0x9bcac2, 2.2, 25, 2);
  sideFillLight.position.set(10, 4.5, 4);
  scene.add(sideFillLight);
  const backFillLight = new THREE.PointLight(0xc88e65, 1.5, 25, 2);
  backFillLight.position.set(-9, 3.5, -7);
  scene.add(backFillLight);
  const boardSoftbox = new THREE.RectAreaLight(0xffead0, 7, 5, 2.5);
  boardSoftbox.position.set(-4, 5.5, 9);
  boardSoftbox.lookAt(0, BOARD_Y, 0);
  scene.add(boardSoftbox);
  const boardFillbox = new THREE.RectAreaLight(0x9ed9d2, 4, 4, 2);
  boardFillbox.position.set(7, 4.5, -5);
  boardFillbox.lookAt(0, BOARD_Y, 0);
  scene.add(boardFillbox);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_Y);
  const hit = new THREE.Vector3();
  let orbitYaw = 0;
  let orbitPitch = 0.45;
  let orbitDistance = 15;
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
    const verticalFit =
      BOARD_TOP / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    orbitDistance = verticalFit * Math.max(1, 1 / camera.aspect) * 1.16;
    applyCameraOrbit();
    camera.updateProjectionMatrix();
  };

  const pickCell = (clientX: number, clientY: number): Cell | null => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
    const column = Math.floor(hit.x / CELL_SPACING + BOARD_SIZE / 2);
    const row = Math.floor(hit.z / CELL_SPACING + BOARD_SIZE / 2);
    if (row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE)
      return null;
    return { row, column };
  };

  const addStone = (
    cell: number,
    stone: Stone,
    row: number,
    column: number,
    animate: boolean,
  ) => {
    const { x, z } = cellToWorld(row, column);
    let shadow = stoneShadows[cell];
    if (!shadow) {
      shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = 1;
      scene.add(shadow);
      stoneShadows[cell] = shadow;
    }
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, BOARD_Y + 0.006, z);
    shadow.visible = true;

    let mesh = stones[cell];
    if (!mesh) {
      mesh = new THREE.Mesh(stoneGeometry);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.isStone = true;
      scene.add(mesh);
      stones[cell] = mesh;
    }
    animatedStones.delete(mesh);
    mesh.material =
      stone === BLACK
        ? [whiteTopMaterial, blackSideMaterial, blackTopMaterial]
        : [blackTopMaterial, whiteSideMaterial, whiteTopMaterial];
    mesh.position.set(x, STONE_Y + (animate ? 1.0 : 0), z);
    mesh.visible = true;
    mesh.scale.set(1, 1, 1);
    mesh.quaternion.identity();
    mesh.userData.dropStart = animate ? performance.now() : 0;
    mesh.userData.flipStart = 0;
    mesh.userData.flipAxis = undefined;
    if (animate) animatedStones.add(mesh);
    return mesh;
  };

  const clearStones = () => {
    for (const stone of stones) {
      if (!stone) continue;
      stone.visible = false;
      stone.userData.dropStart = 0;
      stone.userData.flipStart = 0;
      stone.userData.flipAxis = undefined;
    }
    for (const shadow of stoneShadows) {
      if (shadow) shadow.visible = false;
    }
    animatedStones.clear();
  };

  const syncBoard = (
    board: Uint8Array,
    animatedCell?: number,
    flippedCells: number[] = [],
  ) => {
    const flipOrder = new Map(flippedCells.map((cell, order) => [cell, order]));
    const cells =
      animatedCell === undefined && flippedCells.length === 0
        ? Array.from({ length: board.length }, (_, cell) => cell)
        : (() => {
            const affected = new Set(flippedCells);
            if (animatedCell !== undefined) affected.add(animatedCell);
            return affected;
          })();

    if (animatedCell === undefined && flippedCells.length === 0) {
      clearStones();
    }

    for (const cell of cells) {
      if (board[cell] === EMPTY) {
        const stone = stones[cell];
        const shadow = stoneShadows[cell];
        if (stone) {
          stone.visible = false;
          animatedStones.delete(stone);
        }
        if (shadow) shadow.visible = false;
        continue;
      }
      const flipIndex = flipOrder.get(cell);
      const isFlipping = flipIndex !== undefined;
      const stone = addStone(
        cell,
        board[cell] as Stone,
        Math.floor(cell / BOARD_SIZE),
        cell % BOARD_SIZE,
        cell === animatedCell && !isFlipping,
      );
      if (isFlipping) {
        stone.userData.flipStart = performance.now() + flipIndex * 40;
        stone.userData.flipAxis = DIAGONAL_FLIP_AXIS.clone();
        stone.quaternion.setFromAxisAngle(DIAGONAL_FLIP_AXIS, Math.PI);
        animatedStones.add(stone);
      }
    }
  };

  const updateLegalMoves = (moves: Move[]) => {
    legalMarkers.forEach((marker, i) => {
      const move = moves[i];
      marker.visible = Boolean(move);
      if (move) {
        const point = cellToWorld(move.row, move.column);
        marker.position.x = point.x;
        marker.position.z = point.z;
      }
    });
  };

  resize();
  return {
    renderer,
    scene,
    camera,
    cursor,
    animatedStones,
    syncBoard,
    clearStones,
    updateLegalMoves,
    pickCell,
    orbit,
    pan,
    resize,
  };
}

export function updateSceneMotion(gameScene: ReversiScene, now: number) {
  let hasMotion = gameScene.cursor.visible;
  if (gameScene.cursor.visible) {
    const pulse = 1 + Math.sin(now * 0.005) * 0.055;
    gameScene.cursor.scale.set(pulse, 1, pulse);
  }
  for (const child of gameScene.animatedStones) {
    hasMotion = true;
    const flipStart = child.userData.flipStart as number | undefined;
    if (flipStart) {
      const progress = clamp((now - flipStart) / 620, 0, 1);
      const liftProgress = clamp(progress / 0.3, 0, 1);
      const flipProgress = clamp((progress - 0.34) / 0.28, 0, 1);
      const landProgress = clamp((progress - 0.68) / 0.32, 0, 1);
      const liftEased = 1 - Math.pow(1 - liftProgress, 3);
      const flipEased = flipProgress * flipProgress * (3 - 2 * flipProgress);
      const landEased = landProgress * landProgress * (3 - 2 * landProgress);
      const height =
        progress < 0.3
          ? 0.72 * liftEased
          : progress < 0.68
            ? 0.72
            : 0.72 * (1 - landEased);
      child.position.y = STONE_Y + height;
      const flipAxis = child.userData.flipAxis as THREE.Vector3;
      child.quaternion.setFromAxisAngle(flipAxis, Math.PI * (1 - flipEased));
      if (progress >= 1) {
        child.userData.flipStart = 0;
        child.userData.flipAxis = undefined;
        child.position.y = STONE_Y;
        child.quaternion.identity();
        gameScene.animatedStones.delete(child);
      }
      continue;
    }
    const start = child.userData.dropStart as number | undefined;
    if (!start) continue;
    const progress = clamp((now - start) / 320, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    child.position.y = STONE_Y + 1.0 * (1 - eased);
    if (child.userData.isStone) {
      child.scale.set(
        1 + Math.sin(progress * Math.PI) * 0.025,
        1,
        1 + Math.sin(progress * Math.PI) * 0.025,
      );
    }
    if (progress >= 1) {
      child.userData.dropStart = 0;
      child.position.y = STONE_Y;
      child.scale.set(1, 1, 1);
      gameScene.animatedStones.delete(child);
    }
  }
  return hasMotion;
}
