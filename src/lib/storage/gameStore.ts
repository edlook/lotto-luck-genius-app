/** Global game switch (`llg.game`). Kept free of zod so the app shell does not pull the validator in. */
import { isGameId, type GameId } from "../games";
import { createLocalStore } from "./localStore";

export const gameStore = createLocalStore<GameId>(
  "llg.game",
  (raw) => {
    if (!isGameId(raw)) throw new Error("not a game id");
    return raw;
  },
  "ej",
);
