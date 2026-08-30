import "./style.css";
import clamp from "licia/clamp";
import { AudioKit } from "./audio";
import { chooseMove } from "./game/ai";
import {
  BLACK,
  BOARD_SIZE,
  getFlips,
  getLegalMoves,
  isGameOver,
  newBoard,
  opposite,
  countStones,
  index,
  type Stone,
} from "./game/rules";
import { createGameState } from "./game/state";
import { bindInput } from "./input";
import { cellToWorld, createScene, updateSceneMotion } from "./scene";
import { loadDifficulty, loadMode, saveDifficulty, saveMode } from "./storage";
import { copy, detectLocale, type Locale } from "./ui/i18n";
import {
  applyLocale as applyLocaleView,
  getGameUi,
  setDifficultySelection,
  setMenuVisible as setMenuVisibleView,
  setModeSelection,
  updateScore,
  updateTurn as updateTurnView,
} from "./ui/view";

const boardScene = createScene();
const audio = new AudioKit();
const ui = getGameUi();
const game = createGameState(loadMode(), loadDifficulty());
let locale: Locale = "en";
const getCopy = () => copy[locale];
let computerMoveTimer: number | undefined;
let passTimer: number | undefined;
let animationTimer: number | undefined;
let matchVersion = 0;

function cancelPendingTimers() {
  if (computerMoveTimer !== undefined) {
    window.clearTimeout(computerMoveTimer);
    computerMoveTimer = undefined;
  }
  if (passTimer !== undefined) {
    window.clearTimeout(passTimer);
    passTimer = undefined;
  }
  if (animationTimer !== undefined) {
    window.clearTimeout(animationTimer);
    animationTimer = undefined;
  }
}

const applyLocale = () =>
  applyLocaleView(ui, game, locale, (strings) => {
    updateTurnView(ui, game, strings);
    updateScore(ui, game.board);
  });
const updateTurn = () => updateTurnView(ui, game, getCopy());
const setMenuVisible = (visible: boolean) => setMenuVisibleView(ui, visible);

function setCursor(row: number, column: number) {
  game.cursor.row = clamp(row, 0, BOARD_SIZE - 1);
  game.cursor.column = clamp(column, 0, BOARD_SIZE - 1);
  const point = cellToWorld(game.cursor.row, game.cursor.column);
  boardScene.cursor.position.x = point.x;
  boardScene.cursor.position.z = point.z;
}

function refreshLegalMoves(moves = getLegalMoves(game.board, game.turn)) {
  boardScene.updateLegalMoves(game.phase === "play" ? moves : []);
}

function showResult() {
  cancelPendingTimers();
  const score = countStones(game.board);
  game.phase = "over";
  game.passed = false;
  boardScene.cursor.visible = false;
  boardScene.updateLegalMoves([]);
  ui.result.classList.remove("hidden");
  ui.resultBlack.textContent = String(score.black);
  ui.resultWhite.textContent = String(score.white);
  ui.resultTitle.textContent =
    score.black === score.white
      ? getCopy().draw
      : score.black > score.white
        ? getCopy().blackWins
        : getCopy().whiteWins;
  updateTurn();
}

function beginTurn() {
  if (isGameOver(game.board)) {
    showResult();
    return;
  }

  const moves = getLegalMoves(game.board, game.turn);
  if (moves.length === 0) {
    const currentMatch = matchVersion;
    const passedStone = game.turn;
    game.passed = true;
    updateTurn();
    boardScene.updateLegalMoves([]);
    passTimer = window.setTimeout(() => {
      passTimer = undefined;
      if (game.phase !== "play" || matchVersion !== currentMatch) return;
      game.turn = opposite(passedStone);
      game.passed = false;
      updateTurn();
      beginTurn();
    }, 680);
    return;
  }

  game.passed = false;
  refreshLegalMoves(moves);
  updateTurn();
  if (game.mode === "pve" && game.turn !== BLACK) {
    game.phase = "thinking";
    boardScene.updateLegalMoves([]);
    updateTurn();
    const currentMatch = matchVersion;
    computerMoveTimer = window.setTimeout(() => {
      computerMoveTimer = undefined;
      if (matchVersion === currentMatch) runComputerMove();
    }, 430);
  }
}

function startMatch() {
  cancelPendingTimers();
  matchVersion++;
  game.board = newBoard();
  game.turn = BLACK;
  game.phase = "play";
  game.passed = false;
  setCursor(2, 3);
  boardScene.syncBoard(game.board);
  boardScene.cursor.visible = true;
  setMenuVisible(false);
  updateScore(ui, game.board);
  beginTurn();
  audio.unlock();
}

function openMenu() {
  cancelPendingTimers();
  matchVersion++;
  game.phase = "menu";
  game.board = newBoard();
  game.turn = BLACK;
  game.passed = false;
  boardScene.clearStones();
  boardScene.updateLegalMoves([]);
  boardScene.cursor.visible = false;
  setMenuVisible(true);
  updateScore(ui, game.board);
  updateTurn();
}

function placeStone(row: number, column: number) {
  if (game.phase !== "play") return;
  const flips = getFlips(game.board, row, column, game.turn);
  if (flips.length === 0) return;

  const stone = game.turn;
  const cell = index(row, column);
  game.board[cell] = stone;
  for (const flip of flips) game.board[flip] = stone;
  boardScene.syncBoard(game.board, cell, flips);
  updateScore(ui, game.board);
  audio.unlock();
  audio.play();
  game.phase = "animating";
  game.passed = false;
  game.turn = stone;
  updateTurn();
  const currentMatch = matchVersion;
  const animationDuration = 620 + Math.max(0, flips.length - 1) * 40;
  animationTimer = window.setTimeout(() => {
    animationTimer = undefined;
    if (game.phase !== "animating" || matchVersion !== currentMatch) return;
    audio.play();
    game.turn = opposite(stone);
    game.phase = "play";
    beginTurn();
  }, animationDuration);
}

function runComputerMove() {
  if (game.phase !== "thinking") return;
  const move = chooseMove(game.board, game.turn, game.difficulty);
  if (!move) {
    game.phase = "play";
    beginTurn();
    return;
  }
  setCursor(move.row, move.column);
  game.phase = "play";
  placeStone(move.row, move.column);
}

function moveCursor(rowDelta: number, columnDelta: number) {
  if (game.phase !== "play") return;
  setCursor(game.cursor.row + rowDelta, game.cursor.column + columnDelta);
}

const input = bindInput(boardScene, ui, {
  getPhase: () => game.phase,
  getCursor: () => game.cursor,
  setCursor,
  moveCursor,
  placeStone,
  startMatch,
  openMenu,
  setMode: (mode) => {
    game.mode = mode;
    saveMode(mode);
    setModeSelection(ui, mode);
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
});

function renderFrame(now: number) {
  requestAnimationFrame(renderFrame);
  input.pollGamepad();
  const visible = game.phase === "play" || game.phase === "thinking";
  boardScene.cursor.visible = visible;
  updateSceneMotion(boardScene, now);
  boardScene.renderer.render(boardScene.scene, boardScene.camera);
}

window.addEventListener("resize", boardScene.resize);

detectLocale().then((detectedLocale) => {
  locale = detectedLocale;
  setModeSelection(ui, game.mode);
  setDifficultySelection(game.difficulty);
  applyLocale();
});
setMenuVisible(true);
setModeSelection(ui, game.mode);
setDifficultySelection(game.difficulty);
updateScore(ui, game.board);
boardScene.cursor.visible = false;
requestAnimationFrame(renderFrame);
