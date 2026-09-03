import "./ui/style.css";
import clamp from "licia/clamp";
import contain from "licia/contain";
import filter from "licia/filter";
import last from "licia/last";
import map from "licia/map";
import min from "licia/min";
import sleep from "licia/sleep";
import sortBy from "licia/sortBy";
import { chooseMove } from "./game/ai";
import {
  CELL_COUNT,
  COLUMNS,
  DEFAULT_CURSOR_CELL,
  boardFromGame,
  cellToDarkPos,
  darkPosToCell,
  movesFrom,
  newGame,
  playerToSide,
  restoreGame,
  resultFor,
  ROWS,
  snapshotOf,
  index,
  type Move,
} from "./game/rules";
import { computerSide, createGameState } from "./game/state";
import { bindInput } from "./lib/input";
import { AudioKit } from "./lib/audio";
import { detectLocale, copy, type Locale } from "./lib/i18n";
import { cellToWorld, createScene, updateSceneMotion } from "./lib/scene";
import {
  applyLocale as applyLocaleView,
  getGameUi,
  setDifficultySelection,
  setMenuVisible,
  setModeSelection,
  showResult,
  updateTurn,
} from "./ui/view";
import {
  loadDifficulty,
  loadMode,
  saveDifficulty,
  saveMode,
} from "./lib/storage";

let renderScheduled = false;
const checkersScene = createScene(requestRender);
const audio = new AudioKit();
checkersScene.onPieceMotionComplete(() => audio.play());
const ui = getGameUi();
const game = createGameState(loadMode(), loadDifficulty());
let locale: Locale = "zh-CN";
let matchVersion = 0;
let lastMove: Move | null = null;

const strings = () => copy[locale];

function legalTargets() {
  return map(game.selectedMoves, (move) => darkPosToCell(move.destination));
}

function clearSelection() {
  game.selected = null;
  game.selectedMoves = [];
}

function refresh() {
  const selectedCell = game.selected;
  const lastMoveCell = lastMove ? darkPosToCell(lastMove.destination) : null;
  checkersScene.syncBoard(boardFromGame(game.draughts), lastMove);
  checkersScene.updateSelection(game.selected, legalTargets());
  checkersScene.updateLastMove(
    lastMoveCell !== selectedCell && lastMoveCell !== game.cursor
      ? lastMoveCell
      : null,
  );
  checkersScene.cursor.visible =
    (game.phase === "play" || game.phase === "thinking") &&
    game.cursor !== selectedCell;
  const point = cellToWorld(
    Math.floor(game.cursor / COLUMNS),
    game.cursor % COLUMNS,
  );
  checkersScene.cursor.position.x = point.x;
  checkersScene.cursor.position.z = point.z;
  updateTurn(ui, game, strings());
  requestRender();
}

function waitForPieceIdle(): Promise<void> {
  if (!checkersScene.isPieceMoving()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = checkersScene.onPieceMotionComplete(() => {
      unsubscribe();
      resolve();
    });
  });
}

function setCursor(cell: number) {
  game.cursor = clamp(cell, 0, CELL_COUNT - 1);
  refresh();
}

function requestRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(renderFrame);
}

function moveCursor(rowDelta: number, columnDelta: number) {
  const row = Math.floor(game.cursor / COLUMNS);
  const column = game.cursor % COLUMNS;
  const nextRow = clamp(row + rowDelta, 0, ROWS - 1);
  const nextColumn = clamp(column + columnDelta, 0, COLUMNS - 1);
  setCursor(index(nextRow, nextColumn));
}

function resetMatchState(phase: "menu" | "play") {
  matchVersion++;
  game.draughts = newGame();
  game.history.length = 0;
  game.moves.length = 0;
  game.phase = phase;
  game.cursor = DEFAULT_CURSOR_CELL;
  clearSelection();
  lastMove = null;
}

function startMatch() {
  resetMatchState("play");
  setMenuVisible(ui, false);
  audio.unlock();
  refresh();
}

function openMenu() {
  resetMatchState("menu");
  setMenuVisible(ui, true);
  refresh();
}

function finish(result: "dark" | "light" | "draw") {
  game.phase = "over";
  clearSelection();
  showResult(ui, result, strings());
  refresh();
}

async function scheduleResult(result: "dark" | "light" | "draw") {
  const currentMatch = matchVersion;
  await waitForPieceIdle();
  if (currentMatch !== matchVersion) return;
  await sleep(1600);
  if (currentMatch === matchVersion) finish(result);
}

