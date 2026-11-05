import { Ticket } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { usePageMeta } from "@/hooks/usePageMeta";

// SCREEN: implemented in step 3 — saved tickets, automatic check, summary (site-structure.md §2.2).
export default function Tickets() {
  const { t } = useI18n();
  const [game] = useGame();
  usePageMeta("tickets");
  return (
    <>
      <PageHeader title={t("tickets.title", { game: t(`game.${game}.name`) })} />
      <EmptyState
        icon={<Ticket />}
        title={t("tickets.empty.title")}
        body={t("tickets.empty.body")}
        actions={<ButtonLink to="/">{t("tickets.empty.toGenerator")}</ButtonLink>}
      />
    </>
  );
}
