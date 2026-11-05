import { SegmentedControl } from "@/components/ui";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { GAME_IDS, type GameId } from "@/lib/games";

/** Global game switch; the choice is stored in localStorage (llg.game) and shared by all screens. */
export function GameSwitch({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  const { t } = useI18n();
  const [game, setGame] = useGame();
  return (
    <SegmentedControl<GameId>
      label={t("gameSwitch.aria")}
      options={GAME_IDS.map((id) => ({ value: id, label: t(`game.${id}.name`) }))}
      value={game}
      onChange={setGame}
      orientation={orientation}
      block
    />
  );
}
