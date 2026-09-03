import * as THREE from "three";
import clamp from "licia/clamp";
import each from "licia/each";
import Emitter from "licia/Emitter";
import find from "licia/find";
import isEqual from "licia/isEqual";
import last from "licia/last";
import map from "licia/map";
import max from "licia/max";
import min from "licia/min";
import perfNow from "licia/perfNow";
import random from "licia/random";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import {
  BOARD_SIZE,
  COLUMNS,
  columnOf,
  darkPosToCell,
  isKing,
  movePath,
  pieceSide,
  ROWS,
  rowOf,
  type Move,
  type Piece,
} from "../game/rules";

const BOARD_Y = 0.62;
const FACE_TOP = BOARD_Y - 0.05;
const PIECE_BASE_Y = FACE_TOP + 0.006;
const PIECE_MOVE_BASE_DURATION = 220;
const PIECE_MOVE_LIFT = 0.28;
const CAPTURE_DISAPPEAR_PROGRESS = 0.55;
const WHITE_COLOR = 0xbdbdb8;
const BLACK_COLOR = 0x161616;

export type Cell = { row: number; column: number };

export type CheckersScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cursor: THREE.Object3D;
  selected: THREE.Object3D;
  targets: THREE.Group;
  lastMark: THREE.Object3D;
  syncBoard: (board: Int8Array, move?: Move | null) => void;
  updatePieceMotion: (now: number) => boolean;
  isPieceMoving: () => boolean;
  /** Register a listener; returns unsubscribe. */
  onPieceMotionComplete: (callback: () => void) => () => void;
  updateSelection: (selected: number | null, legalTargets: number[]) => void;
  updateLastMove: (cell: number | null) => void;
  pickCell: (clientX: number, clientY: number) => Cell | null;
  orbit: (deltaX: number, deltaY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  settleView: () => void;
  resize: () => void;
};

export function cellToWorld(row: number, column: number) {
  // Flip rows so Dark (black, ranks 0–2) sits near the camera.
  return {
    x: column - (COLUMNS - 1) / 2,
    z: ROWS - 1 - row - (ROWS - 1) / 2,
  };
}

function makeMarker(color: number, ring: boolean): THREE.Object3D {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: ring ? 0.9 : 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  if (ring) {
    const marker = new THREE.Group();
    for (const [innerRadius, outerRadius] of [
      [0.34, 0.39],
      [0.46, 0.51],
    ]) {
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, outerRadius, 48),
        material,
      );
      circle.rotation.x = -Math.PI / 2;
      circle.renderOrder = 10;
      marker.add(circle);
    }
    marker.position.y = FACE_TOP + 0.02;
    return marker;
  }
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = FACE_TOP + 0.02;
  mesh.renderOrder = 9;
  return mesh;
}

