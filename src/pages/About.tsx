import { useRef, type ReactNode } from "react";
import { Card, Section, Skeleton, SkeletonGroup } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { completenessText } from "@/components/common/completenessText";
import { useI18n } from "@/i18n/context";
import { useDraws } from "@/hooks/useDraws";
import { useInView } from "@/hooks/useInView";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAME_IDS, type GameId } from "@/lib/games";
import { APP_VERSION } from "@/lib/version";

/** Renders `code` spans of the copy deck as <code> instead of showing the backticks. */
function Inline({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.9em] break-all">
            {p}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}

function P({ k }: { k: string }) {
  const { t } = useI18n();
  return (
    <p className="max-w-prose text-body text-muted-foreground">
      <Inline text={t(k)} />
    </p>
  );
}

const SECTIONS = [
  { id: "principles", title: "about.principles.title" },
  { id: "generator", title: "about.generator.title" },
  { id: "odds", title: "about.odds.title" },
  { id: "stats", title: "about.stats.title" },
  { id: "data", title: "about.data.title" },
  { id: "limits", title: "about.limits.title" },
] as const;

function GameStatus({ game, enabled }: { game: GameId; enabled: boolean }) {
  const i18n = useI18n();
  const { t, tp, date, num } = i18n;
  const data = useDraws(game, enabled);
  const name = t(`game.${game}.name`);
  if (data.isLoading) {
    return (
      <SkeletonGroup label={t("state.loading.aria")}>
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-40" />
      </SkeletonGroup>
    );
  }
  if (!data.draws.length) {
    return (
      <p className="text-body text-muted-foreground">
        {data.isError ? t("about.data.live.error") : `${name}: ${t("sidebar.dataStatus.none")}`}
      </p>
    );
  }
  const v = data.meta?.verification;
  return (
    <div className="flex flex-col gap-1 text-body">
      <p className="font-semibold">
        {t("about.data.live.period", {
          game: name,
          first: date(data.draws[0]!.date),
          last: date(data.lastDate!),
        })}
      </p>
      <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
        <li>{tp("about.data.live.count", data.draws.length)}</li>
        <li>
          {t("about.data.live.completeness", {
            result: completenessText(data.completeness, i18n, true),
          })}
          {data.completeness
            ? ` (${t("about.data.live.checkedFrom", { date: date(data.completeness.checkedFrom) })})`
            : ""}
        </li>
        {data.meta ? (
          <li>
            {t("about.data.live.lastImport", {
              date: date(data.meta.fetchedAt.slice(0, 10)),
            })}
          </li>
        ) : null}
        {v ? (
          <li>
            {t("about.data.verified", {
              n: num(v.sampleSize),
              date: date(v.checkedAt.slice(0, 10)),
              mismatches: num(v.mismatches),
            })}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Section id={id} title={title} className="scroll-mt-40 lg:scroll-mt-8">
      <div className="flex flex-col gap-3">{children}</div>
    </Section>
  );
}

export default function About() {
  const { t } = useI18n();
  usePageMeta("about");
  const liveRef = useRef<HTMLDivElement>(null);
  // The live data status needs both archives; load them only when that block is near.
  const live = useInView(liveRef);

  return (
    <>
      <PageHeader title={t("about.title")} description={t("about.intro")} />
      <nav aria-labelledby="about-toc" className="mb-8">
        <h2 id="about-toc" className="mb-2 text-caption font-semibold text-muted-foreground">
          {t("about.toc")}
        </h2>
        <ul className="flex flex-col">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-11 items-center font-semibold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
              >
                {t(s.title)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-10">
        <Block id="principles" title={t("about.principles.title")}>
          {["p1", "p2", "p3", "p4"].map((p) => (
            <P key={p} k={`about.principles.${p}`} />
          ))}
        </Block>

        <Block id="generator" title={t("about.generator.title")}>
          {["rng", "rejection", "rules", "sources", "caveat", "euro"].map((p) => (
            <P key={p} k={`about.generator.${p}`} />
          ))}
        </Block>

        <Block id="odds" title={t("about.odds.title")}>
          {["ej", "649", "check", "ev", "evCaveat"].map((p) => (
            <P key={p} k={`about.odds.${p}`} />
          ))}
        </Block>

        <Block id="stats" title={t("about.stats.title")}>
          {["expected", "statistic", "montecarlo", "eras", "notForecast"].map((p) => (
            <P key={p} k={`about.stats.${p}`} />
          ))}
        </Block>

        <Block id="data" title={t("about.data.title")}>
          {["649", "ej", "manual"].map((p) => (
            <P key={p} k={`about.data.${p}`} />
          ))}
          <div ref={liveRef}>
            <Card as="section" aria-labelledby="about-live" className="flex flex-col gap-4">
              <h3 id="about-live" className="text-body font-bold">
                {t("about.data.live.title")}
              </h3>
              {GAME_IDS.map((g) => (
                <GameStatus key={g} game={g} enabled={live} />
              ))}
            </Card>
          </div>
          <h3 className="pt-2 text-body font-bold">{t("about.data.privacy.title")}</h3>
          {["p1", "p2", "p3"].map((p) => (
            <P key={p} k={`about.data.privacy.${p}`} />
          ))}
        </Block>

        <Block id="limits" title={t("about.limits.title")}>
          <ul className="flex max-w-prose list-disc flex-col gap-2 pl-5 text-body text-muted-foreground">
            {["i1", "i2", "i3", "i4", "i5", "i6"].map((i) => (
              <li key={i}>{t(`about.limits.${i}`)}</li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">{t("about.version.app", { version: APP_VERSION })}</p>
        </Block>
      </div>
    </>
  );
}
