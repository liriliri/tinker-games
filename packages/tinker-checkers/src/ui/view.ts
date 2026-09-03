import type { Difficulty } from "../game/ai";
import { DARK, LIGHT, playerToSide } from "../game/rules";
import { humanSide, type GameState, type Mode } from "../game/state";
import { copy, type Copy, type Locale } from "../lib/i18n";
import each from "licia/each";

export type GameUi = {
  menu: HTMLElement;
  result: HTMLElement;
  turnPill: HTMLElement;
  turnStone: HTMLElement;
  turnText: HTMLElement;
  resultTitle: HTMLElement;
  soundButton: HTMLButtonElement;
  menuButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
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
    resultTitle: document.getElementById("resultTitle")!,
    soundButton: document.querySelector<HTMLButtonElement>("#soundButton")!,
    menuButton: document.querySelector<HTMLButtonElement>("#menuButton")!,
    undoButton: document.querySelector<HTMLButtonElement>("#undoButton")!,
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
  each(
    document.querySelectorAll<HTMLButtonElement>("[data-mode]"),
    (button) => {
      button.classList.toggle("selected", button.dataset.mode === mode);
    },
  );
  ui.difficultySetting.classList.toggle("disabled", mode !== "pve");
}

export function setDifficultySelection(difficulty: Difficulty) {
  each(
    document.querySelectorAll<HTMLButtonElement>("[data-difficulty]"),
    (button) =>
      button.classList.toggle(
        "selected",
        button.dataset.difficulty === difficulty,
      ),
  );
}

export function updateTurn(ui: GameUi, state: GameState, strings: Copy) {
  const side = playerToSide(state.draughts.player);
  const thinking = state.phase === "thinking";
  let label: string = side === DARK ? strings.blackTurn : strings.whiteTurn;
  if (state.mode === "pve") {
    label = thinking
      ? strings.cpuThinking
      : side === humanSide
        ? strings.yourMove
        : strings.cpuThinking;
  }
  ui.turnText.textContent = label;
  ui.turnStone.className = `turn-stone ${side === LIGHT ? "white" : "black"}`;
  ui.turnPill.classList.toggle("thinking", thinking);
  ui.undoButton.disabled =
    state.history.length === 0 || state.phase === "thinking";
}

export function applyLocale(
  ui: GameUi,
  state: GameState,
  locale: Locale,
  onTurnUpdate: (strings: Copy) => void,
) {
  const strings = copy[locale];
  document.documentElement.lang = locale;
  each(document.querySelectorAll<HTMLElement>("[data-i18n]"), (element) => {
    const key = element.dataset.i18n as keyof Copy;
    element.textContent = strings[key];
  });
  ui.soundButton.setAttribute(
    "aria-label",
    state.sound ? strings.sound : strings.soundOff,
  );
  ui.soundButton.setAttribute("aria-pressed", String(state.sound));
  ui.soundButton.classList.toggle("muted", !state.sound);
  onTurnUpdate(strings);
}

export function showResult(
  ui: GameUi,
  result: "dark" | "light" | "draw",
  strings: Copy,
) {
  ui.result.classList.remove("hidden");
  ui.resultTitle.textContent =
    result === "dark"
      ? strings.blackWins
      : result === "light"
        ? strings.whiteWins
        : strings.draw;
}
