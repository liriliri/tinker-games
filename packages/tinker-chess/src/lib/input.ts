import type { Difficulty } from "../game/ai";
import type { ChessScene } from "./scene";
import type { GameUi } from "../ui/view";
import type { Mode, Phase } from "../game/state";

const DIRECTIONS: Record<string, [number, number]> = {
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
  getCursor: () => number;
  setCursor: (cell: number) => void;
  moveCursor: (rowDelta: number, columnDelta: number) => void;
  selectCell: (cell: number) => void;
  startMatch: () => void;
  openMenu: () => void;
  undo: () => void;
  setMode: (mode: Mode) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  toggleSound: () => void;
  unlockAudio: () => void;
  requestRender: () => void;
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
    const direction = DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      actions.moveCursor(direction[0], direction[1]);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      actions.selectCell(actions.getCursor());
    }
  });

  let pointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let dragged = false;
  let dragMode: "rotate" | "pan" | null = null;
  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    const cell = scene.pickCell(event.clientX, event.clientY);
    if (
      !dragged &&
      event.button === 0 &&
      cell &&
      actions.getPhase() === "play"
    ) {
      actions.setCursor(cell.row * 8 + cell.column);
      actions.selectCell(cell.row * 8 + cell.column);
    }
    pointerId = null;
    dragMode = null;
    dragged = false;
    scene.renderer.domElement.style.cursor = "grab";
    try {
      scene.renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // The browser can release capture before pointerup.
    }
  };

  scene.renderer.domElement.addEventListener("pointerdown", (event) => {
    actions.unlockAudio();
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    dragged = false;
    dragMode = event.button === 2 ? "pan" : "rotate";
    scene.renderer.domElement.style.cursor = "grabbing";
    scene.renderer.domElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  scene.renderer.domElement.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId || !dragMode) return;
    const deltaX = event.clientX - lastX;
    const deltaY = event.clientY - lastY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) dragged = true;
    if (dragMode === "pan") scene.pan(deltaX, deltaY);
    else scene.orbit(deltaX, deltaY);
    actions.requestRender();
    lastX = event.clientX;
    lastY = event.clientY;
    event.preventDefault();
  });
  scene.renderer.domElement.addEventListener("pointerup", endDrag);
  scene.renderer.domElement.addEventListener("pointercancel", endDrag);
  scene.renderer.domElement.addEventListener("contextmenu", (event) =>
    event.preventDefault(),
  );
}
