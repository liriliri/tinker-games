import * as THREE from "three";
import clamp from "licia/clamp";
import {
  COLUMNS,
  columnOf,
  pieceSide,
  pieceType,
  PIECE_LABELS,
  RED,
  ROWS,
  rowOf,
  type Piece,
} from "../game/rules";

const BOARD_Y = 0.72;
const GRID_X = COLUMNS - 1;
const GRID_Z = ROWS - 1;
const BOARD_WIDTH = 9.5;
const BOARD_DEPTH = 10.5;

function disposeObject(root: THREE.Object3D, disposeTextures = true) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    const meshMaterials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of meshMaterials) {
      materials.add(material);
      if (disposeTextures) {
        const materialWithMap = material as THREE.Material & {
          map?: THREE.Texture | null;
        };
        if (materialWithMap.map) textures.add(materialWithMap.map);
      }
    }
  });

  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

export type Cell = { row: number; column: number };

export type ChessScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cursor: THREE.Group;
  selected: THREE.Group;
  targets: THREE.Group;
  lastMark: THREE.Mesh;
  syncBoard: (
    board: Int8Array,
    selected: number | null,
    legalTargets: number[],
    animate: boolean,
  ) => void;
  updateSelection: (selected: number | null, legalTargets: number[]) => void;
  clear: () => void;
  pickCell: (clientX: number, clientY: number) => Cell | null;
  orbit: (deltaX: number, deltaY: number) => void;
  pan: (deltaX: number, deltaY: number) => void;
  resize: () => void;
};

export function cellToWorld(row: number, column: number) {
  return {
    x: column - GRID_X / 2,
    z: row - GRID_Z / 2,
  };
}

function makePieceLabelTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, 256, 256);
  context.font = "bold 190px Songti SC, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "rgba(20, 10, 5, 0.36)";
  context.fillText(text, 128, 121);
  context.fillStyle = color;
  context.fillText(text, 128, 116);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(12, 7, 4, 1)");
  gradient.addColorStop(0.55, "rgba(12, 7, 4, 0.72)");
  gradient.addColorStop(1, "rgba(12, 7, 4, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function makePieceGeometry() {
  const profile = [
    new THREE.Vector2(0, -0.15),
    new THREE.Vector2(0.4, -0.15),
    new THREE.Vector2(0.425, -0.145),
    new THREE.Vector2(0.442, -0.135),
    new THREE.Vector2(0.45, -0.12),
    new THREE.Vector2(0.458, -0.07),
    new THREE.Vector2(0.46, 0),
    new THREE.Vector2(0.458, 0.07),
    new THREE.Vector2(0.45, 0.12),
    new THREE.Vector2(0.442, 0.135),
    new THREE.Vector2(0.425, 0.145),
    new THREE.Vector2(0.4, 0.15),
    new THREE.Vector2(0, 0.15),
  ];
  const geometry = new THREE.LatheGeometry(profile, 64);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    if (normal.getY(index) > 0.5) {
      uv.setXY(index, x + 0.5, z + 0.5);
    } else {
      uv.setXY(index, x + 0.5, (y + 0.15) / 0.3);
    }
  }

  uv.needsUpdate = true;
  return geometry;
}

function makePlaneText(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 160;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "bold 110px Songti SC, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color;
  context.fillText(text, 240, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.7),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 3;
  return plane;
}

