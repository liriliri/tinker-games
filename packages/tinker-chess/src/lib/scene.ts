import * as THREE from "three";
import clamp from "licia/clamp";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import {
  BISHOP,
  COLUMNS,
  columnOf,
  KING,
  KNIGHT,
  PAWN,
  pieceSide,
  pieceType,
  QUEEN,
  ROOK,
  rowOf,
  ROWS,
  type Move,
  type Piece,
} from "../game/rules";

const BOARD_Y = 0.62;
const BOARD_SIZE = 8;
const CHESS_FACE_TOP = BOARD_Y - 0.05;
const PIECE_BASE_Y = CHESS_FACE_TOP + 0.02;
const PIECE_MOVE_BASE_DURATION = 260;
const PIECE_MOVE_LIFT = 0.24;
const CAPTURE_DISAPPEAR_PROGRESS = 0.78;
const WHITE_PIECE_COLOR = 0xe7d5b4;
const BLACK_PIECE_COLOR = 0x56372a;

export type Cell = { row: number; column: number };

export type ChessScene = {
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
  return {
    x: column - (COLUMNS - 1) / 2,
    z: row - (ROWS - 1) / 2,
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
      [0.36, 0.41],
      [0.48, 0.53],
    ]) {
      const circle = new THREE.Mesh(
        new THREE.RingGeometry(innerRadius, outerRadius, 48),
        material,
      );
      circle.rotation.x = -Math.PI / 2;
      circle.renderOrder = 10;
      marker.add(circle);
    }
    marker.position.y = CHESS_FACE_TOP + 0.02;
    return marker;
  }
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = CHESS_FACE_TOP + 0.02;
  mesh.renderOrder = 9;
  return mesh;
}

function normalizePieceModel(model: THREE.Group, targetHeight: number) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const baseBounds = new THREE.Box3();
  const baseLimit = bounds.min.y + size.y * 0.025;
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const childBounds = new THREE.Box3().setFromObject(child);
    if (childBounds.min.y <= baseLimit) {
      baseBounds.union(childBounds);
    }
  });
  const baseCenter = baseBounds.isEmpty()
    ? center
    : baseBounds.getCenter(new THREE.Vector3());
  const scale = targetHeight / Math.max(size.y, 0.001);
  model.scale.setScalar(scale);
  model.position.set(
    -baseCenter.x * scale,
    -bounds.min.y * scale,
    -baseCenter.z * scale,
  );
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return model;
}

