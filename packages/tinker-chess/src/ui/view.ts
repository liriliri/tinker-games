import {
  BLACK,
  isInCheck,
  PIECE_GLYPHS,
  type Move,
  WHITE,
} from "../game/rules";
import type { GameState, Mode } from "../game/state";
import type { Difficulty } from "../game/ai";
import { copy, type Copy, type Locale } from "../lib/i18n";

export type GameUi = {
  menu: HTMLElement;
  result: HTMLElement;
  promotion: HTMLElement;
  promotionChoices: HTMLElement;
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
    promotion: document.getElementById("promotion")!,
    promotionChoices: document.getElementById("promotionChoices")!,
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
  ui.promotion.classList.add("hidden");
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
    .forEach((button) =>
      button.classList.toggle(
        "selected",
        button.dataset.difficulty === difficulty,
      ),
    );
}

export function updateTurn(ui: GameUi, state: GameState, strings: Copy) {
  const { position } = state;
  const thinking = state.phase === "thinking";
  const inCheck =
    (state.phase === "play" || thinking) && isInCheck(position, position.turn);
  let label: string =
    position.turn === WHITE ? strings.whiteTurn : strings.blackTurn;
  if (state.mode === "pve") {
    label = thinking
      ? strings.cpuThinking
      : position.turn === WHITE
        ? strings.yourMove
        : strings.cpuThinking;
  }
  if (inCheck && !thinking) label = strings.check;
  ui.turnText.textContent = label;
  ui.turnStone.className = `turn-stone ${position.turn === WHITE ? "white" : "black"}`;
  ui.turnPill.classList.toggle("thinking", thinking);
  ui.turnPill.classList.toggle("check", inCheck);
  ui.undoButton.disabled =
    state.history.length === 0 || state.phase === "thinking";
}

export function showPromotion(
  ui: GameUi,
  moves: Move[],
  side: typeof WHITE | typeof BLACK,
  strings: Copy,
  onChoose: (move: Move) => void,
) {
  ui.promotionChoices.replaceChildren();
  for (const move of moves) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "promotion-choice";
    button.textContent =
      PIECE_GLYPHS[move.promotion!][side === WHITE ? "white" : "black"];
    button.setAttribute("aria-label", `${strings.promote} ${move.promotion}`);
    button.addEventListener("click", () => {
      ui.promotion.classList.add("hidden");
      onChoose(move);
    });
    ui.promotionChoices.append(button);
  }
  ui.promotion.classList.remove("hidden");
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
  result: "white" | "black" | "draw",
  strings: Copy,
) {
  ui.result.classList.remove("hidden");
  ui.resultTitle.textContent =
    result === "white"
      ? strings.whiteWins
      : result === "black"
        ? strings.blackWins
        : strings.draw;
}