function makeGrid() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: 0x211008 });
  const horizontalGeometry = new THREE.BoxGeometry(GRID_X, 0.014, 0.026);
  const verticalGeometry = new THREE.BoxGeometry(
    0.026,
    0.014,
    GRID_Z / 2 - 0.5,
  );
  for (let column = 0; column < COLUMNS; column++) {
    const x = cellToWorld(0, column).x;
    for (const z of [-2.5, 2.5]) {
      const vertical = new THREE.Mesh(verticalGeometry, material);
      vertical.position.set(x, BOARD_Y + 0.018, z);
      group.add(vertical);
    }
  }
  for (let row = 0; row < ROWS; row++) {
    if (row === 4 || row === 5) continue;
    const z = cellToWorld(row, 0).z;
    const horizontal = new THREE.Mesh(horizontalGeometry, material);
    horizontal.position.set(0, BOARD_Y + 0.018, z);
    group.add(horizontal);
  }
  const riverBankGeometry = new THREE.BoxGeometry(GRID_X, 0.018, 0.038);
  for (const z of [-0.5, 0.5]) {
    const riverBank = new THREE.Mesh(riverBankGeometry, material);
    riverBank.position.set(0, BOARD_Y + 0.022, z);
    group.add(riverBank);
  }
  const riverSideGeometry = new THREE.BoxGeometry(0.026, 0.018, 1);
  for (const x of [-GRID_X / 2, GRID_X / 2]) {
    const riverSide = new THREE.Mesh(riverSideGeometry, material);
    riverSide.position.set(x, BOARD_Y + 0.022, 0);
    group.add(riverSide);
  }
  const diagonalGeometry = new THREE.BoxGeometry(Math.SQRT2 * 2, 0.014, 0.026);
  for (const z of [-3.5, 3.5]) {
    for (const angle of [-Math.PI / 4, Math.PI / 4]) {
      const diagonal = new THREE.Mesh(diagonalGeometry, material);
      diagonal.position.set(0, BOARD_Y + 0.022, z);
      diagonal.rotation.y = angle;
      group.add(diagonal);
    }
  }

  const addPositionMark = (row: number, column: number) => {
    const { x, z } = cellToWorld(row, column);
    const size = 0.1;
    const gap = 0.08;
    const horizontalGeometry = new THREE.BoxGeometry(size, 0.014, 0.026);
    const verticalGeometry = new THREE.BoxGeometry(0.026, 0.014, size);
    const horizontalSides = column === 0 ? [1] : column === 8 ? [-1] : [-1, 1];
    for (const sx of horizontalSides) {
      for (const sz of [-1, 1]) {
        const horizontal = new THREE.Mesh(horizontalGeometry, material);
        horizontal.position.set(
          x + sx * (gap + size / 2),
          BOARD_Y + 0.021,
          z + sz * gap,
        );
        group.add(horizontal);
        const vertical = new THREE.Mesh(verticalGeometry, material);
        vertical.position.set(
          x + sx * gap,
          BOARD_Y + 0.021,
          z + sz * (gap + size / 2),
        );
        group.add(vertical);
      }
    }
  };

  for (const column of [1, 7]) addPositionMark(2, column);
  for (const column of [0, 2, 4, 6, 8]) {
    addPositionMark(3, column);
    addPositionMark(6, column);
  }
  for (const column of [1, 7]) addPositionMark(7, column);

  const borderMaterial = new THREE.MeshBasicMaterial({ color: 0x130a06 });
  const addBorder = (halfWidth: number, halfDepth: number) => {
    const thickness = 0.032;
    const horizontal = new THREE.Mesh(
      new THREE.BoxGeometry(halfWidth * 2, 0.016, thickness),
      borderMaterial,
    );
    const vertical = new THREE.Mesh(
      new THREE.BoxGeometry(thickness, 0.016, halfDepth * 2),
      borderMaterial,
    );
    for (const z of [-halfDepth, halfDepth]) {
      const bar = horizontal.clone();
      bar.position.set(0, BOARD_Y + 0.02, z);
      group.add(bar);
    }
    for (const x of [-halfWidth, halfWidth]) {
      const bar = vertical.clone();
      bar.position.set(x, BOARD_Y + 0.02, 0);
      group.add(bar);
    }
  };
  addBorder(4.08, 4.58);
  return group;
}

function makeMarker(color: number, ring = false) {
  const geometry = ring
    ? new THREE.RingGeometry(0.49, 0.56, 32)
    : new THREE.CircleGeometry(0.11, 24);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: ring ? 0.92 : 0.72,
      depthTest: ring,
      depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = ring ? 10 : 4;
  return mesh;
}

