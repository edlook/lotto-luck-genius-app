import { useCallback } from "react";
import { gameStore } from "@/lib/storage/gameStore";
import { useLocalStore } from "@/lib/storage/localStore";
import type { GameId } from "@/lib/games";

/** Global game switch, remembered in localStorage (`llg.game`). */
export function useGame(): [GameId, (g: GameId) => void] {
  const game = useLocalStore(gameStore);
  const set = useCallback((g: GameId) => void gameStore.set(g), []);
  return [game, set];
}
