import "./ui/style.css";
import clamp from "licia/clamp";
import { chooseMove } from "./game/ai";
import {
  CELL_COUNT,
  COLUMNS,
  clonePosition,
  generateLegalMoves,
  index,
  makeMove,
  positionKey,
  resultFor,
  ROWS,
  type Move,
} from "./game/rules";
import { computerSide, createGameState, savePosition } from "./game/state";
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
  showPromotion,
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
const chessScene = createScene(requestRender);
const audio = new AudioKit();
chessScene.onPieceMotionComplete(() => audio.play());
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
  const lastMoveCell = lastMove?.to ?? null;
  chessScene.syncBoard(game.position.board, lastMove);
  chessScene.updateSelection(game.selected, game.legalTargets);
  chessScene.updateLastMove(
    lastMoveCell !== selectedCell && lastMoveCell !== game.cursor
      ? lastMoveCell
      : null,
  );
  chessScene.cursor.visible =
    (game.phase === "play" || game.phase === "thinking") &&
    game.cursor !== selectedCell;
  const point = cellToWorld(
    Math.floor(game.cursor / COLUMNS),
    game.cursor % COLUMNS,
  );
  chessScene.cursor.position.x = point.x;
  chessScene.cursor.position.z = point.z;
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

function repetitionCount() {
  const key = positionKey(game.position);
  return [...game.history, game.position].filter(
    (position) => positionKey(position) === key,
  ).length;
}

function resetMatchState(phase: "menu" | "play") {
  cancelComputerMove();
  matchVersion++;
  game.position = clonePosition(createGameState().position);
  game.history.length = 0;
  game.moves.length = 0;
  game.phase = phase;
  game.cursor = 52;
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

function finish(result: "white" | "black" | "draw") {
  game.phase = "over";
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  showResult(ui, result, strings());
  refresh();
}

function scheduleResult(result: "white" | "black" | "draw") {
  const currentMatch = matchVersion;
  const showWhenReady = () => {
    resultTimer = undefined;
    if (currentMatch !== matchVersion) return;
    if (chessScene.isPieceMoving()) {
      resultTimer = window.setTimeout(showWhenReady, 40);
      return;
    }
    resultTimer = window.setTimeout(() => {
      resultTimer = undefined;
      if (currentMatch === matchVersion) finish(result);
    }, 2000);
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
    if (chessScene.isPieceMoving()) {
      computerMoveTimer = window.setTimeout(runWhenReady, 40);
      return;
    }
    runComputerMove();
  };
  computerMoveTimer = window.setTimeout(runWhenReady, 220);
}

function commitMove(move: Move) {
  savePosition(game);
  game.moves.push(move);
  game.position = makeMove(game.position, move);
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = move;
  audio.unlock();
  refresh();

  const result = resultFor(game.position, repetitionCount());
  if (result !== "playing") {
    game.phase = "over";
    refresh();
    scheduleResult(result);
    return;
  }
  if (game.mode === "pve" && game.position.turn === computerSide) {
    scheduleComputerMove();
  }
}

function selectCell(cell: number) {
  if (game.phase !== "play" || chessScene.isPieceMoving()) return;
  setCursor(cell);
  if (game.selected !== null && game.legalTargets.includes(cell)) {
    const candidates = selectedMoves.filter(
      (move) => move.from === game.selected && move.to === cell,
    );
    if (candidates.length > 1) {
      showPromotion(ui, candidates, game.position.turn, strings(), commitMove);
    } else if (candidates[0]) {
      commitMove(candidates[0]);
    }
    return;
  }
  const piece = game.position.board[cell];
  if (piece !== 0 && Math.sign(piece) === game.position.turn) {
    game.selected = cell;
    selectedMoves = generateLegalMoves(game.position).filter(
      (move) => move.from === cell,
    );
    game.legalTargets = selectedMoves.map((move) => move.to);
  } else {
    game.selected = null;
    game.legalTargets = [];
    selectedMoves = [];
  }
  refresh();
}

function runComputerMove() {
  if (game.phase !== "thinking" || chessScene.isPieceMoving()) return;
  const move = chooseMove(game.position, game.difficulty);
  if (!move) {
    finish(
      resultFor(game.position, repetitionCount()) as "white" | "black" | "draw",
    );
    return;
  }
  game.phase = "play";
  setCursor(move.to);
  commitMove(move);
}

function undo() {
  if (
    game.phase === "menu" ||
    game.phase === "thinking" ||
    chessScene.isPieceMoving() ||
    game.history.length === 0
  ) {
    return;
  }
  cancelComputerMove();
  const count = game.mode === "pve" ? Math.min(2, game.history.length) : 1;
  for (let step = 0; step < count; step++) {
    game.position = game.history.pop()!;
    game.moves.pop();
  }
  matchVersion++;
  game.phase = "play";
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = game.moves[game.moves.length - 1] ?? null;
  game.cursor = lastMove?.to ?? 52;
  refresh();
}

bindInput(chessScene, ui, {
  getPhase: () => (chessScene.isPieceMoving() ? "thinking" : game.phase),
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
  const hasSceneMotion = updateSceneMotion(chessScene, now);
  const hasPieceMotion = chessScene.updatePieceMotion(now);
  const hasMotion = hasSceneMotion || hasPieceMotion;
  chessScene.renderer.render(chessScene.scene, chessScene.camera);
  if (hasMotion) requestRender();
}

window.addEventListener("resize", () => {
  chessScene.resize();
  requestRender();
});
