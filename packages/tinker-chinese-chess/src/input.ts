import throttle from "licia/throttle";
import type { Difficulty } from "./game/ai";
import type { ChessScene } from "./scene";
import type { GameUi } from "./ui/view";
import type { Mode, Phase } from "./game/state";

type Cursor = { row: number; column: number };

const KEY_DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  w: [-1, 0],
  ArrowDown: [1, 0],
  s: [1, 0],
  ArrowLeft: [0, -1],
  a: [0, -1],
  ArrowRight: [0, 1],
  d: [0, 1],
};

type InputActions = {
  getPhase: () => Phase;
  getCursor: () => Cursor;
  setCursor: (row: number, column: number) => void;
  moveCursor: (rowDelta: number, columnDelta: number) => void;
  selectCell: (row: number, column: number) => void;
  startMatch: () => void;
  openMenu: () => void;
  undo: () => void;
  setMode: (mode: Mode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  toggleSound: () => void;
  unlockAudio: () => void;
};

export function bindInput(
  scene: ChessScene,
  ui: GameUi,
  actions: InputActions,
) {
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        actions.setMode(button.dataset.mode as Mode),
      );
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-difficulty]")
    .forEach((button) => {
      button.addEventListener("click", () =>
        actions.setDifficulty(button.dataset.difficulty as Difficulty),
      );
    });

  ui.startButton.addEventListener("click", actions.startMatch);
  ui.againButton.addEventListener("click", actions.startMatch);
  ui.menuButton.addEventListener("click", actions.openMenu);
  ui.resultMenuButton.addEventListener("click", actions.openMenu);
  ui.undoButton.addEventListener("click", actions.undo);
  ui.soundButton.addEventListener("click", actions.toggleSound);

  document
    .querySelectorAll<HTMLButtonElement>("[data-direction]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const direction = button.dataset.direction;
        if (direction === "up") actions.moveCursor(-1, 0);
        if (direction === "down") actions.moveCursor(1, 0);
        if (direction === "left") actions.moveCursor(0, -1);
        if (direction === "right") actions.moveCursor(0, 1);
      });
    });
  document
    .querySelector<HTMLButtonElement>('[data-action="place"]')!
    .addEventListener("click", () => {
      const cursor = actions.getCursor();
      actions.selectCell(cursor.row, cursor.column);
    });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (actions.getPhase() !== "menu") actions.openMenu();
      return;
    }
    if (event.key.toLowerCase() === "r" && actions.getPhase() !== "menu") {
      actions.startMatch();
      return;
    }
    if (event.key.toLowerCase() === "u") {
      actions.undo();
      return;
    }
    if (actions.getPhase() !== "play") return;
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      actions.moveCursor(direction[0], direction[1]);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const cursor = actions.getCursor();
      actions.selectCell(cursor.row, cursor.column);
    }
  });

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragMode: "rotate" | "pan" | null = null;
  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    dragMode = null;
    scene.renderer.domElement.style.cursor = "grab";
    try {
      scene.renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // The browser can release capture before pointerup.
    }
  };

  scene.renderer.domElement.addEventListener("pointerdown", (event) => {
    actions.unlockAudio();
    const cell = scene.pickCell(event.clientX, event.clientY);
    if (event.button === 0 && cell && actions.getPhase() === "play") {
      actions.setCursor(cell.row, cell.column);
      actions.selectCell(cell.row, cell.column);
      return;
    }
    if (event.button === 0 || event.button === 2) {
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      dragMode = event.button === 2 ? "pan" : "rotate";
      scene.renderer.domElement.style.cursor = "grabbing";
      scene.renderer.domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
  scene.renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.pointerId === pointerId) {
      const deltaX = event.clientX - lastX;
      const deltaY = event.clientY - lastY;
      if (dragMode === "pan") scene.pan(deltaX, deltaY);
      else scene.orbit(deltaX, deltaY);
      lastX = event.clientX;
      lastY = event.clientY;
      event.preventDefault();
      return;
    }
    if (actions.getPhase() !== "play") return;
    const cell = scene.pickCell(event.clientX, event.clientY);
    if (cell) {
      actions.setCursor(cell.row, cell.column);
      scene.cursor.visible = true;
    }
  });
  scene.renderer.domElement.addEventListener("pointerup", endDrag);
  scene.renderer.domElement.addEventListener("pointercancel", endDrag);
  scene.renderer.domElement.addEventListener("contextmenu", (event) =>
    event.preventDefault(),
  );

  let lastGamepadMove = 0;
  let lastGamepadAction = false;
  const pollGamepad = throttle((now: number) => {
    const pad = navigator.getGamepads?.()[0];
    if (!pad || actions.getPhase() !== "play") return;
    const threshold = 0.55;
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const direction: [number, number] | null =
      Math.abs(x) > Math.abs(y)
        ? x > threshold
          ? [0, 1]
          : x < -threshold
            ? [0, -1]
            : null
        : y > threshold
          ? [1, 0]
          : y < -threshold
            ? [-1, 0]
            : null;
    if (direction && now - lastGamepadMove > 180) {
      actions.moveCursor(direction[0], direction[1]);
      lastGamepadMove = now;
    }
    const action = Boolean(pad.buttons[0]?.pressed);
    if (action && !lastGamepadAction) {
      const cursor = actions.getCursor();
      actions.selectCell(cursor.row, cursor.column);
    }
    lastGamepadAction = action;
  }, 100);
  return { pollGamepad };
}
