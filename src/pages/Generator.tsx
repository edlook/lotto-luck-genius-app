import { Ball, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAMES } from "@/lib/games";

// SCREEN: implemented in step 3 — generator + "evaluate your own" tabs (site-structure.md §2.1).
export default function Generator() {
  const { t } = useI18n();
  const [game] = useGame();
  usePageMeta("generator");
  const silhouettes = GAMES[game].mainCount;
  return (
    <>
      <PageHeader title={t("generator.title", { game: t(`game.${game}.name`) })} />
      <EmptyState
        icon={
          <span className="flex gap-1.5">
            {Array.from({ length: Math.min(3, silhouettes) }, (_, i) => (
              <Ball key={i} variant="empty" size="md" />
            ))}
          </span>
        }
        title={t("generator.empty.title")}
        body={t("generator.empty.body")}
      />
    </>
  );
}
