import {
  EnglishDraughtsComputerFactory,
  type EnglishDraughtsGame,
} from "rapid-draughts/english";
import random from "licia/random";
import randomItem from "licia/randomItem";
import type { Move } from "./rules";

export type Difficulty = "easy" | "normal" | "hard";

const DEPTH: Record<Difficulty, number> = {
  easy: 2,
  normal: 4,
  hard: 6,
};

export async function chooseMove(
  game: EnglishDraughtsGame,
  difficulty: Difficulty,
): Promise<Move | null> {
  if (game.moves.length === 0) return null;
  if (difficulty === "easy" && random(0, 1, true) < 0.35) {
    return randomItem(game.moves) ?? null;
  }
  const computer = EnglishDraughtsComputerFactory.alphaBeta({
    maxDepth: DEPTH[difficulty],
    quiescence: difficulty !== "easy",
  });
  try {
    return await computer(game);
  } catch {
    return game.moves[0] ?? null;
  }
}