function makeBoardShadow() {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        shadowColor: { value: new THREE.Color(0x050806) },
        opacity: { value: 0.62 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 shadowColor;
        uniform float opacity;
        varying vec2 vUv;
        void main() {
          float edge = max(abs(vUv.x * 2.0 - 1.0), abs(vUv.y * 2.0 - 1.0));
          float alpha = 1.0 - smoothstep(0.84, 1.0, edge);
          gl_FragColor = vec4(shadowColor, alpha * opacity);
        }
      `,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.202;
  shadow.renderOrder = 0;
  return shadow;
}

function makeFrameSurface(
  points: readonly (readonly [number, number])[],
  material: THREE.Material,
  rotateTexture = false,
  flipU = false,
) {
  const geometry = new THREE.BufferGeometry();
  const positions = points.flatMap(([x, z]) => [x, FACE_TOP - 0.018, z]);
  const uvs = points.flatMap(([x, z]) => {
    const u = rotateTexture ? (z + 4.6) / 9.2 : (x + 4.6) / 9.2;
    const v = rotateTexture ? (x + 4.6) / 9.2 : (z + 4.6) / 9.2;
    return [flipU ? 1 - u : u, v];
  });
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function paintNoise(
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  intensity: number,
) {
  const image = context.getImageData(x0, y0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (random(0, 1, true) - 0.5) * 18 * intensity;
    data[i] = clamp(data[i]! + n, 0, 255);
    data[i + 1] = clamp(data[i + 1]! + n, 0, 255);
    data[i + 2] = clamp(data[i + 2]! + n, 0, 255);
  }
  context.putImageData(image, x0, y0);
}

function paintScratches(
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  width: number,
  height: number,
  scratch: [number, number, number],
  count: number,
  intensity: number,
  lengthRange: [number, number],
  widthRange: [number, number],
) {
  const [sr, sg, sb] = scratch;
  for (let i = 0; i < count; i++) {
    const alpha = (0.04 + random(0, 0.1, true)) * intensity;
    context.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
    context.lineWidth = random(widthRange[0], widthRange[1], true);
    context.beginPath();
    const x = x0 + random(0, width, true);
    const y = y0 + random(0, height, true);
    const length = random(lengthRange[0], lengthRange[1], true);
    const angle = random(0, Math.PI, true);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
}

function paintScratchCell(
  context: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cell: number,
  base: [number, number, number],
  scratch: [number, number, number],
) {
  const [br, bg, bb] = base;
  context.fillStyle = `rgb(${br}, ${bg}, ${bb})`;
  context.fillRect(x0, y0, cell, cell);
  paintNoise(context, x0, y0, cell, cell, 1);
  context.save();
  context.beginPath();
  context.rect(x0, y0, cell, cell);
  context.clip();
  paintScratches(
    context,
    x0,
    y0,
    cell,
    cell,
    scratch,
    28,
    1,
    [12, 60],
    [0.6, 1.8],
  );
  context.restore();
}

function makeBoardFaceTexture() {
  const cell = 128;
  const size = cell * BOARD_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const light: [number, number, number] = [212, 212, 208];
  const dark: [number, number, number] = [26, 26, 26];
  const lightScratch: [number, number, number] = [70, 70, 66];
  const darkScratch: [number, number, number] = [210, 210, 205];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      const lightSquare = (row + column) % 2 === 0;
      // Plane UV samples image bottom at +Z (row 0), so flip canvas rows.
      paintScratchCell(
        context,
        column * cell,
        (BOARD_SIZE - 1 - row) * cell,
        cell,
        lightSquare ? light : dark,
        lightSquare ? lightScratch : darkScratch,
      );
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function makeScratchTexture(
  base: [number, number, number],
  scratch: [number, number, number],
  intensity = 1,
) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const [br, bg, bb] = base;
  context.fillStyle = `rgb(${br}, ${bg}, ${bb})`;
  context.fillRect(0, 0, size, size);
  paintNoise(context, 0, 0, size, size, intensity);
  paintScratches(
    context,
    0,
    0,
    size,
    size,
    scratch,
    Math.round(42 * intensity),
    intensity,
    [18, 88],
    [0.6, 2],
  );
  const [sr, sg, sb] = scratch;
  const fineCount = Math.round(18 * intensity);
  for (let i = 0; i < fineCount; i++) {
    const alpha = (0.03 + random(0, 0.07, true)) * intensity;
    context.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
    context.lineWidth = 0.4 + random(0, 1, true);
    context.beginPath();
    const x = random(0, size, true);
    const y = random(0, size, true);
    const length = random(8, 36, true);
    const angle = (random(0, 1, true) - 0.5) * 0.5 + (i % 2 === 0 ? 0.2 : 1.4);
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeBoard() {
  const group = new THREE.Group();
  const boardSize = 9.2;
  const boardHeight = 0.34;
  const frameMap = makeScratchTexture([8, 8, 8], [70, 70, 68], 0.28);
  frameMap.repeat.set(2.4, 2.4);
  const sideMap = makeScratchTexture([4, 4, 4], [55, 55, 54], 0.24);
  sideMap.repeat.set(2.8, 0.4);

  const frameMaterial = new THREE.MeshStandardMaterial({
    map: frameMap,
    color: 0x1a1a1a,
    roughness: 0.82,
    metalness: 0.02,
  });
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: sideMap,
    color: 0x121212,
    roughness: 0.86,
    metalness: 0.02,
  });

  // Box face order: +x, -x, +y, -y, +z, -z
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(boardSize, boardHeight, boardSize),
    [
      sideMaterial,
      sideMaterial,
      frameMaterial,
      frameMaterial,
      sideMaterial,
      sideMaterial,
    ],
  );
  base.position.y = BOARD_Y - 0.24;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  group.add(
    makeFrameSurface(
      [
        [-4.6, -4.6],
        [4.6, -4.6],
        [4.6, -4],
        [-4.6, -4],
      ],
      frameMaterial,
      true,
    ),
    makeFrameSurface(
      [
        [-4.6, 4],
        [4.6, 4],
        [4.6, 4.6],
        [-4.6, 4.6],
      ],
      frameMaterial.clone(),
      true,
      true,
    ),
    makeFrameSurface(
      [
        [-4.6, -4],
        [-4, -4],
        [-4, 4],
        [-4.6, 4],
      ],
      frameMaterial.clone(),
      true,
    ),
    makeFrameSurface(
      [
        [4, -4],
        [4.6, -4],
        [4.6, 4],
        [4, 4],
      ],
      frameMaterial.clone(),
      true,
    ),
  );

  const faceMap = makeBoardFaceTexture();
  const faceGeometry = new THREE.PlaneGeometry(8, 8);
  faceGeometry.rotateX(-Math.PI / 2);
  const face = new THREE.Mesh(
    faceGeometry,
    new THREE.MeshStandardMaterial({
      map: faceMap,
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    }),
  );
  face.position.y = FACE_TOP;
  face.receiveShadow = true;
  group.add(face);

  const underFace = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.06, 8),
    new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.9,
    }),
  );
  underFace.position.y = FACE_TOP - 0.04;
  underFace.receiveShadow = true;
  group.add(underFace);

  const borderMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b1117,
    roughness: 0.38,
    metalness: 0.18,
  });
  for (const [width, height, x, z] of [
    [8.02, 0.04, 0, -4.01],
    [8.02, 0.04, 0, 4.01],
    [0.04, 8.02, -4.01, 0],
    [0.04, 8.02, 4.01, 0],
  ] as const) {
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.04, height),
      borderMaterial,
    );
    border.position.set(x, FACE_TOP - 0.02, z);
    group.add(border);
  }
  return group;
}

function checkerRingRadii(outerRadius: number) {
  return map([0.22, 0.4, 0.58, 0.76], (t) => outerRadius * t);
}

/** Classic draughts disc: short cylinder with concentric face grooves. */
function makeCheckerProfile(height: number, outerRadius = 0.4) {
  const rim = 0.018;
  const groove = 0.012;
  const ridge = height > 0.2 ? 0.016 : 0.014;
  const rings = checkerRingRadii(outerRadius - 0.04);
  const points: THREE.Vector2[] = [new THREE.Vector2(0, ridge)];

  for (const radius of rings) {
    points.push(new THREE.Vector2(radius - groove * 1.4, ridge));
    points.push(new THREE.Vector2(radius - groove * 0.35, 0.002));
    points.push(new THREE.Vector2(radius + groove * 0.35, 0.002));
    points.push(new THREE.Vector2(radius + groove * 1.4, ridge));
  }

  points.push(
    new THREE.Vector2(outerRadius - 0.028, ridge),
    new THREE.Vector2(outerRadius - 0.006, rim),
    new THREE.Vector2(outerRadius, rim + 0.01),
    new THREE.Vector2(outerRadius, height - rim - 0.01),
    new THREE.Vector2(outerRadius - 0.006, height - rim),
    new THREE.Vector2(outerRadius - 0.028, height - ridge),
  );

  for (let i = rings.length - 1; i >= 0; i--) {
    const radius = rings[i]!;
    points.push(new THREE.Vector2(radius + groove * 1.4, height - ridge));
    points.push(new THREE.Vector2(radius + groove * 0.35, height - 0.002));
    points.push(new THREE.Vector2(radius - groove * 0.35, height - 0.002));
    points.push(new THREE.Vector2(radius - groove * 1.4, height - ridge));
  }

  points.push(new THREE.Vector2(0, height - ridge));
  return points;
}

const MAN_HEIGHT = 0.152;

function makePieceGeometry() {
  return new THREE.LatheGeometry(makeCheckerProfile(MAN_HEIGHT), 48);
}

const sharedPieceGeometry = makePieceGeometry();

function addFaceRings(
  group: THREE.Group,
  faceY: number,
  accent: THREE.Material,
) {
  for (const radius of checkerRingRadii(0.36)) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.006, 8, 48),
      accent,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = faceY - 0.001;
    ring.castShadow = true;
    group.add(ring);
  }
}

function makePiece(piece: Piece): THREE.Group {
  const group = new THREE.Group();
  const side = pieceSide(piece);
  const king = isKing(piece);
  const color = side > 0 ? WHITE_COLOR : BLACK_COLOR;
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: side > 0 ? 0.58 : 0.62,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: side > 0 ? 0x9a9a96 : 0x2a2a2a,
    roughness: 0.55,
    metalness: 0.02,
  });
  const bottom = new THREE.Mesh(sharedPieceGeometry, material);
  bottom.userData.sharedGeometry = true;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  group.add(bottom);
  addFaceRings(group, MAN_HEIGHT, accent);

  if (king) {
    // Crowning: a second man stacked on top of the first.
    const top = new THREE.Mesh(sharedPieceGeometry, material.clone());
    top.userData.sharedGeometry = true;
    top.position.y = MAN_HEIGHT * 0.92;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);
    addFaceRings(group, MAN_HEIGHT * 0.92 + MAN_HEIGHT, accent);
  }

  group.userData.piece = piece;
  group.userData.king = king;
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.sharedGeometry) child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    each(materials, (material) => material.dispose());
  });
}

type PieceAnimation = {
  object: THREE.Object3D;
  waypoints: THREE.Vector3[];
  startedAt: number;
  segmentDuration: number;
  captures: THREE.Object3D[];
  removedCaptures: Set<THREE.Object3D>;
  speedLines: THREE.Group;
};

function makeSpeedLines(pieceColor: number) {
  const group = new THREE.Group();
  const streak = new THREE.Color(pieceColor).lerp(
    new THREE.Color(0xffffff),
    0.45,
  );
  const material = new THREE.MeshBasicMaterial({
    color: streak,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (const lateral of [-0.09, 0.09]) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.01, 0.58),
      material.clone(),
    );
    line.position.set(lateral, 0.08, 0);
    line.renderOrder = 12;
    group.add(line);
  }
  group.visible = false;
  return group;
}

function updateSpeedLines(
  lines: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  piecePosition: THREE.Vector3,
  localProgress: number,
) {
  const direction = new THREE.Vector3().subVectors(to, from);
  direction.y = 0;
  const distance = direction.length();
  if (distance < 0.001) {
    lines.visible = false;
    return;
  }
  direction.normalize();
  const speed = Math.sin(Math.PI * localProgress);
  if (speed < 0.08) {
    lines.visible = false;
    return;
  }
  lines.visible = true;
  lines.position.set(
    piecePosition.x - direction.x * (0.32 + speed * 0.14),
    piecePosition.y + 0.02,
    piecePosition.z - direction.z * (0.32 + speed * 0.14),
  );
  lines.rotation.y = Math.atan2(direction.x, direction.z);
  lines.scale.set(1, 1, 0.55 + speed * 0.85);
  each(lines.children, (child, index) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshBasicMaterial;
    material.opacity = 0.25 + speed * 0.5;
    child.position.x = index === 0 ? -0.09 : 0.09;
    child.position.z = index === 0 ? 0.05 : -0.03;
  });
}

export function createScene(onAssetLoad: () => void = () => {}): CheckersScene {
  RectAreaLightUniformsLib.init();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0b0c0e");
  scene.fog = new THREE.Fog("#0b0c0e", 18, 38);
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  scene.environmentIntensity = 0.42;
  environmentGenerator.dispose();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x111618, roughness: 0.98 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.2;
  floor.receiveShadow = true;
  scene.add(floor, makeBoardShadow(), makeBoard());
  onAssetLoad();

  const cursor = makeMarker(0x3b9eff, true);
  const selected = makeMarker(0x3b9eff, true);
  const lastMark = makeMarker(0xf6d28f, true);
  cursor.visible = false;
  selected.visible = false;
  lastMark.visible = false;
  const targets = new THREE.Group();
  const targetMarkers: THREE.Object3D[] = [];
  scene.add(cursor, selected, targets, lastMark);

  const pieces = new Map<number, THREE.Object3D>();
  let currentBoard = new Int8Array(BOARD_SIZE * BOARD_SIZE);
  const pieceAnimations: PieceAnimation[] = [];
  const pieceMotion = new Emitter();

  const notifyPieceMotionComplete = () => {
    pieceMotion.emit("complete");
  };

  const finishPieceAnimations = () => {
    if (pieceAnimations.length === 0) return;
    each(pieceAnimations, (animation) => {
      const end = last(animation.waypoints);
      animation.object.position.copy(end);
      animation.object.userData.animatingMove = false;
      scene.remove(animation.speedLines);
      disposeObject(animation.speedLines);
      each(animation.captures, (captured) => {
        if (!animation.removedCaptures.has(captured)) {
          scene.remove(captured);
          disposeObject(captured);
        }
      });
    });
    pieceAnimations.length = 0;
    notifyPieceMotionComplete();
  };

  const syncBoard = (board: Int8Array, move: Move | null = null) => {
    if (isEqual(currentBoard, board)) return;

    const fromCell = move ? darkPosToCell(move.origin) : -1;
    const toCell = move ? darkPosToCell(move.destination) : -1;
    const canAnimate =
      move &&
      currentBoard[fromCell] !== 0 &&
      board[fromCell] === 0 &&
      board[toCell] !== 0;

    if (pieceAnimations.length > 0) finishPieceAnimations();
    currentBoard = new Int8Array(board);

    const animatedObjects = new Set<THREE.Object3D>();
    if (canAnimate && move) {
      const object = pieces.get(fromCell);
      if (object) {
        const captureObjects: THREE.Object3D[] = [];
        each(move.captures, (capturePos) => {
          const captureCell = darkPosToCell(capturePos);
          const captured = pieces.get(captureCell);
          if (captured) {
            pieces.delete(captureCell);
            captureObjects.push(captured);
          }
        });
        pieces.delete(fromCell);
        object.userData.piece = board[toCell];
        object.userData.animatingMove = true;
        pieces.set(toCell, object);

        const path = movePath(move);
        const waypoints = map(path, (pos) => {
          const cell = darkPosToCell(pos);
          const point = cellToWorld(rowOf(cell), columnOf(cell));
          return new THREE.Vector3(point.x, PIECE_BASE_Y, point.z);
        });
        const hops = max(1, waypoints.length - 1);
        const pieceTone = board[toCell] > 0 ? WHITE_COLOR : BLACK_COLOR;
        const speedLines = makeSpeedLines(pieceTone);
        scene.add(speedLines);
        pieceAnimations.push({
          object,
          waypoints,
          startedAt: perfNow(),
          segmentDuration: PIECE_MOVE_BASE_DURATION + 90 * hops,
          captures: captureObjects,
          removedCaptures: new Set(),
          speedLines,
        });
        animatedObjects.add(object);
      }
    }

    for (const [cell, object] of pieces) {
      if (animatedObjects.has(object)) continue;
      const needsReplace =
        !board[cell] ||
        object.userData.piece !== board[cell] ||
        Boolean(object.userData.king) !== isKing(board[cell]);
      if (needsReplace) {
        scene.remove(object);
        disposeObject(object);
        pieces.delete(cell);
      }
    }

    for (let cell = 0; cell < board.length; cell++) {
      if (!board[cell] || pieces.has(cell)) continue;
      const object = makePiece(board[cell]);
      const point = cellToWorld(rowOf(cell), columnOf(cell));
      object.position.set(point.x, PIECE_BASE_Y, point.z);
      scene.add(object);
      pieces.set(cell, object);
    }
  };

  const updatePieceMotion = (frameNow: number) => {
    if (pieceAnimations.length === 0) return false;
    const completed: PieceAnimation[] = [];
    each(pieceAnimations, (animation) => {
      const hops = max(1, animation.waypoints.length - 1);
      const totalDuration = animation.segmentDuration * hops;
      const progress = clamp(
        (frameNow - animation.startedAt) / totalDuration,
        0,
        1,
      );
      const scaled = progress * hops;
      const segment = min(Math.floor(scaled), hops - 1);
      const local = scaled - segment;
      const eased = local * local * (3 - 2 * local);
      const start = animation.waypoints[segment];
      const end = animation.waypoints[segment + 1];
      animation.object.position.lerpVectors(start, end, eased);
      animation.object.position.y =
        PIECE_BASE_Y + Math.sin(Math.PI * eased) * PIECE_MOVE_LIFT;
      updateSpeedLines(
        animation.speedLines,
        start,
        end,
        animation.object.position,
        eased,
      );

      const captureIndex = min(
        animation.captures.length - 1,
        Math.floor(progress * animation.captures.length + 0.01),
      );
      if (
        animation.captures.length > 0 &&
        progress >= CAPTURE_DISAPPEAR_PROGRESS / hops + segment / hops
      ) {
        for (let i = 0; i <= captureIndex; i++) {
          const captured = animation.captures[i];
          if (captured && !animation.removedCaptures.has(captured)) {
            scene.remove(captured);
            disposeObject(captured);
            animation.removedCaptures.add(captured);
          }
        }
      }

      if (progress === 1) {
        animation.object.position.copy(last(animation.waypoints));
        animation.object.userData.animatingMove = false;
        scene.remove(animation.speedLines);
        disposeObject(animation.speedLines);
        each(animation.captures, (captured) => {
          if (!animation.removedCaptures.has(captured)) {
            scene.remove(captured);
            disposeObject(captured);
            animation.removedCaptures.add(captured);
          }
        });
        completed.push(animation);
      }
    });
    each(completed, (animation) => {
      pieceAnimations.splice(pieceAnimations.indexOf(animation), 1);
    });
    if (completed.length > 0) {
      each(completed, (animation) => {
        const entry = find(
          [...pieces.entries()],
          ([, object]) => object === animation.object,
        );
        const cell = entry?.[0];
        if (cell === undefined) return;
        const piece = currentBoard[cell];
        if (
          !piece ||
          Boolean(animation.object.userData.king) === isKing(piece)
        ) {
          return;
        }
        scene.remove(animation.object);
        disposeObject(animation.object);
        const replacement = makePiece(piece);
        const point = cellToWorld(rowOf(cell), columnOf(cell));
        replacement.position.set(point.x, PIECE_BASE_Y, point.z);
        scene.add(replacement);
        pieces.set(cell, replacement);
      });
      if (pieceAnimations.length === 0) notifyPieceMotionComplete();
    }
    return pieceAnimations.length > 0;
  };

  const moveMarker = (marker: THREE.Object3D, cell: number | null) => {
    if (cell === null) {
      marker.visible = false;
      return;
    }
    const point = cellToWorld(rowOf(cell), columnOf(cell));
    marker.position.x = point.x;
    marker.position.z = point.z;
    marker.visible = true;
  };

  const updateSelection = (
    selectedCell: number | null,
    legalTargets: number[],
  ) => {
    moveMarker(selected, selectedCell);
    each(legalTargets, (cell, markerIndex) => {
      const marker =
        targetMarkers[markerIndex] ??
        (() => {
          const created = makeMarker(0xffffff, false);
          targetMarkers.push(created);
          targets.add(created);
          return created;
        })();
      moveMarker(marker, cell);
    });
    each(targetMarkers.slice(legalTargets.length), (marker) => {
      marker.visible = false;
    });
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FACE_TOP);
  let orbitYaw = 0;
  let orbitPitch = 0.72;
  let orbitDistance = 14;
  let topDownLocked = false;
  const orbitTarget = new THREE.Vector3(0, -0.2, 0);
  const applyCameraOrbit = () => {
    if (orbitPitch <= 0.001) topDownLocked = true;
    else if (orbitPitch > 0.1) topDownLocked = false;
    const topDown = topDownLocked;
    const pitch = topDown ? 0 : orbitPitch;
    const horizontal = Math.sin(pitch) * orbitDistance;
    camera.up.set(0, topDown ? 0 : 1, topDown ? -1 : 0);
    camera.position.set(
      orbitTarget.x + Math.sin(orbitYaw) * horizontal,
      orbitTarget.y +
        (topDown ? orbitDistance : Math.cos(pitch) * orbitDistance),
      orbitTarget.z + Math.cos(orbitYaw) * horizontal,
    );
    camera.lookAt(orbitTarget);
  };
  const orbit = (deltaX: number, deltaY: number) => {
    orbitYaw -= deltaX * 0.008;
    orbitPitch = clamp(orbitPitch - deltaY * 0.006, 0, 1.22);
    applyCameraOrbit();
  };
  const settleView = () => {
    if (orbitPitch < 0.12) {
      orbitPitch = 0;
      topDownLocked = true;
      applyCameraOrbit();
    }
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
    orbitTarget.addScaledVector(right, -deltaX * orbitDistance * 0.001);
    orbitTarget.addScaledVector(forward, deltaY * orbitDistance * 0.001);
    applyCameraOrbit();
  };
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const fit = 5.2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    orbitDistance = fit * max(1, 1 / (width / height)) * 1.08;
    applyCameraOrbit();
    camera.updateProjectionMatrix();
  };
  const pickCell = (clientX: number, clientY: number) => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
    const column = Math.round(hit.x + 3.5);
    const displayRow = Math.round(hit.z + 3.5);
    const row = ROWS - 1 - displayRow;
    return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS
      ? { row, column }
      : null;
  };

  const keyLight = new THREE.DirectionalLight(0xffe1b7, 4.2);
  keyLight.position.set(-4, 15, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -7;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.bias = -0.00035;
  keyLight.shadow.normalBias = 0.014;
  keyLight.shadow.radius = 1.1;
  keyLight.shadow.intensity = 1.35;
  keyLight.shadow.camera.updateProjectionMatrix();
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0x9ebdca, 0x17252c, 0.45));
  const rim = new THREE.PointLight(0x4d9ba5, 10, 26, 2);
  rim.position.set(7, 7, -7);
  scene.add(rim);
  const boardSoftbox = new THREE.RectAreaLight(0xffead0, 5.5, 5, 2.5);
  boardSoftbox.position.set(-4, 5.5, 9);
  boardSoftbox.lookAt(0, FACE_TOP, 0);
  scene.add(boardSoftbox);
  resize();

  return {
    renderer,
    scene,
    camera,
    cursor,
    selected,
    targets,
    lastMark,
    syncBoard,
    updatePieceMotion,
    isPieceMoving: () => pieceAnimations.length > 0,
    onPieceMotionComplete: (callback) => {
      pieceMotion.on("complete", callback);
      return () => {
        pieceMotion.off("complete", callback);
      };
    },
    updateSelection,
    updateLastMove: (cell) => moveMarker(lastMark, cell),
    pickCell,
    orbit,
    pan,
    settleView,
    resize,
  };
}

export function updateSceneMotion(checkersScene: CheckersScene, now: number) {
  let hasMotion = false;
  if (checkersScene.cursor.visible) {
    checkersScene.cursor.scale.setScalar(1 + Math.sin(now * 0.005) * 0.06);
    hasMotion = true;
  }
  if (checkersScene.selected.visible) {
    checkersScene.selected.scale.setScalar(1 + Math.sin(now * 0.006) * 0.08);
    hasMotion = true;
  }
  return hasMotion;
}