function makePiece(piece: Piece, animate: boolean, woodTexture: THREE.Texture) {
  const side = pieceSide(piece);
  const labels = PIECE_LABELS[pieceType(piece)];
  const label = side === RED ? labels.red : labels.black;
  const group = new THREE.Group();
  const pieceTexture = woodTexture.clone();
  pieceTexture.offset.set(Math.random(), Math.random());
  pieceTexture.needsUpdate = true;
  const pieceMaterial = new THREE.MeshPhysicalMaterial({
    map: pieceTexture,
    color: 0xffffff,
    roughness: 0.42,
    clearcoat: 0.42,
    clearcoatRoughness: 0.18,
  });
  const base = new THREE.Mesh(makePieceGeometry(), pieceMaterial);
  base.castShadow = !animate;
  base.receiveShadow = true;
  group.add(base);

  const inset = new THREE.Mesh(
    new THREE.CircleGeometry(0.355, 64),
    new THREE.MeshStandardMaterial({
      map: pieceTexture,
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  );
  inset.rotation.x = -Math.PI / 2;
  inset.position.y = 0.152;
  inset.renderOrder = 1;
  group.add(inset);

  const insetEdge = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.395, 64),
    new THREE.MeshBasicMaterial({
      color: 0x24140d,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  insetEdge.rotation.x = -Math.PI / 2;
  insetEdge.position.y = 0.154;
  insetEdge.renderOrder = 2;
  group.add(insetEdge);

  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 48),
    new THREE.MeshBasicMaterial({
      map: makePieceLabelTexture(label, side === RED ? "#b11f2d" : "#171b1d"),
      transparent: true,
      depthTest: false,
    }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.157;
  face.renderOrder = 3;
  group.add(face);

  const rim = new THREE.Mesh(
    new THREE.RingGeometry(0.355, 0.39, 64),
    new THREE.MeshBasicMaterial({
      color: side === RED ? 0xa8272d : 0x171b1d,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.164;
  rim.renderOrder = 4;
  group.add(rim);
  group.userData.dropStart = animate ? performance.now() : 0;
  return group;
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

function applyWoodTone(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float woodLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(vec3(woodLuminance), diffuseColor.rgb, 0.72);
      diffuseColor.rgb *= vec3(0.96, 1.0, 1.03);`,
    );
  };
}

function makeBoardGeometry() {
  const radius = 0.32;
  const shape = new THREE.Shape();
  const halfWidth = BOARD_WIDTH / 2;
  const halfDepth = BOARD_DEPTH / 2;
  shape.moveTo(-halfWidth + radius, -halfDepth);
  shape.lineTo(halfWidth - radius, -halfDepth);
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius);
  shape.lineTo(halfWidth, halfDepth - radius);
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);
  shape.lineTo(-halfWidth + radius, halfDepth);
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius);
  shape.lineTo(-halfWidth, -halfDepth + radius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfDepth,
    -halfWidth + radius,
    -halfDepth,
  );

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.68,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 4,
    curveSegments: 4,
  });
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");

  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    if (normal.getY(index) > 0.7) {
      uv.setXY(
        index,
        (x + BOARD_WIDTH / 2) / BOARD_WIDTH,
        0.5 - z / BOARD_DEPTH,
      );
    } else {
      const sideAlongZ =
        Math.abs(normal.getX(index)) > Math.abs(normal.getZ(index));
      const horizontalSize = sideAlongZ ? BOARD_DEPTH : BOARD_WIDTH;
      const horizontal = sideAlongZ
        ? (z + BOARD_DEPTH / 2) / BOARD_DEPTH
        : (x + BOARD_WIDTH / 2) / BOARD_WIDTH;
      uv.setXY(index, horizontal, 0.5 - y / horizontalSize);
    }
  }

  uv.needsUpdate = true;
  return geometry;
}

function makeBoardTopGeometry() {
  const size = 0.16;
  const radius = 0.24;
  const width = BOARD_WIDTH - size;
  const depth = BOARD_DEPTH - size;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth + radius, -halfDepth);
  shape.lineTo(halfWidth - radius, -halfDepth);
  shape.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + radius);
  shape.lineTo(halfWidth, halfDepth - radius);
  shape.quadraticCurveTo(halfWidth, halfDepth, halfWidth - radius, halfDepth);
  shape.lineTo(-halfWidth + radius, halfDepth);
  shape.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - radius);
  shape.lineTo(-halfWidth, -halfDepth + radius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfDepth,
    -halfWidth + radius,
    -halfDepth,
  );

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  for (let index = 0; index < position.count; index++) {
    uv.setXY(
      index,
      (position.getX(index) + BOARD_WIDTH / 2) / BOARD_WIDTH,
      0.5 - position.getZ(index) / BOARD_DEPTH,
    );
  }
  uv.needsUpdate = true;
  return geometry;
}

export function createScene(): ChessScene {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app")!.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#11171a");
  scene.fog = new THREE.Fog("#11171a", 24, 54);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(camera);

  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x202a2d, roughness: 0.96 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.45;
  table.receiveShadow = true;
  scene.add(table);

  const woodTextures = loadWoodTextures();
  const contactShadowTexture = makeContactShadowTexture();
  const boardMaterial = new THREE.MeshStandardMaterial({
    map: woodTextures.color,
    normalMap: woodTextures.normal,
    normalScale: new THREE.Vector2(0.72, 0.72),
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  applyWoodTone(boardMaterial);
  const pieceWoodTexture = woodTextures.color.clone();
  pieceWoodTexture.wrapS = pieceWoodTexture.wrapT = THREE.RepeatWrapping;
  pieceWoodTexture.repeat.set(1.4, 1.4);
  pieceWoodTexture.center.set(0.5, 0.5);
  pieceWoodTexture.rotation = Math.PI / 2;
  pieceWoodTexture.needsUpdate = true;

  const board = new THREE.Mesh(makeBoardGeometry(), boardMaterial);
  board.position.y = BOARD_Y - 0.76;
  board.castShadow = true;
  board.receiveShadow = false;
  scene.add(board);
  const boardTop = new THREE.Mesh(makeBoardTopGeometry(), boardMaterial);
  boardTop.position.y = BOARD_Y + 0.002;
  boardTop.receiveShadow = true;
  scene.add(boardTop);
  scene.add(makeGrid());

  const riverLeft = makePlaneText("楚河", "#211008");
  riverLeft.position.set(-2.15, BOARD_Y + 0.035, 0);
  scene.add(riverLeft);
  const riverRight = makePlaneText("汉界", "#211008");
  riverRight.position.set(2.15, BOARD_Y + 0.035, 0);
  riverRight.rotation.z = Math.PI;
  scene.add(riverRight);

  const cursor = new THREE.Group();
  cursor.add(makeMarker(0xf1cf82, true));
  cursor.position.y = BOARD_Y + 0.035;
  cursor.renderOrder = 5;
  scene.add(cursor);
  const selected = new THREE.Group();
  selected.add(makeMarker(0xffbe58, true));
  selected.position.y = BOARD_Y + 0.04;
  selected.renderOrder = 5;
  scene.add(selected);
  const targets = new THREE.Group();
  targets.renderOrder = 5;
  scene.add(targets);
  const lastMark = makeMarker(0xf2e7c6, true);
  lastMark.position.y = BOARD_Y + 0.045;
  lastMark.visible = false;
  scene.add(lastMark);

  const pieces = new Map<number, THREE.Object3D>();
  const pieceShadows = new Map<number, THREE.Mesh>();
  const targetMarkers: THREE.Mesh[] = [];
  const syncBoard = (
    boardState: Int8Array,
    selectedCell: number | null,
    legalTargets: number[],
    animate: boolean,
  ) => {
    for (const [cell, object] of pieces) {
      if (!boardState[cell] || object.userData.piece !== boardState[cell]) {
        scene.remove(object);
        disposeObject(object);
        pieces.delete(cell);
        const shadow = pieceShadows.get(cell);
        if (shadow) {
          scene.remove(shadow);
          disposeObject(shadow, false);
          pieceShadows.delete(cell);
        }
      }
    }
    for (let cell = 0; cell < boardState.length; cell++) {
      if (!boardState[cell]) continue;
      if (pieces.has(cell)) continue;
      const object = makePiece(boardState[cell], animate, pieceWoodTexture);
      object.userData.piece = boardState[cell];
      const point = cellToWorld(rowOf(cell), columnOf(cell));
      object.position.set(
        point.x,
        BOARD_Y + 0.16 + (animate ? 0.7 : 0),
        point.z,
      );
      scene.add(object);
      pieces.set(cell, object);
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 32),
        new THREE.MeshBasicMaterial({
          map: contactShadowTexture,
          transparent: true,
          opacity: 1,
          depthTest: true,
          depthWrite: false,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(point.x + 0.07, BOARD_Y + 0.008, point.z - 0.07);
      shadow.renderOrder = 1;
      shadow.visible = !animate;
      shadow.userData.revealAt = animate ? performance.now() + 360 : 0;
      scene.add(shadow);
      pieceShadows.set(cell, shadow);
    }
    updateSelection(selectedCell, legalTargets);
  };

  const updateSelection = (
    selectedCell: number | null,
    legalTargets: number[],
  ) => {
    selected.visible = selectedCell !== null;
    if (selectedCell !== null) {
      const point = cellToWorld(rowOf(selectedCell), columnOf(selectedCell));
      selected.position.x = point.x;
      selected.position.z = point.z;
    }
    for (let index = 0; index < legalTargets.length; index++) {
      const marker = targetMarkers[index] ?? makeMarker(0xefd28b);
      if (!targetMarkers[index]) {
        targetMarkers.push(marker);
        targets.add(marker);
      }
      const cell = legalTargets[index];
      const point = cellToWorld(rowOf(cell), columnOf(cell));
      marker.position.set(point.x, BOARD_Y + 0.045, point.z);
      marker.visible = true;
    }
    for (
      let index = legalTargets.length;
      index < targetMarkers.length;
      index++
    ) {
      targetMarkers[index].visible = false;
    }
  };

  const clear = () => {
    for (const object of pieces.values()) {
      scene.remove(object);
      disposeObject(object);
    }
    for (const shadow of pieceShadows.values()) {
      scene.remove(shadow);
      disposeObject(shadow, false);
    }
    pieces.clear();
    pieceShadows.clear();
    selected.visible = false;
    lastMark.visible = false;
    for (const marker of targetMarkers) {
      targets.remove(marker);
      disposeObject(marker);
    }
    targetMarkers.length = 0;
  };

  const keyLight = new THREE.DirectionalLight(0xffdfb0, 2.4);
  keyLight.position.set(-6, 16, 7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -12;
  keyLight.shadow.camera.right = 12;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.001;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(new THREE.HemisphereLight(0xaec5ce, 0x211815, 0.74));
  const rim = new THREE.PointLight(0x6b9ca1, 16, 30, 2);
  rim.position.set(7, 8, -10);
  scene.add(rim);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_Y);
  let orbitYaw = 0;
  let orbitPitch = 0.38;
  let orbitDistance = 15;
  const orbitTarget = new THREE.Vector3(0, 0.3, 0);

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
    orbitPitch = clamp(orbitPitch - deltaY * 0.006, 0.04, 1.12);
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
    const scale = orbitDistance * 0.0012;
    orbitTarget.addScaledVector(right, -deltaX * scale);
    orbitTarget.addScaledVector(forward, deltaY * scale);
    applyCameraOrbit();
  };
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    const fit =
      BOARD_DEPTH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    orbitDistance = fit * Math.max(1, 1 / (width / height)) * 1.08;
    applyCameraOrbit();
    camera.updateProjectionMatrix();
  };
  const pickCell = (clientX: number, clientY: number) => {
    pointer.x = (clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return null;
    const column = Math.round(hit.x + GRID_X / 2);
    const row = Math.round(hit.z + GRID_Z / 2);
    return row >= 0 && row < ROWS && column >= 0 && column < COLUMNS
      ? { row, column }
      : null;
  };
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
    updateSelection,
    clear,
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
    chessScene.cursor.scale.set(pulse, 1, pulse);
    hasMotion = true;
  }
  if (chessScene.selected.visible) {
    const selectedPulse = 1 + Math.sin(now * 0.006) * 0.08;
    chessScene.selected.scale.set(selectedPulse, 1, selectedPulse);
    hasMotion = true;
  }
  for (const object of chessScene.scene.children) {
    const revealAt = object.userData.revealAt as number | undefined;
    if (revealAt) {
      if (now >= revealAt) {
        object.visible = true;
        object.userData.revealAt = 0;
      } else {
        hasMotion = true;
      }
      continue;
    }
    const start = object.userData.dropStart as number | undefined;
    if (!start) continue;
    hasMotion = true;
    const progress = clamp((now - start) / 360, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    object.position.y = BOARD_Y + 0.16 + 0.7 * (1 - eased);
    if (progress >= 1) {
      object.userData.dropStart = 0;
      object.position.y = BOARD_Y + 0.16;
      object.traverse((child) => {
        child.castShadow = true;
      });
    }
  }
  return hasMotion;
}
