import "./ui/style.css";
import clamp from "licia/clamp";
import { chooseMove } from "./game/ai";
import {
  CELL_COUNT,
  COLUMNS,
  applyMove,
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
let computerMoveTimer: number | undefined;
let resultTimer: number | undefined;
let matchVersion = 0;
let lastMove: Move | null = null;
let selectedMoves: Move[] = [];

const strings = () => copy[locale];

function refresh() {
  const selectedCell = game.selected;
  const lastMoveCell = lastMove ? darkPosToCell(lastMove.destination) : null;
  checkersScene.syncBoard(boardFromGame(game.draughts), lastMove);
  checkersScene.updateSelection(game.selected, game.legalTargets);
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

function cancelComputerMove() {
  if (computerMoveTimer !== undefined) {
    window.clearTimeout(computerMoveTimer);
    computerMoveTimer = undefined;
  }
  if (resultTimer !== undefined) {
    window.clearTimeout(resultTimer);
    resultTimer = undefined;
  }
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
  cancelComputerMove();
  matchVersion++;
  game.draughts = newGame();
  game.history.length = 0;
  game.moves.length = 0;
  game.phase = phase;
  game.cursor = darkPosToCell(20);
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
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
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  showResult(ui, result, strings());
  refresh();
}

function scheduleResult(result: "dark" | "light" | "draw") {
  const currentMatch = matchVersion;
  const showWhenReady = () => {
    resultTimer = undefined;
    if (currentMatch !== matchVersion) return;
    if (checkersScene.isPieceMoving()) {
      resultTimer = window.setTimeout(showWhenReady, 40);
      return;
    }
    resultTimer = window.setTimeout(() => {
      resultTimer = undefined;
      if (currentMatch === matchVersion) finish(result);
    }, 1600);
  };
  showWhenReady();
}

function scheduleComputerMove() {
  game.phase = "thinking";
  const currentMatch = matchVersion;
  refresh();
  const runWhenReady = () => {
    computerMoveTimer = undefined;
    if (currentMatch !== matchVersion) return;
    if (checkersScene.isPieceMoving()) {
      computerMoveTimer = window.setTimeout(runWhenReady, 40);
      return;
    }
    void runComputerMove(currentMatch);
  };
  computerMoveTimer = window.setTimeout(runWhenReady, 220);
}

function commitMove(move: Move) {
  game.history.push(snapshotOf(game.draughts));
  game.moves.push(move);
  applyMove(game.draughts, move);
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = move;
  audio.unlock();
  refresh();

  const result = resultFor(game.draughts);
  if (result !== "playing") {
    game.phase = "over";
    refresh();
    scheduleResult(result);
    return;
  }
  if (
    game.mode === "pve" &&
    playerToSide(game.draughts.player) === computerSide
  ) {
    scheduleComputerMove();
  }
}

function selectCell(cell: number) {
  if (game.phase !== "play" || checkersScene.isPieceMoving()) return;
  setCursor(cell);
  if (game.selected !== null && game.legalTargets.includes(cell)) {
    const selectedPos = cellToDarkPos(game.selected);
    const targetPos = cellToDarkPos(cell);
    const candidates = selectedMoves.filter(
      (move) => move.origin === selectedPos && move.destination === targetPos,
    );
    candidates.sort((a, b) => b.captures.length - a.captures.length);
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
    selectedMoves = movesFrom(game.draughts, darkPos);
    game.legalTargets = selectedMoves.map((move) =>
      darkPosToCell(move.destination),
    );
  } else {
    game.selected = null;
    game.legalTargets = [];
    selectedMoves = [];
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
  cancelComputerMove();
  const count = game.mode === "pve" ? Math.min(2, game.history.length) : 1;
  let snapshot = game.history[game.history.length - 1]!;
  for (let step = 0; step < count; step++) {
    snapshot = game.history.pop()!;
    game.moves.pop();
  }
  game.draughts = restoreGame(snapshot);
  matchVersion++;
  game.phase = "play";
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = game.moves[game.moves.length - 1] ?? null;
  game.cursor = lastMove
    ? darkPosToCell(lastMove.destination)
    : darkPosToCell(20);
  refresh();
}

bindInput(checkersScene, ui, {
  getPhase: () => (checkersScene.isPieceMoving() ? "thinking" : game.phase),
  getCursor: () => game.cursor,
  setCursor,
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
