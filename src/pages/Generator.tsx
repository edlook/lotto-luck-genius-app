import { useId, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Copy, Dices, Eraser, RefreshCw, SearchCheck } from "lucide-react";
import { Ball, BallRow, Button, Card, EmptyState, Field, NumberInput, SegmentedControl, Tabs, toast } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { HonestyNote } from "@/components/common/HonestyNote";
import { Disclosure } from "@/components/common/Disclosure";
import { NumberPicker } from "@/components/common/NumberPicker";
import { PopularityBadge, PopularityRules } from "@/components/common/PopularityReport";
import { focusLater } from "@/components/common/focus";
import { SaveTicketPanel } from "@/components/tickets/SaveTicketPanel";
import { useI18n } from "@/i18n/context";
import { useGame } from "@/hooks/useGame";
import { useDraws } from "@/hooks/useDraws";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePageMeta } from "@/hooks/usePageMeta";
import { GAMES, type GameId } from "@/lib/games";
import { fieldToText, generateField, generateFields, GenerationError, type GeneratorMode } from "@/lib/generator";
import { evaluatePopularity, type PastWinningIndex } from "@/lib/popularity";
import { generatorSession, type Generated } from "./generatorSession";

const MAX_FIELDS = 12;

async function copyText(text: string, ok: string, fail: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error(fail);
  }
}