async function scheduleComputerMove() {
  game.phase = "thinking";
  const currentMatch = matchVersion;
  refresh();
  await waitForPieceIdle();
  if (currentMatch !== matchVersion) return;
  await sleep(220);
  if (currentMatch !== matchVersion) return;
  void runComputerMove(currentMatch);
}

function commitMove(move: Move) {
  game.history.push(snapshotOf(game.draughts));
  game.moves.push(move);
  game.draughts.move(move);
  clearSelection();
  lastMove = move;
  audio.unlock();
  refresh();

  const result = resultFor(game.draughts);
  if (result !== "playing") {
    game.phase = "over";
    refresh();
    void scheduleResult(result);
    return;
  }
  if (
    game.mode === "pve" &&
    playerToSide(game.draughts.player) === computerSide
  ) {
    void scheduleComputerMove();
  }
}

function selectCell(cell: number) {
  if (game.phase !== "play" || checkersScene.isPieceMoving()) return;
  game.cursor = clamp(cell, 0, CELL_COUNT - 1);
  const targets = legalTargets();
  if (game.selected !== null && contain(targets, cell)) {
    const selectedPos = cellToDarkPos(game.selected);
    const targetPos = cellToDarkPos(cell);
    const candidates = sortBy(
      filter(
        game.selectedMoves,
        (move) => move.origin === selectedPos && move.destination === targetPos,
      ),
      (move) => -move.captures.length,
    );
    if (candidates[0]) commitMove(candidates[0]);
    return;
  }
  const darkPos = cellToDarkPos(cell);
  const board = boardFromGame(game.draughts);
  const piece = board[cell];
  if (
    darkPos !== null &&
    piece !== 0 &&
    Math.sign(piece) === playerToSide(game.draughts.player)
  ) {
    game.selected = cell;
    game.selectedMoves = movesFrom(game.draughts, darkPos);
  } else {
    clearSelection();
  }
  refresh();
}

async function runComputerMove(currentMatch: number) {
  if (game.phase !== "thinking" || checkersScene.isPieceMoving()) return;
  if (currentMatch !== matchVersion) return;
  const move = await chooseMove(game.draughts, game.difficulty);
  if (currentMatch !== matchVersion) return;
  if (!move) {
    finish(resultFor(game.draughts) as "dark" | "light" | "draw");
    return;
  }
  game.phase = "play";
  setCursor(darkPosToCell(move.destination));
  commitMove(move);
}

function undo() {
  if (
    game.phase === "menu" ||
    game.phase === "thinking" ||
    checkersScene.isPieceMoving() ||
    game.history.length === 0
  ) {
    return;
  }
  const count = game.mode === "pve" ? min(2, game.history.length) : 1;
  let snapshot = last(game.history)!;
  for (let step = 0; step < count; step++) {
    snapshot = game.history.pop()!;
    game.moves.pop();
  }
  game.draughts = restoreGame(snapshot);
  matchVersion++;
  game.phase = "play";
  clearSelection();
  lastMove = last(game.moves) ?? null;
  game.cursor = lastMove
    ? darkPosToCell(lastMove.destination)
    : DEFAULT_CURSOR_CELL;
  refresh();
}

bindInput(checkersScene, ui, {
  getPhase: () => (checkersScene.isPieceMoving() ? "thinking" : game.phase),
  getCursor: () => game.cursor,
  moveCursor,
  selectCell,
  startMatch,
  openMenu,
  undo,
  setMode: (mode) => {
    game.mode = mode;
    saveMode(mode);
    setModeSelection(ui, mode);
    refresh();
  },
  setDifficulty: (difficulty) => {
    game.difficulty = difficulty;
    saveDifficulty(difficulty);
    setDifficultySelection(difficulty);
  },
  toggleSound: () => {
    game.sound = !game.sound;
    audio.setEnabled(game.sound);
    applyLocale();
  },
  unlockAudio: () => audio.unlock(),
  requestRender,
});

function applyLocale() {
  applyLocaleView(ui, game, locale, updateTurn.bind(null, ui, game));
}

setModeSelection(ui, game.mode);
setDifficultySelection(game.difficulty);
setMenuVisible(ui, true);
refresh();
detectLocale().then((detectedLocale) => {
  locale = detectedLocale;
  applyLocale();
});

function renderFrame(now: number) {
  renderScheduled = false;
  const hasSceneMotion = updateSceneMotion(checkersScene, now);
  const hasPieceMotion = checkersScene.updatePieceMotion(now);
  const hasMotion = hasSceneMotion || hasPieceMotion;
  checkersScene.renderer.render(checkersScene.scene, checkersScene.camera);
  if (hasMotion) requestRender();
}

window.addEventListener("resize", () => {
  checkersScene.resize();
  requestRender();
});
