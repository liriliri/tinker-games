import {
  EnglishDraughtsComputerFactory,
  type EnglishDraughtsGame,
} from "rapid-draughts/english";
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
  if (difficulty === "easy" && Math.random() < 0.35) {
    return game.moves[Math.floor(Math.random() * game.moves.length)] ?? null;
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