function tintPieceModel(
  model: THREE.Group,
  side: number,
  texture: THREE.Texture,
) {
  const color = new THREE.Color(
    side > 0 ? WHITE_PIECE_COLOR : BLACK_PIECE_COLOR,
  );
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    child.material = materials.map((material) => {
      const tinted = material.clone() as THREE.Material & {
        color?: THREE.Color;
        map?: THREE.Texture;
      };
      tinted.color?.copy(color);
      tinted.map = texture;
      tinted.needsUpdate = true;
      return tinted;
    });
    if (child.material.length === 1) {
      child.material = child.material[0];
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

const REFLECTION_SHADER = {
  uniforms: {
    color: { value: new THREE.Color(0x76533d) },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    opacity: { value: 0.42 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;

    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float opacity;
    varying vec4 vUv;

    void main() {
      vec4 reflection = texture2DProj(tDiffuse, vUv);
      gl_FragColor = vec4(reflection.rgb, opacity);
    }
  `,
};

function makePiece(
  piece: Piece,
  templates: Record<number, THREE.Group | null>,
  texture: THREE.Texture,
): THREE.Group | null {
  const type = pieceType(piece);
  const template = templates[type];
  if (!template) return null;

  const pieceObject = new THREE.Group();
  const model = template.clone(true);
  const orientation = new THREE.Group();
  orientation.rotation.y =
    (pieceSide(piece) > 0 ? 0 : Math.PI) + (type === KNIGHT ? Math.PI / 2 : 0);
  tintPieceModel(model, pieceSide(piece), texture);
  pieceObject.userData.piece = piece;
  pieceObject.userData.modelType = type;
  orientation.add(model);
  pieceObject.add(orientation);
  return pieceObject;
}

function disposePieceObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function loadWoodTextures(onLoad: () => void) {
  const loader = new THREE.TextureLoader();
  const color = loader.load("images/wood.jpg", onLoad);
  const normal = loader.load("images/wood_normal.jpg", onLoad);
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  color.repeat.set(1.7, 1.7);
  normal.repeat.set(1.7, 1.7);
  color.center.set(0.5, 0.5);
  normal.center.set(0.5, 0.5);
  color.rotation = Math.PI / 2;
  normal.rotation = Math.PI / 2;
  color.anisotropy = 4;
  normal.anisotropy = 4;
  return { color, normal };
}

function loadOnyxTexture(onLoad: () => void) {
  const texture = new THREE.TextureLoader().load("images/onyx.jpg", onLoad);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.35, 1.35);
  texture.anisotropy = 4;
  return texture;
}

function makeBoardShadow() {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        shadowColor: { value: new THREE.Color(0x050806) },
        opacity: { value: 0.48 },
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
  const positions = points.flatMap(([x, z]) => [x, CHESS_FACE_TOP - 0.018, z]);
  const uvs = points.flatMap(([x, z]) =>
    (() => {
      const u = rotateTexture ? (z + 4.6) / 9.2 : (x + 4.6) / 9.2;
      const v = rotateTexture ? (x + 4.6) / 9.2 : (z + 4.6) / 9.2;
      return [flipU ? 1 - u : u, v];
    })(),
  );
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function makeBoard(woodTextures: {
  color: THREE.Texture;
  normal: THREE.Texture;
}) {
  const group = new THREE.Group();
  const woodMaterial = new THREE.MeshPhysicalMaterial({
    map: woodTextures.color,
    normalMap: woodTextures.normal,
    normalScale: new THREE.Vector2(0.62, 0.62),
    color: 0xb08368,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.58,
    clearcoatRoughness: 0.14,
    reflectivity: 0.58,
    specularIntensity: 0.68,
  });
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(9.2, 0.34, 9.2),
    woodMaterial,
  );
  base.position.y = BOARD_Y - 0.24;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const frameMaterial = woodMaterial.clone();
  frameMaterial.color.multiplyScalar(0.64);
  frameMaterial.roughness = 0.42;
  frameMaterial.clearcoat = 0.36;
  frameMaterial.clearcoatRoughness = 0.2;
  frameMaterial.reflectivity = 0.4;
  frameMaterial.specularIntensity = 0.5;
  group.add(
    makeFrameSurface(
      [
        [-4, -4],
        [4, -4],
        [4.6, -4.6],
        [-4.6, -4.6],
      ],
      frameMaterial,
      true,
    ),
    makeFrameSurface(
      [
        [-4, 4],
        [-4.6, 4.6],
        [4.6, 4.6],
        [4, 4],
      ],
      frameMaterial.clone(),
      true,
      true,
    ),
    makeFrameSurface(
      [
        [-4, -4],
        [-4, 4],
        [-4.6, 4.6],
        [-4.6, -4.6],
      ],
      frameMaterial.clone(),
      true,
    ),
    makeFrameSurface(
      [
        [4, -4],
        [4.6, -4.6],
        [4.6, 4.6],
        [4, 4],
      ],
      frameMaterial.clone(),
      true,
    ),
  );
  const miterMaterial = new THREE.MeshBasicMaterial({ color: 0x101418 });
  const miterGeometry = new THREE.BoxGeometry(Math.SQRT2 * 0.6, 0.006, 0.012);
  for (const [x, z, angle] of [
    [-4.3, -4.3, -Math.PI / 4],
    [4.3, -4.3, Math.PI / 4],
    [-4.3, 4.3, Math.PI / 4],
    [4.3, 4.3, -Math.PI / 4],
  ] as const) {
    const seam = new THREE.Mesh(miterGeometry, miterMaterial);
    seam.position.set(x, CHESS_FACE_TOP - 0.015, z);
    seam.rotation.y = angle;
    group.add(seam);
  }

  const squareGeometry = new THREE.BoxGeometry(0.98, 0.08, 0.98);
  const squareMaterials = [
    new THREE.MeshStandardMaterial({
      color: 0xb6a078,
      roughness: 0.76,
    }),
    new THREE.MeshStandardMaterial({
      color: 0x755038,
      roughness: 0.76,
    }),
  ];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let column = 0; column < BOARD_SIZE; column++) {
      const { x, z } = cellToWorld(row, column);
      const square = new THREE.Mesh(
        squareGeometry,
        squareMaterials[(row + column) % 2],
      );
      square.position.set(x, CHESS_FACE_TOP - 0.04, z);
      square.receiveShadow = true;
      group.add(square);
    }
  }

  const reflector = new Reflector(new THREE.PlaneGeometry(8, 8), {
    shader: REFLECTION_SHADER,
    clipBias: 0.003,
    textureWidth: 1024,
    textureHeight: 1024,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = CHESS_FACE_TOP + 0.008;
  reflector.renderOrder = 1;
  const reflectorMaterial = Array.isArray(reflector.material)
    ? reflector.material[0]
    : reflector.material;
  reflectorMaterial.transparent = true;
  reflectorMaterial.opacity = 0.42;
  reflectorMaterial.depthWrite = false;
  group.add(reflector);

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
    border.position.set(x, CHESS_FACE_TOP - 0.02, z);
    group.add(border);
  }
  return group;
}

export function createScene(onAssetLoad: () => void = () => {}): ChessScene {
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
  scene.background = new THREE.Color("#0f1315");
  scene.fog = new THREE.Fog("#0f1315", 18, 38);
  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;
  scene.environmentIntensity = 0.72;
  scene.environmentRotation.set(
    THREE.MathUtils.degToRad(25),
    THREE.MathUtils.degToRad(35),
    0,
  );
  environmentGenerator.dispose();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x111618, roughness: 0.98 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.2;
  floor.receiveShadow = true;
  scene.add(floor, makeBoardShadow(), makeBoard(loadWoodTextures(onAssetLoad)));
  const onyxTexture = loadOnyxTexture(onAssetLoad);

  const cursor = makeMarker(0xf1dfb8, true);
  const selected = makeMarker(0xffffff, true);
  const lastMark = makeMarker(0xf6d28f, true);
  cursor.visible = false;
  selected.visible = false;
  lastMark.visible = false;
  const targets = new THREE.Group();
  const targetMarkers: THREE.Object3D[] = [];
  scene.add(cursor, selected, targets, lastMark);

  const pieces = new Map<number, THREE.Object3D>();
  let currentBoard = new Int8Array(BOARD_SIZE * BOARD_SIZE);
  const pieceTemplates: Record<number, THREE.Group | null> = {
    [PAWN]: null,
    [KNIGHT]: null,
    [BISHOP]: null,
    [ROOK]: null,
    [QUEEN]: null,
    [KING]: null,
  };
  const failedModelTypes = new Set<number>();
  const modelTypes = [PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING];
  const pieceAnimations: {
    object: THREE.Object3D;
    start: THREE.Vector3;
    end: THREE.Vector3;
    startedAt: number;
    duration: number;
    captured?: THREE.Object3D;
    capturedRemoved: boolean;
  }[] = [];
  let pieceMotionComplete: (() => void) | null = null;
  const finishPieceAnimations = () => {
    pieceAnimations.forEach(({ object, end, captured, capturedRemoved }) => {
      object.position.copy(end);
      object.userData.animatingMove = false;
      if (captured && !capturedRemoved) {
        scene.remove(captured);
        disposePieceObject(captured);
      }
    });
    pieceAnimations.length = 0;
  };
  const syncBoard = (board: Int8Array, move: Move | null = null) => {
    const boardChanged =
      currentBoard.length !== board.length ||
      currentBoard.some((piece, cell) => piece !== board[cell]);
    const canAnimateMove =
      boardChanged &&
      move &&
      currentBoard[move.from] === move.piece &&
      board[move.from] === 0 &&
      board[move.to] !== 0;
    if (boardChanged && pieceAnimations.length > 0) {
      finishPieceAnimations();
    }
    currentBoard = new Int8Array(board);
    const modelsReady = modelTypes.every(
      (type) => pieceTemplates[type] || failedModelTypes.has(type),
    );
    if (!modelsReady) {
      for (const object of pieces.values()) {
        scene.remove(object);
        disposePieceObject(object);
      }
      pieces.clear();
      return;
    }
    const animatedObjects = new Set<THREE.Object3D>();
    if (canAnimateMove) {
      const moves = [{ from: move.from, to: move.to }];
      if (move.castle) {
        const row = rowOf(move.from);
        moves.push(
          move.castle === "kingside"
            ? { from: row * COLUMNS + 7, to: row * COLUMNS + 5 }
            : { from: row * COLUMNS, to: row * COLUMNS + 3 },
        );
      }
      for (const { from, to } of moves) {
        const object = pieces.get(from);
        if (!object) continue;
        const capturedObject = pieces.get(to);
        if (capturedObject && capturedObject !== object) {
          pieces.delete(to);
        }
        pieces.delete(from);
        object.userData.piece = board[to];
        object.userData.animatingMove = true;
        pieces.set(to, object);
        const destination = cellToWorld(rowOf(to), columnOf(to));
        const distance = Math.hypot(
          destination.x - object.position.x,
          destination.z - object.position.z,
        );
        pieceAnimations.push({
          object,
          start: object.position.clone(),
          end: new THREE.Vector3(destination.x, PIECE_BASE_Y, destination.z),
          startedAt: performance.now(),
          duration: PIECE_MOVE_BASE_DURATION + distance * 180,
          captured: capturedObject,
          capturedRemoved: false,
        });
        animatedObjects.add(object);
      }
    }
    for (const [cell, object] of pieces) {
      if (animatedObjects.has(object)) continue;
      const type = board[cell] ? pieceType(board[cell]) : 0;
      const expectedModelType = pieceTemplates[type] ? type : 0;
      const modelNeedsReplacement =
        expectedModelType !== (object.userData.modelType ?? 0);
      if (
        !board[cell] ||
        object.userData.piece !== board[cell] ||
        modelNeedsReplacement
      ) {
        scene.remove(object);
        disposePieceObject(object);
        pieces.delete(cell);
      }
    }
    for (let cell = 0; cell < board.length; cell++) {
      if (!board[cell] || pieces.has(cell)) continue;
      const object = makePiece(board[cell], pieceTemplates, onyxTexture);
      if (!object) continue;
      const point = cellToWorld(rowOf(cell), columnOf(cell));
      object.position.set(point.x, PIECE_BASE_Y, point.z);
      scene.add(object);
      pieces.set(cell, object);
    }
  };

  const modelLoader = new GLTFLoader();
  const modelPaths: Record<number, string> = {
    [PAWN]: "models/pawn.glb",
    [KNIGHT]: "models/knight.glb",
    [BISHOP]: "models/bishop.glb",
    [ROOK]: "models/rook.glb",
    [QUEEN]: "models/queen.glb",
    [KING]: "models/king.glb",
  };
  const modelHeights: Record<number, number> = {
    [PAWN]: 1.08,
    [KNIGHT]: 1.32,
    [BISHOP]: 1.4,
    [ROOK]: 1.24,
    [QUEEN]: 1.48,
    [KING]: 1.58,
  };
  for (const type of modelTypes) {
    modelLoader.load(
      modelPaths[type],
      (gltf) => {
        pieceTemplates[type] = normalizePieceModel(
          gltf.scene,
          modelHeights[type],
        );
        syncBoard(currentBoard);
        onAssetLoad();
      },
      undefined,
      (error) => {
        failedModelTypes.add(type);
        console.warn(`Unable to load ${modelPaths[type]}`, error);
        syncBoard(currentBoard);
        onAssetLoad();
      },
    );
  }

  const updatePieceMotion = (now: number) => {
    if (pieceAnimations.length === 0) return false;
    const completed: typeof pieceAnimations = [];
    for (const animation of pieceAnimations) {
      const progress = clamp(
        (now - animation.startedAt) / animation.duration,
        0,
        1,
      );
      const eased = progress * progress * (3 - 2 * progress);
      animation.object.position.lerpVectors(
        animation.start,
        animation.end,
        eased,
      );
      animation.object.position.y =
        PIECE_BASE_Y + Math.sin(Math.PI * eased) * PIECE_MOVE_LIFT;
      if (
        animation.captured &&
        !animation.capturedRemoved &&
        progress >= CAPTURE_DISAPPEAR_PROGRESS
      ) {
        scene.remove(animation.captured);
        disposePieceObject(animation.captured);
        animation.capturedRemoved = true;
      }
      if (progress === 1) {
        animation.object.position.copy(animation.end);
        animation.object.userData.animatingMove = false;
        if (animation.captured && !animation.capturedRemoved) {
          scene.remove(animation.captured);
          disposePieceObject(animation.captured);
          animation.capturedRemoved = true;
        }
        completed.push(animation);
      }
    }
    completed.forEach((animation) => {
      pieceAnimations.splice(pieceAnimations.indexOf(animation), 1);
    });
    if (completed.length > 0) {
      const needsModelSync = completed.some((animation) => {
        const cell = [...pieces.entries()].find(
          ([, object]) => object === animation.object,
        )?.[0];
        if (cell === undefined) return false;
        const type = pieceType(currentBoard[cell]);
        const expectedModelType = pieceTemplates[type] ? type : 0;
        return animation.object.userData.modelType !== expectedModelType;
      });
      if (needsModelSync) syncBoard(currentBoard);
      if (pieceAnimations.length === 0) pieceMotionComplete?.();
    }
    return pieceAnimations.length > 0;
  };

  const onPieceMotionComplete = (callback: () => void) => {
    pieceMotionComplete = callback;
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
  const boardPlane = new THREE.Plane(
    new THREE.Vector3(0, 1, 0),
    -CHESS_FACE_TOP,
  );
  let orbitYaw = 0;
  let orbitPitch = 0.72;
  let orbitDistance = 14;
  const orbitTarget = new THREE.Vector3(0, -0.2, 0);
  const applyCameraOrbit = () => {
    const horizontal = Math.sin(orbitPitch) * orbitDistance;
    camera.position.set(
      orbitTarget.x + Math.sin(orbitYaw) * horizontal,
      orbitTarget.y + Math.cos(orbitPitch) * orbitDistance,
      orbitTarget.z + Math.cos(orbitYaw) * horizontal,
    );
    camera.lookAt(orbitTarget);
  };
  const orbit = (deltaX: number, deltaY: number) => {
    orbitYaw -= deltaX * 0.008;
    orbitPitch = clamp(orbitPitch - deltaY * 0.006, 0.22, 1.22);
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
    forward.normalize();
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
    orbitDistance = fit * Math.max(1, 1 / (width / height)) * 0.92;
    applyCameraOrbit();
    camera.updateProjectionMatrix();
  };
  const pickCell = (clientX: number, clientY: number) => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
    const column = Math.round(hit.x + 3.5);
    const row = Math.round(hit.z + 3.5);
    return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS
      ? { row, column }
      : null;
  };

  const keyLight = new THREE.DirectionalLight(0xffe1b7, 3.8);
  keyLight.position.set(-4, 15, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -7;
  keyLight.shadow.camera.right = 7;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -7;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 32;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.018;
  keyLight.shadow.radius = 1.5;
  keyLight.shadow.camera.updateProjectionMatrix();
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0x9ebdca, 0x17252c, 0.9));
  const rim = new THREE.PointLight(0x4d9ba5, 18, 26, 2);
  rim.position.set(7, 7, -7);
  scene.add(rim);
  const sideFill = new THREE.PointLight(0x9bcac2, 2.2, 25, 2);
  sideFill.position.set(10, 4.5, 4);
  scene.add(sideFill);
  const backFill = new THREE.PointLight(0xc88e65, 1.5, 25, 2);
  backFill.position.set(-9, 3.5, -7);
  scene.add(backFill);
  const boardSoftbox = new THREE.RectAreaLight(0xffead0, 9, 5, 2.5);
  boardSoftbox.position.set(-4, 5.5, 9);
  boardSoftbox.lookAt(0, CHESS_FACE_TOP, 0);
  scene.add(boardSoftbox);
  const boardFillbox = new THREE.RectAreaLight(0x9ed9d2, 5, 4, 2);
  boardFillbox.position.set(7, 4.5, -5);
  boardFillbox.lookAt(0, CHESS_FACE_TOP, 0);
  scene.add(boardFillbox);
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
    onPieceMotionComplete,
    updateSelection,
    updateLastMove: (cell) => moveMarker(lastMark, cell),
    pickCell,
    orbit,
    pan,
    resize,
  };
}

export function updateSceneMotion(chessScene: ChessScene, now: number) {
  let hasMotion = false;
  if (chessScene.cursor.visible) {
    const pulse = 1 + Math.sin(now * 0.005) * 0.06;
    chessScene.cursor.scale.setScalar(pulse);
    hasMotion = true;
  }
  if (chessScene.selected.visible) {
    const pulse = 1 + Math.sin(now * 0.006) * 0.08;
    chessScene.selected.scale.setScalar(pulse);
    hasMotion = true;
  }
  return hasMotion;
}
