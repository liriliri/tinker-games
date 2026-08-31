import "./ui/style.css";
import clamp from "licia/clamp";
import { AudioKit } from "./lib/audio";
import { chooseMove } from "./game/ai";
import {
  applyMove,
  BLACK,
  COLUMNS,
  generateLegalMoves,
  index,
  newBoard,
  RED,
  resultFor,
  ROWS,
  type Move,
} from "./game/rules";
import { computerSide, createGameState } from "./game/state";
import { bindInput } from "./lib/input";
import { cellToWorld, createScene, updateSceneMotion } from "./lib/scene";
import {
  loadDifficulty,
  loadMode,
  saveDifficulty,
  saveMode,
} from "./lib/storage";
import { copy, detectLocale, type Locale } from "./lib/i18n";
import {
  applyLocale as applyLocaleView,
  getGameUi,
  setDifficultySelection,
  setMenuVisible,
  setModeSelection,
  showResult,
  updateTurn,
} from "./ui/view";

const chessScene = createScene();
const audio = new AudioKit();
const ui = getGameUi();
const game = createGameState(loadMode(), loadDifficulty());
let locale: Locale = "zh-CN";
let computerMoveTimer: number | undefined;
let matchVersion = 0;
let lastMove: Move | null = null;
let selectedMoves: Move[] = [];
let renderScheduled = false;

const strings = () => copy[locale];

function requestRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(renderFrame);
}

function cancelComputerMove() {
  if (computerMoveTimer !== undefined) {
    window.clearTimeout(computerMoveTimer);
    computerMoveTimer = undefined;
  }
}

function setCursor(row: number, column: number) {
  game.cursor.row = clamp(row, 0, ROWS - 1);
  game.cursor.column = clamp(column, 0, COLUMNS - 1);
  const point = cellToWorld(game.cursor.row, game.cursor.column);
  chessScene.cursor.position.set(
    point.x,
    chessScene.cursor.position.y,
    point.z,
  );
  requestRender();
}

function refreshTurn() {
  updateTurn(ui, game, strings());
}

function refreshBoard(animate = false) {
  chessScene.syncBoard(game.board, game.selected, game.legalTargets, animate);
  if (lastMove) {
    const point = cellToWorld(
      Math.floor(lastMove.to / COLUMNS),
      lastMove.to % COLUMNS,
    );
    chessScene.lastMark.position.set(
      point.x,
      chessScene.lastMark.position.y,
      point.z,
    );
    chessScene.lastMark.visible = true;
  } else {
    chessScene.lastMark.visible = false;
  }
  requestRender();
}

function resetMatchState(phase: "menu" | "play") {
  cancelComputerMove();
  matchVersion++;
  game.board = newBoard();
  game.history.length = 0;
  game.phase = phase;
  if (phase === "play") game.turn = RED;
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = null;
}

function startMatch() {
  resetMatchState("play");
  setCursor(6, 4);
  setMenuVisible(ui, false);
  refreshBoard();
  refreshTurn();
  audio.unlock();
}

function openMenu() {
  resetMatchState("menu");
  chessScene.clear();
  requestRender();
  setMenuVisible(ui, true);
  refreshTurn();
}

function finish(result: "red" | "black" | "draw") {
  game.phase = "over";
  chessScene.cursor.visible = false;
  showResult(ui, result, strings());
  refreshTurn();
}

function commitMove(move: Move) {
  applyMove(game.board, move);
  game.history.push(move);
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = move;
  audio.unlock();
  audio.play(move.captured !== 0);
  game.turn = game.turn === RED ? BLACK : RED;
  refreshBoard(true);

  const result = resultFor(game.board, game.turn);
  if (result !== "playing") {
    finish(result);
    return;
  }
  if (game.mode === "pve" && game.turn === computerSide) {
    game.phase = "thinking";
    const currentMatch = matchVersion;
    computerMoveTimer = window.setTimeout(() => {
      computerMoveTimer = undefined;
      if (currentMatch === matchVersion) runComputerMove();
    }, 420);
  }
  refreshTurn();
}

