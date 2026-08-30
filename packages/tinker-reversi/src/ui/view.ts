import { BLACK, countStones } from "../game/rules";
import type { Difficulty } from "../game/ai";
import type { GameState, Mode } from "../game/state";
import { copy, type Copy, type Locale } from "./i18n";

export type GameUi = {
  menu: HTMLElement;
  result: HTMLElement;
  turnPill: HTMLElement;
  turnStone: HTMLElement;
  turnText: HTMLElement;
  blackScore: HTMLElement;
  whiteScore: HTMLElement;
  resultTitle: HTMLElement;
  resultBlack: HTMLElement;
  resultWhite: HTMLElement;
  soundButton: HTMLButtonElement;
  menuButton: HTMLButtonElement;
  difficultySetting: HTMLElement;
  startButton: HTMLButtonElement;
  againButton: HTMLButtonElement;
  resultMenuButton: HTMLButtonElement;
};

export function getGameUi(): GameUi {
  return {
    menu: document.getElementById("menu")!,
    result: document.getElementById("result")!,
    turnPill: document.getElementById("turnPill")!,
    turnStone: document.getElementById("turnStone")!,
    turnText: document.getElementById("turnText")!,
    blackScore: document.getElementById("blackScore")!,
    whiteScore: document.getElementById("whiteScore")!,
    resultTitle: document.getElementById("resultTitle")!,
    resultBlack: document.getElementById("resultBlack")!,
    resultWhite: document.getElementById("resultWhite")!,
    soundButton: document.querySelector<HTMLButtonElement>("#soundButton")!,
    menuButton: document.querySelector<HTMLButtonElement>("#menuButton")!,
    difficultySetting: document.getElementById("difficultySetting")!,
    startButton: document.querySelector<HTMLButtonElement>("#startButton")!,
    againButton: document.querySelector<HTMLButtonElement>("#againButton")!,
    resultMenuButton:
      document.querySelector<HTMLButtonElement>("#resultMenuButton")!,
  };
}

export function setMenuVisible(ui: GameUi, visible: boolean) {
  ui.menu.classList.toggle("hidden", !visible);
  ui.result.classList.add("hidden");
}

export function setModeSelection(ui: GameUi, mode: Mode) {
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.classList.toggle("selected", button.dataset.mode === mode);
    });
  ui.difficultySetting.classList.toggle("disabled", mode !== "pve");
}

export function setDifficultySelection(difficulty: Difficulty) {
  document
    .querySelectorAll<HTMLButtonElement>("[data-difficulty]")
    .forEach((button) => {
      button.classList.toggle(
        "selected",
        button.dataset.difficulty === difficulty,
      );
    });
}

export function updateScore(ui: GameUi, board: Uint8Array) {
  const score = countStones(board);
  ui.blackScore.textContent = String(score.black);
  ui.whiteScore.textContent = String(score.white);
}

export function updateTurn(ui: GameUi, state: GameState, strings: Copy) {
  const thinking = state.phase === "thinking";
  let label: string = state.turn === BLACK ? strings.black : strings.white;
  if (state.phase === "animating") {
    label = strings.pieceSettling;
  } else if (state.mode === "pve") {
    label = thinking
      ? strings.cpuThinking
      : state.turn === BLACK
        ? strings.yourMove
        : strings.cpuThinking;
  }
  if (state.passed && state.phase === "play") label = strings.pass;
  ui.turnText.textContent = label;
  ui.turnStone.className = `turn-stone ${
    state.turn === BLACK ? "black" : "white"
  }`;
  ui.turnPill.classList.toggle("thinking", thinking);
}

export function applyLocale(
  ui: GameUi,
  state: GameState,
  locale: Locale,
  onTurnUpdate: (strings: Copy) => void,
) {
  const strings = copy[locale];
  document.documentElement.lang = locale;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n as keyof Copy;
    if (strings[key]) element.textContent = strings[key];
  });
  ui.soundButton.setAttribute(
    "aria-label",
    state.sound ? strings.sound : strings.soundOff,
  );
  ui.soundButton.setAttribute("aria-pressed", String(state.sound));
  ui.soundButton.classList.toggle("muted", !state.sound);
  ui.menuButton.textContent = strings.menu;
  onTurnUpdate(strings);
}
