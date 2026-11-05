import { Skeleton, SkeletonGroup } from "@/components/ui";
import { useI18n } from "@/i18n/context";

/** Shown while a lazy screen loads: the shape of a heading and a card, not a spinner. */
export function PageFallback() {
  const { t } = useI18n();
  return (
    <SkeletonGroup label={t("state.loading.aria")} className="gap-5">
      <Skeleton className="h-9 w-3/4 max-w-md" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </SkeletonGroup>
  );
}
