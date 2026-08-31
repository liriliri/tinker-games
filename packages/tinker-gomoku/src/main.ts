import "./ui/style.css";
import clamp from "licia/clamp";
import { AudioKit } from "./lib/audio";
import { chooseMove } from "./game/ai";
import {
  BOARD_SIZE,
  BLACK,
  EMPTY,
  WHITE,
  isFull,
  newBoard,
  opposite,
  index,
  winningLine,
  type Stone,
} from "./game/rules";
import { createGameState } from "./game/state";
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
  setMenuVisible as setMenuVisibleView,
  setModeSelection,
  updateTurn as updateTurnView,
} from "./ui/view";

const boardScene = createScene();
const audio = new AudioKit();
const ui = getGameUi();
const game = createGameState(loadMode(), loadDifficulty());
let locale: Locale = "en";
const getCopy = () => copy[locale];
let computerMoveTimer: number | undefined;
let resultTimer: number | undefined;
let matchVersion = 0;

function cancelPendingTimers() {
  if (computerMoveTimer !== undefined) {
    window.clearTimeout(computerMoveTimer);
    computerMoveTimer = undefined;
  }
  if (resultTimer !== undefined) {
    window.clearTimeout(resultTimer);
    resultTimer = undefined;
  }
}

const applyLocale = () =>
  applyLocaleView(ui, game, locale, (strings) =>
    updateTurnView(ui, game, strings),
  );
const updateTurn = () => updateTurnView(ui, game, getCopy());
const setMenuVisible = (visible: boolean) => setMenuVisibleView(ui, visible);

function setCursor(row: number, column: number) {
  game.cursor.row = clamp(row, 0, BOARD_SIZE - 1);
  game.cursor.column = clamp(column, 0, BOARD_SIZE - 1);
  const point = cellToWorld(game.cursor.row, game.cursor.column);
  boardScene.cursor.position.x = point.x;
  boardScene.cursor.position.z = point.z;
}

function startMatch() {
  cancelPendingTimers();
  matchVersion++;
  game.board = newBoard();
  game.turn = BLACK;
  game.phase = "play";
  setCursor(7, 7);
  boardScene.clearStones();
  setMenuVisible(false);
  updateTurn();
  audio.unlock();
}

function openMenu() {
  cancelPendingTimers();
  matchVersion++;
  game.phase = "menu";
  game.board = newBoard();
  boardScene.clearStones();
  setMenuVisible(true);
  updateTurn();
}

function showResult(winner: Stone | 0) {
  const strings = getCopy();
  game.phase = "over";
  boardScene.cursor.visible = false;
  ui.result.classList.remove("hidden");

  if (winner === 0) {
    ui.resultText.hidden = false;
    ui.resultTitle.textContent = strings.draw;
    ui.resultText.textContent = strings.full;
  } else {
    ui.resultText.hidden = true;
    ui.resultTitle.textContent =
      winner === BLACK ? strings.blackWins : strings.whiteWins;
  }
  updateTurn();
}

function placeStone(row: number, column: number) {
  if (game.phase !== "play" || game.board[index(row, column)] !== EMPTY) return;
  const stone = game.turn;
  game.board[index(row, column)] = stone;
  boardScene.addStone(stone, row, column, true);
  const point = cellToWorld(row, column);
  boardScene.lastMark.position.set(
    point.x,
    boardScene.cursor.position.y + 0.04,
    point.z,
  );
  boardScene.lastMark.visible = true;
  audio.unlock();
  audio.play();

  const line = winningLine(game.board, row, column);
  if (line) {
    boardScene.updateWinLine(line);
    game.phase = "over";
    const currentMatch = matchVersion;
    resultTimer = window.setTimeout(() => {
      resultTimer = undefined;
      if (game.phase === "over" && matchVersion === currentMatch) {
        showResult(stone);
      }
    }, 2000);
    return;
  }
  if (isFull(game.board)) {
    showResult(0);
    return;
  }

  game.turn = opposite(stone);
  if (game.mode === "pve" && game.turn !== BLACK) {
    game.phase = "thinking";
    const currentMatch = matchVersion;
    computerMoveTimer = window.setTimeout(() => {
      computerMoveTimer = undefined;
      if (matchVersion === currentMatch) runComputerMove();
    }, 380);
  }
  updateTurn();
}

function runComputerMove() {
  if (game.phase !== "thinking") return;
  const move = chooseMove(game.board, WHITE, game.difficulty);
  if (!move) {
    showResult(0);
    return;
  }
  setCursor(move.row, move.column);
  game.phase = "play";
  placeStone(move.row, move.column);
}

function moveCursor(rowDelta: number, columnDelta: number) {
  if (game.phase !== "play" && game.phase !== "thinking") return;
  setCursor(game.cursor.row + rowDelta, game.cursor.column + columnDelta);
}

const input = bindInput(boardScene, ui, {
  getPhase: () => game.phase,
  getCursor: () => game.cursor,
  setCursor,
  moveCursor,
  placeStone: (row, column) => placeStone(row, column),
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
  applyLocale();
});
setMenuVisible(true);
setModeSelection(ui, game.mode);
setDifficultySelection(game.difficulty);
boardScene.cursor.visible = false;
requestAnimationFrame(renderFrame);