function GenerateTab({ game, pastWinning }: { game: GameId; pastWinning: PastWinningIndex | null }) {
  const { t, tp, locale } = useI18n();
  const [mode, setMode] = useState<GeneratorMode>(generatorSession.mode);
  const [count, setCount] = useState<number | null>(generatorSession.count);
  const [results, setResults] = useState(generatorSession.results);
  const resultsRef = useRef<HTMLDivElement>(null);
  const modeId = useId();
  const big = useMediaQuery("(min-width: 40rem)");
  const cfg = GAMES[game];
  const current = results.get(game) ?? null;

  // Reports are recomputed when the draw archive arrives, so "past winning" is never stale.
  const reports = useMemo(
    () => current?.fields.map((f) => evaluatePopularity(game, f.main, { pastWinning })) ?? [],
    [current, game, pastWinning],
  );

  const store = (fields: Generated["fields"]) => setResults(generatorSession.save(game, fields));

  const generate = () => {
    const n = Math.min(MAX_FIELDS, Math.max(1, count ?? 1));
    try {
      const fields = generateFields(game, n, { mode, pastWinning }).map(({ main, euro }) => (euro ? { main, euro } : { main }));
      store(fields);
      // Bring the result into view without taking focus away from the button ("generate again").
      window.requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({
          block: "nearest",
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        }),
      );
    } catch (e) {
      if (e instanceof GenerationError) toast.error(t("generator.toast.failed"));
      else throw e;
    }
  };

  const replace = (i: number) => {
    if (!current) return;
    try {
      const f = generateField(game, { mode, pastWinning });
      const fields = current.fields.map((old, j) => (j === i ? (f.euro ? { main: f.main, euro: f.euro } : { main: f.main }) : old));
      store(fields);
      toast(t("generator.toast.replaced", { n: i + 1 }));
    } catch (e) {
      if (e instanceof GenerationError) toast.error(t("generator.toast.failed"));
      else throw e;
    }
  };

  const euroLabel = t("ball.label.euro");

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex flex-col gap-2">
            <p id={modeId} className="text-body font-semibold">
              {t("generator.mode.label")}
            </p>
            <SegmentedControl<GeneratorMode>
              labelledBy={modeId}
              options={[
                { value: "rare", label: t("generator.mode.rare") },
                { value: "random", label: t("generator.mode.random") },
              ]}
              value={mode}
              onChange={(m) => {
                generatorSession.setMode(m);
                setMode(m);
              }}
              block
              className="[&>button]:py-1.5 [&>button]:leading-5 [&>button]:whitespace-normal"
            />
            <p className="text-caption text-muted-foreground">{t(`generator.mode.${mode}.hint`)}</p>
          </div>
          <Field
            label={t("generator.fields.label")}
            help={count ? tp("generator.fields.value", count) : undefined}
            className="sm:w-52"
          >
            <NumberInput
              value={count}
              onChange={(v) => {
                generatorSession.setCount(v ?? 1);
                setCount(v);
              }}
              min={1}
              max={MAX_FIELDS}
              decrementLabel={t("generator.fields.decrease")}
              incrementLabel={t("generator.fields.increase")}
              locale={locale}
            />
          </Field>
        </div>
        <Button size="lg" block icon={current ? <RefreshCw /> : <Dices />} onClick={generate}>
          {t(current ? "generator.cta.again" : "generator.cta")}
        </Button>
      </Card>

      <HonestyNote>{t("honesty.chance")}</HonestyNote>

      <div ref={resultsRef} className="scroll-mt-40">
        {!current ? (
          <EmptyState
            icon={
              <span className="flex gap-1.5">
                {Array.from({ length: 3 }, (_, i) => (
                  <Ball key={i} variant="empty" size="md" />
                ))}
              </span>
            }
            title={t("generator.empty.title")}
            body={t("generator.empty.body")}
          />
        ) : (
          <section aria-labelledby="generator-results" className="flex flex-col gap-4">
            <h2 id="generator-results" className="sr-only">
              {t("generator.result.aria")}
            </h2>
            <ol className="flex flex-col gap-3">
              {current.fields.map((f, i) => {
                const report = reports[i];
                return (
                  <li
                    key={`${current.run}-${i}`}
                    className="llg-appear"
                    style={{ ["--i" as string]: Math.min(i, 8) }}
                  >
                    <Card className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-body font-bold">{t("generator.result.field", { n: i + 1 })}</h3>
                        {report ? <PopularityBadge level={report.level} /> : null}
                      </div>
                      <BallRow main={f.main} {...(f.euro ? { euro: f.euro } : {})} size={big ? "lg" : "md"} />
                      {report ? (
                        <Disclosure summary={t("generator.result.why")}>
                          <PopularityRules report={report} headingLevel={4} />
                        </Disclosure>
                      ) : null}
                      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                        <Button variant="ghost" icon={<RefreshCw />} onClick={() => replace(i)}>
                          {t("generator.result.replace")}
                        </Button>
                        <Button
                          variant="ghost"
                          icon={<Copy />}
                          onClick={() =>
                            void copyText(fieldToText(f, euroLabel), t("generator.toast.copied"), t("generator.toast.copyFailed"))
                          }
                        >
                          {t("generator.result.copyField")}
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
            <p className="text-caption text-muted-foreground">
              {t(cfg.extraCount ? "generator.result.euroNote" : "generator.result.szNote")}
            </p>
            <SaveTicketPanel
              key={current.run}
              game={game}
              fields={current.fields}
              source="generator"
              label={t("generator.result.save")}
            />
            {current.fields.length > 1 ? (
              <Button
                variant="ghost"
                icon={<Copy />}
                className="self-start"
                onClick={() =>
                  void copyText(
                    current.fields.map((f) => fieldToText(f, euroLabel)).join("\n"),
                    t("generator.toast.copiedAll"),
                    t("generator.toast.copyFailed"),
                  )
                }
              >
                {t("generator.result.copyAll")}
              </Button>
            ) : null}
          </section>
        )}
      </div>

      <p className="text-caption text-muted-foreground">
        {t("generator.result.method")}{" "}
        <Link to="/about#generator" className="font-semibold text-foreground underline underline-offset-4">
          {t("common.learnMore")}
        </Link>
      </p>
    </div>
  );
}

function EvaluateTab({ game, pastWinning }: { game: GameId; pastWinning: PastWinningIndex | null }) {
  const { t } = useI18n();
  const cfg = GAMES[game];
  const [main, setMain] = useState<number[]>([]);
  const [euro, setEuro] = useState<number[]>([]);
  const [evaluated, setEvaluated] = useState<string | null>(null);
  const reportRef = useRef<HTMLHeadingElement>(null);

  // Reset the selection when the game changes (pools differ), adjusted during render.
  const [lastGame, setLastGame] = useState(game);
  if (game !== lastGame) {
    setLastGame(game);
    setMain([]);
    setEuro([]);
    setEvaluated(null);
  }

  const complete = main.length === cfg.mainCount && euro.length === cfg.extraCount;
  const key = `${main.join("-")}|${euro.join("-")}`;
  const showReport = complete && evaluated === key;
  const report = useMemo(
    () => (showReport ? evaluatePopularity(game, main, { pastWinning }) : null),
    [showReport, game, main, pastWinning],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-5 lg:rounded-lg lg:border lg:border-border lg:bg-card lg:p-5">
        <NumberPicker
          label={t("evaluate.grid.label.main", { min: 1, max: cfg.mainPool })}
          pool={cfg.mainPool}
          required={cfg.mainCount}
          value={main}
          onChange={setMain}
        />
        {cfg.extraCount ? (
          <NumberPicker
            label={t("evaluate.grid.label.euro", { min: 1, max: cfg.extraPool })}
            pool={cfg.extraPool}
            required={cfg.extraCount}
            value={euro}
            onChange={setEuro}
            columns={6}
            tone="euro"
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            size="lg"
            icon={<SearchCheck />}
            disabled={!complete}
            className="flex-1 sm:flex-none"
            onClick={() => {
              setEvaluated(key);
              focusLater(() => reportRef.current);
            }}
          >
            {t("evaluate.cta")}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            icon={<Eraser />}
            disabled={!main.length && !euro.length}
            onClick={() => {
              setMain([]);
              setEuro([]);
              setEvaluated(null);
            }}
          >
            {t("evaluate.clear")}
          </Button>
        </div>
      </div>

      {report ? (
        <Card as="section" aria-labelledby="evaluate-report" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="evaluate-report" ref={reportRef} tabIndex={-1} className="text-title-3 font-bold outline-offset-4">
              {t("evaluate.report.title")}
            </h2>
            <PopularityBadge level={report.level} />
          </div>
          <BallRow main={main} {...(cfg.extraCount ? { euro } : {})} size="md" />
          <PopularityRules report={report} headingLevel={3} />
          <p className="text-caption text-muted-foreground">{t("evaluate.report.legend")}</p>
          {cfg.extraCount ? <p className="text-caption text-muted-foreground">{t("generator.result.euroNote")}</p> : null}
          <HonestyNote>{t("honesty.short")}</HonestyNote>
          <SaveTicketPanel
            key={key}
            game={game}
            fields={[cfg.extraCount ? { main, euro } : { main }]}
            source="manual"
            label={t("evaluate.report.save")}
          />
        </Card>
      ) : (
        <p className="text-body text-muted-foreground">{t("evaluate.empty")}</p>
      )}
    </div>
  );
}

export default function Generator() {
  const { t } = useI18n();
  const [game] = useGame();
  const data = useDraws(game);
  usePageMeta("generator");
  const [tab, setTab] = useState<"generate" | "evaluate">("generate");

  return (
    <>
      <PageHeader title={t("generator.title", { game: t(`game.${game}.name`) })} />
      <Tabs
        label={t("generator.title", { game: t(`game.${game}.name`) })}
        value={tab}
        onChange={setTab}
        items={[
          { id: "generate", label: t("generator.tab.generate"), panel: <GenerateTab game={game} pastWinning={data.pastWinning} /> },
          { id: "evaluate", label: t("generator.tab.evaluate"), panel: <EvaluateTab game={game} pastWinning={data.pastWinning} /> },
        ]}
      />
    </>
  );
}
