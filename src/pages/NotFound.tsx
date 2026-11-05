import { Compass } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { useI18n } from "@/i18n/context";
import { usePageMeta } from "@/hooks/usePageMeta";

export default function NotFound() {
  const { t } = useI18n();
  usePageMeta("notFound");
  return (
    <>
      <PageHeader title={t("notFound.title")} />
      <EmptyState
        icon={<Compass />}
        title={t("notFound.body")}
        actions={<ButtonLink to="/">{t("notFound.cta")}</ButtonLink>}
      />
    </>
  );
}
