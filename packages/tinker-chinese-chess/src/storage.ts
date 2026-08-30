import LocalStore from "licia/LocalStore";
import type { Difficulty } from "./game/ai";
import type { Mode } from "./game/state";

const store = new LocalStore("tinker-chinese-chess");

function isMode(value: unknown): value is Mode {
  return value === "pvp" || value === "pve";
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "normal" || value === "hard";
}

export function loadMode(): Mode {
  const value = store.get<unknown>("mode");
  return isMode(value) ? value : "pvp";
}

export function saveMode(value: Mode) {
  store.set("mode", value);
}

export function loadDifficulty(): Difficulty {
  const value = store.get<unknown>("difficulty");
  return isDifficulty(value) ? value : "normal";
}

export function saveDifficulty(value: Difficulty) {
  store.set("difficulty", value);
}