function selectCell(row: number, column: number) {
  if (game.phase !== "play") return;
  const cell = index(row, column);
  if (game.selected !== null && game.legalTargets.includes(cell)) {
    const move = selectedMoves.find(
      (candidate) => candidate.from === game.selected && candidate.to === cell,
    );
    if (move) commitMove(move);
    return;
  }
  if (game.board[cell] !== 0 && Math.sign(game.board[cell]) === game.turn) {
    game.selected = cell;
    selectedMoves = generateLegalMoves(game.board, game.turn).filter(
      (move) => move.from === cell,
    );
    game.legalTargets = selectedMoves.map((move) => move.to);
  } else {
    game.selected = null;
    game.legalTargets = [];
    selectedMoves = [];
  }
  chessScene.updateSelection(game.selected, game.legalTargets);
  requestRender();
  refreshTurn();
}

function runComputerMove() {
  if (game.phase !== "thinking") return;
  const move = chooseMove(
    game.board,
    computerSide,
    game.difficulty,
    game.history,
  );
  if (!move) {
    finish(resultFor(game.board, computerSide) as "red" | "black" | "draw");
    return;
  }
  setCursor(Math.floor(move.to / COLUMNS), move.to % COLUMNS);
  game.phase = "play";
  commitMove(move);
}

function undo() {
  if (
    game.phase === "menu" ||
    game.phase === "thinking" ||
    game.history.length === 0
  )
    return;
  cancelComputerMove();
  const count = game.mode === "pve" ? Math.min(2, game.history.length) : 1;
  for (let i = 0; i < count; i++) {
    const move = game.history.pop()!;
    game.board[move.from] = move.piece;
    game.board[move.to] = move.captured;
  }
  matchVersion++;
  game.turn = game.history.length % 2 === 0 ? RED : BLACK;
  game.phase = "play";
  game.selected = null;
  game.legalTargets = [];
  selectedMoves = [];
  lastMove = game.history[game.history.length - 1] ?? null;
  chessScene.cursor.visible = true;
  refreshBoard();
  refreshTurn();
}

const input = bindInput(chessScene, ui, {
  getPhase: () => game.phase,
  getCursor: () => game.cursor,
  setCursor,
  moveCursor: (rowDelta, columnDelta) =>
    setCursor(game.cursor.row + rowDelta, game.cursor.column + columnDelta),
  selectCell,
  startMatch,
  openMenu,
  undo,
  setMode: (mode) => {
    game.mode = mode;
    saveMode(mode);
    setModeSelection(ui, mode);
    refreshTurn();
  },
  setDifficulty: (difficulty) => {
    game.difficulty = difficulty;
    saveDifficulty(difficulty);
    setDifficultySelection(difficulty);
  },
  toggleSound: () => {
    game.sound = !game.sound;
    audio.setEnabled(game.sound);
    audio.unlock();
    applyLocale();
  },
  unlockAudio: () => audio.unlock(),
  requestRender,
});

function applyLocale() {
  applyLocaleView(ui, game, locale, refreshTurn);
}

function renderFrame(now: number) {
  renderScheduled = false;
  input.pollGamepad(now);
  const visible = game.phase === "play" || game.phase === "thinking";
  chessScene.cursor.visible = visible;
  const hasMotion = updateSceneMotion(chessScene, now);
  chessScene.renderer.render(chessScene.scene, chessScene.camera);
  if (visible || hasMotion) requestRender();
}

window.addEventListener("resize", () => {
  chessScene.resize();
  requestRender();
});
detectLocale().then((detectedLocale) => {
  locale = detectedLocale;
  applyLocale();
});
setModeSelection(ui, game.mode);
setDifficultySelection(game.difficulty);
setMenuVisible(ui, true);
refreshTurn();
requestRender();
