import { COLUMNS, ROWS, index, type Move } from "../game/rules";
import type { Difficulty } from "../game/state";

declare global {
  class Go {
    importObject: WebAssembly.Imports;
    run(instance: WebAssembly.Instance): Promise<void>;
    constructor();
  }

  function engineNewGame(fen?: string): null;
  function engineGetBoard(): string;
  function engineGetLegalMovesFrom(square: number): string;
  function engineDoMoveBySquares(from: number, to: number): boolean;
  function engineUndoMove(): boolean;
  function engineSearch(depth: number, timeMs: number): Promise<string>;
}

const ENGINE_APIS = [
  "engineNewGame",
  "engineGetBoard",
  "engineGetLegalMovesFrom",
  "engineDoMoveBySquares",
  "engineUndoMove",
  "engineSearch",
] as const;

const ENGINE_CONFIG: Record<Difficulty, { depth: number; time: number }> = {
  easy: { depth: 2, time: 1000 },
  normal: { depth: 6, time: 5000 },
  hard: { depth: 8, time: 15000 },
};

let ready: Promise<boolean> | undefined;

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

function hasEngineApis() {
  return ENGINE_APIS.every((name) => typeof globalThis[name] === "function");
}

async function bootEngine() {
  await loadScript(assetUrl("engine/wasm_exec.js"));
  const go = new Go();
  const result = await WebAssembly.instantiateStreaming(
    fetch(assetUrl("engine/godogpaw.wasm")),
    go.importObject,
  );
  go.run(result.instance).catch((error) => {
    console.error("godogpaw runtime error:", error);
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!hasEngineApis()) {
    throw new Error("godogpaw engine APIs missing after startup");
  }
  engineNewGame("");
  return true;
}

export function initGodogpawEngine() {
  if (!ready) {
    ready = bootEngine().catch((error) => {
      ready = undefined;
      console.warn("godogpaw engine unavailable:", error);
      return false;
    });
  }
  return ready;
}

async function ensureReady() {
  const ok = await initGodogpawEngine();
  if (!ok || !hasEngineApis()) {
    throw new Error("godogpaw engine is not ready");
  }
}

function toEngineSquare(cell: number) {
  const row = Math.floor(cell / COLUMNS);
  const column = cell % COLUMNS;
  return (ROWS - 1 - row) * COLUMNS + column;
}

function uciToCell(uci: string) {
  const column = uci.charCodeAt(0) - "a".charCodeAt(0);
  const rank = uci.charCodeAt(1) - "0".charCodeAt(0);
  return index(ROWS - 1 - rank, column);
}

export function syncEngine(history: Move[]) {
  engineNewGame("");
  for (const move of history) {
    if (
      !engineDoMoveBySquares(toEngineSquare(move.from), toEngineSquare(move.to))
    ) {
      throw new Error(`Failed to replay move ${move.from}->${move.to}`);
    }
  }
}

export async function chooseEngineMove(
  board: Int8Array,
  history: Move[],
  difficulty: Difficulty,
): Promise<Move | null> {
  await ensureReady();
  syncEngine(history);
  const { depth, time } = ENGINE_CONFIG[difficulty];
  const moveStr = await engineSearch(depth, time);
  if (!moveStr) return null;
  const from = uciToCell(moveStr.slice(0, 2));
  const to = uciToCell(moveStr.slice(2, 4));
  return {
    from,
    to,
    piece: board[from],
    captured: board[to],
  };
}
