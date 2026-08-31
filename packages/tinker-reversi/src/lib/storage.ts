import LocalStore from "licia/LocalStore";
import type { Difficulty } from "../game/ai";
import type { Mode } from "../game/state";

const store = new LocalStore("tinker-reversi");

function isMode(value: unknown): value is Mode {
  return value === "pvp" || value === "pve";
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

export function loadMode(): Mode {
  const mode = store.get<unknown>("mode");
  return isMode(mode) ? mode : "pvp";
}

export function saveMode(mode: Mode) {
  store.set("mode", mode);
}

export function loadDifficulty(): Difficulty {
  const difficulty = store.get<unknown>("difficulty");
  return isDifficulty(difficulty) ? difficulty : "normal";
}

export function saveDifficulty(difficulty: Difficulty) {
  store.set("difficulty", difficulty);
}
