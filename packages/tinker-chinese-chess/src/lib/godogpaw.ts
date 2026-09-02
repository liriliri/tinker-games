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

const ENGINE_WAIT_MS = 15_000;

let bootPromise: Promise<void> | undefined;

function assetUrl(relativePath: string) {
  return new URL(relativePath.replace(/^\//, ""), document.baseURI).href;
}

function missingEngineApis() {
  return ENGINE_APIS.filter((name) => typeof globalThis[name] !== "function");
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    if (existing) {
      if (typeof globalThis.Go === "function") {
        resolve();
        return;
      }
      existing.remove();
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(script);
  });
}

async function waitForEngineApis(deadline = Date.now() + ENGINE_WAIT_MS) {
  while (Date.now() < deadline) {
    const missing = missingEngineApis();
    if (missing.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  const missing = missingEngineApis();
  throw new Error(
    missing.length
      ? `godogpaw engine APIs missing: ${missing.join(", ")}`
      : "godogpaw engine APIs missing",
  );
}

async function instantiateWasm(url: string, importObject: WebAssembly.Imports) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/wasm")) {
    return WebAssembly.instantiateStreaming(
      Promise.resolve(response),
      importObject,
    );
  }
  const bytes = await response.arrayBuffer();
  return WebAssembly.instantiate(bytes, importObject);
}

async function bootEngine() {
  const wasmExecUrl = assetUrl("engine/wasm_exec.js");
  const wasmUrl = assetUrl("engine/godogpaw.wasm");
  await loadScript(wasmExecUrl);
  if (typeof globalThis.Go !== "function") {
    throw new Error("Go runtime missing after loading wasm_exec.js");
  }
  const go = new Go();
  let runtimeError: unknown;
  const result = await instantiateWasm(wasmUrl, go.importObject);
  go.run(result.instance).catch((error) => {
    runtimeError = error;
    console.error("godogpaw runtime error:", error);
  });
  await waitForEngineApis();
  if (runtimeError) throw runtimeError;
  engineNewGame("");
}

export function initGodogpawEngine() {
  if (!bootPromise) {
    bootPromise = bootEngine().catch((error) => {
      bootPromise = undefined;
      throw error;
    });
  }
  return bootPromise;
}

async function ensureReady() {
  await initGodogpawEngine();
  const missing = missingEngineApis();
  if (missing.length) {
    throw new Error(`godogpaw engine is not ready: ${missing.join(", ")}`);
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
