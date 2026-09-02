import * as THREE from "three";
import clamp from "licia/clamp";
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
const PIECE_BASE_Y = FACE_TOP + 0.08;
const PIECE_MOVE_BASE_DURATION = 220;
const PIECE_MOVE_LIFT = 0.28;
const CAPTURE_DISAPPEAR_PROGRESS = 0.55;
const WHITE_COLOR = 0xbdbdb8;
const BLACK_COLOR = 0x161616;
const KING_ACCENT = 0xd4af50;

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
  onPieceMotionComplete: (callback: () => void) => void;
  updateSelection: (selected: number | null, legalTargets: number[]) => void;
  updateLastMove: (cell: number | null) => void;
  pickCell: (clientX: number, clientY: number) => Cell | null;
  orbit: (deltaX: number, deltaY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
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

  const image = context.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18 * intensity;
    data[i] = Math.max(0, Math.min(255, data[i]! + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + n));
  }
  context.putImageData(image, 0, 0);

  const [sr, sg, sb] = scratch;
  const scratchCount = Math.round(42 * intensity);
  for (let i = 0; i < scratchCount; i++) {
    const alpha = (0.04 + Math.random() * 0.1) * intensity;
    context.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
    context.lineWidth = 0.6 + Math.random() * 1.4;
    context.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 18 + Math.random() * 70;
    const angle = Math.random() * Math.PI;
    context.moveTo(x, y);
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    context.stroke();
  }
  const fineCount = Math.round(18 * intensity);
  for (let i = 0; i < fineCount; i++) {
    const alpha = (0.03 + Math.random() * 0.07) * intensity;
    context.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, ${alpha})`;
    context.lineWidth = 0.4 + Math.random();
    context.beginPath();
    const x = Math.random() * size;
    const y = Math.random() * size;
    const length = 8 + Math.random() * 28;
    const angle = (Math.random() - 0.5) * 0.5 + (i % 2 === 0 ? 0.2 : 1.4);
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

  const squareGeometry = new THREE.BoxGeometry(1.01, 0.08, 1.01);
  const lightSquareMap = makeScratchTexture([212, 212, 208], [70, 70, 66]);
  const darkSquareMap = makeScratchTexture([26, 26, 26], [210, 210, 205]);
  const squareMaterials = [
    new THREE.MeshStandardMaterial({
      map: lightSquareMap,
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.02,
    }),
    new THREE.MeshStandardMaterial({
      map: darkSquareMap,
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.02,
    }),
  ];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      const { x, z } = cellToWorld(row, column);
      const square = new THREE.Mesh(
        squareGeometry,
        squareMaterials[(row + column) % 2],
      );
      square.position.set(x, FACE_TOP - 0.04, z);
      square.receiveShadow = true;
      group.add(square);
    }
  }

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
  return [0.22, 0.4, 0.58, 0.76].map((t) => outerRadius * t);
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

function makePieceGeometry(king: boolean) {
  return new THREE.LatheGeometry(makeCheckerProfile(king ? 0.3 : 0.152), 48);
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
  const body = new THREE.Mesh(makePieceGeometry(king), material);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Subtle ring highlights so the face grooves read from above.
  const faceY = king ? 0.3 : 0.152;
  const accent = new THREE.MeshStandardMaterial({
    color: side > 0 ? 0x9a9a96 : 0x2a2a2a,
    roughness: 0.55,
    metalness: 0.02,
  });
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
  if (king) {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.37, 0.014, 10, 48),
      new THREE.MeshStandardMaterial({
        color: KING_ACCENT,
        roughness: 0.35,
        metalness: 0.55,
      }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.15;
    band.castShadow = true;
    group.add(band);
  }

  group.userData.piece = piece;
  group.userData.king = king;
  return group;
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material.dispose());
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

function disposeSpeedLines(group: THREE.Group) {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    (child.material as THREE.Material).dispose();
  });
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
  lines.children.forEach((child, index) => {
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  let pieceMotionComplete: (() => void) | null = null;

  const finishPieceAnimations = () => {
    for (const animation of pieceAnimations) {
      const end = animation.waypoints[animation.waypoints.length - 1];
      animation.object.position.copy(end);
      animation.object.userData.animatingMove = false;
      scene.remove(animation.speedLines);
      disposeSpeedLines(animation.speedLines);
      for (const captured of animation.captures) {
        if (!animation.removedCaptures.has(captured)) {
          scene.remove(captured);
          disposeObject(captured);
        }
      }
    }
    pieceAnimations.length = 0;
  };

  const syncBoard = (board: Int8Array, move: Move | null = null) => {
    const boardChanged =
      currentBoard.length !== board.length ||
      currentBoard.some((piece, cell) => piece !== board[cell]);
    const fromCell = move ? darkPosToCell(move.origin) : -1;
    const toCell = move ? darkPosToCell(move.destination) : -1;
    const canAnimate =
      boardChanged &&
      move &&
      currentBoard[fromCell] !== 0 &&
      board[fromCell] === 0 &&
      board[toCell] !== 0;

    if (boardChanged && pieceAnimations.length > 0) finishPieceAnimations();
    currentBoard = new Int8Array(board);

    const animatedObjects = new Set<THREE.Object3D>();
    if (canAnimate && move) {
      const object = pieces.get(fromCell);
      if (object) {
        const captureObjects: THREE.Object3D[] = [];
        for (const capturePos of move.captures) {
          const captureCell = darkPosToCell(capturePos);
          const captured = pieces.get(captureCell);
          if (captured) {
            pieces.delete(captureCell);
            captureObjects.push(captured);
          }
        }
        pieces.delete(fromCell);
        object.userData.piece = board[toCell];
        object.userData.animatingMove = true;
        pieces.set(toCell, object);

        const path = movePath(move);
        const waypoints = path.map((pos) => {
          const cell = darkPosToCell(pos);
          const point = cellToWorld(rowOf(cell), columnOf(cell));
          return new THREE.Vector3(point.x, PIECE_BASE_Y, point.z);
        });
        const hops = Math.max(1, waypoints.length - 1);
        const pieceTone = board[toCell] > 0 ? WHITE_COLOR : BLACK_COLOR;
        const speedLines = makeSpeedLines(pieceTone);
        scene.add(speedLines);
        pieceAnimations.push({
          object,
          waypoints,
          startedAt: performance.now(),
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

  const updatePieceMotion = (now: number) => {
    if (pieceAnimations.length === 0) return false;
    const completed: PieceAnimation[] = [];
    for (const animation of pieceAnimations) {
      const hops = Math.max(1, animation.waypoints.length - 1);
      const totalDuration = animation.segmentDuration * hops;
      const progress = clamp((now - animation.startedAt) / totalDuration, 0, 1);
      const scaled = progress * hops;
      const segment = Math.min(Math.floor(scaled), hops - 1);
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

      const captureIndex = Math.min(
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
        animation.object.position.copy(
          animation.waypoints[animation.waypoints.length - 1],
        );
        animation.object.userData.animatingMove = false;
        scene.remove(animation.speedLines);
        disposeSpeedLines(animation.speedLines);
        for (const captured of animation.captures) {
          if (!animation.removedCaptures.has(captured)) {
            scene.remove(captured);
            disposeObject(captured);
            animation.removedCaptures.add(captured);
          }
        }
        completed.push(animation);
      }
    }
    completed.forEach((animation) => {
      pieceAnimations.splice(pieceAnimations.indexOf(animation), 1);
    });
    if (completed.length > 0) {
      const needsKingSync = completed.some((animation) => {
        const cell = [...pieces.entries()].find(
          ([, object]) => object === animation.object,
        )?.[0];
        if (cell === undefined) return false;
        return (
          Boolean(animation.object.userData.king) !== isKing(currentBoard[cell])
        );
      });
      if (needsKingSync) syncBoard(currentBoard);
      if (pieceAnimations.length === 0) pieceMotionComplete?.();
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
    legalTargets.forEach((cell, markerIndex) => {
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
    targetMarkers
      .slice(legalTargets.length)
      .forEach((marker) => (marker.visible = false));
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -FACE_TOP);
  let orbitYaw = 0;
  let orbitPitch = 0.72;
  let orbitDistance = 14;
  const orbitTarget = new THREE.Vector3(0, -0.2, 0);
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
    orbitPitch = clamp(orbitPitch - deltaY * 0.006, 0, 1.22);
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
    orbitDistance = fit * Math.max(1, 1 / (width / height)) * 1.08;
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
      pieceMotionComplete = callback;
    },
    updateSelection,
    updateLastMove: (cell) => moveMarker(lastMark, cell),
    pickCell,
    orbit,
    pan,
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
