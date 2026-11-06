import { Link } from "react-router";
import { ExternalLink } from "lucide-react";
import { ButtonLink, Card, Section } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageFallback } from "@/components/layout/PageFallback";
import { HonestyNote } from "@/components/common/HonestyNote";
import { Disclosure } from "@/components/common/Disclosure";
import { useI18n, useNamespace } from "@/i18n/context";
import { usePageMeta } from "@/hooks/usePageMeta";

type Tg = ReturnType<typeof useI18n>["t"];

/** Sections in the order of the contents list; the ids are the anchors other screens link to. */
const SECTIONS = ["minute", "control", "practice", "avoid", "won", "faq"] as const;

/** The steps of "If you win" (guide.won.<id>.title/body); the ids are anchors (#won-deadline …). */
const WON_STEPS = ["receipt", "check", "keep", "claim", "big", "deadline", "tax", "scam"] as const;

/** Pages the texts rest on (guide-copy.md 6.3), opened by the user; nothing is fetched from them. */
const SOURCE_URLS = {
  westlotto: "https://www.westlotto.de/infos-und-zahlen/lotto-verstehen/lottogewinn/lottogewinn.html",
  westlottoReceipt: "https://www.westlotto.de/magazin/spiel/frage-des-monats-spielquittung.html",
  brandenburg: "https://www.lotto-brandenburg.de/service/gewinnabholung",
  niedersachsen: "https://www.lotto-niedersachsen.de/unternehmen/presse/hochgewinner-faq",
  numbers649: "https://www.lotto.de/lotto-6aus49/lottozahlen",
  ejCheck: "https://www.eurojackpot.com/gewinnabfrage",
  bgb195: "https://www.gesetze-im-internet.de/bgb/__195.html",
  bgb199: "https://www.gesetze-im-internet.de/bgb/__199.html",
  testde: "https://www.test.de/gluecksspiel-gewinne-steuern-5562827-0/",
  tonline: "https://www.t-online.de/finanzen/geldanlage/id_84025656/lotto-worauf-muessen-gewinner-achten-steuern-erbe-chancen-und-co-.html",
  verbraucherzentrale:
    "https://www.verbraucherzentrale.de/wissen/digitale-welt/phishingradar/betruegerische-schreiben-zu-lotto-und-gewinnspielen-per-post-72307",
  rules649: "https://www.lotto.de/lotto-6aus49/spielregeln",
  rulesEj: "https://www.lotto.de/eurojackpot/spielregeln",
} as const;
type SourceId = keyof typeof SOURCE_URLS;

const WON_SOURCES: SourceId[] = [
  "westlotto",
  "westlottoReceipt",
  "brandenburg",
  "niedersachsen",
  "numbers649",
  "ejCheck",
  "bgb195",
  "bgb199",
  "testde",
  "tonline",
  "verbraucherzentrale",
];
const PAGE_SOURCES: SourceId[] = ["numbers649", "rules649", "rulesEj"];

const SECTION_CLASS = "scroll-mt-24 lg:scroll-mt-8";
const PROSE = "text-body text-muted-foreground";

function Sources({ ids, tg, label }: { ids: SourceId[]; tg: Tg; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col">
        {ids.map((id) => (
          <li key={id}>
            <a
              href={SOURCE_URLS[id]}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 py-1 text-body text-foreground underline underline-offset-4 hover:decoration-2"
            >
              <span className="min-w-0 break-words">{tg(`guide.src.${id}`)}</span>
              <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Minute({ tg }: { tg: Tg }) {
  return (
    <Section id="minute" title={tg("guide.minute.title")} className={SECTION_CLASS}>
      <Card as="div">
        <ol className="flex list-decimal flex-col gap-3 pl-5 marker:font-bold marker:text-muted-foreground">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="pl-1 text-body">
              {tg(`guide.minute.p${i}`)}
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

function Control({ tg }: { tg: Tg }) {
  const rows = [1, 2, 3] as const;
  return (
    <Section id="control" title={tg("guide.control.title")} className={SECTION_CLASS}>
      <div className="flex flex-col gap-6">
        <table className="w-full text-body">
          <thead className="max-sm:sr-only">
            <tr className="border-b border-border-strong text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {tg("guide.control.col.what")}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {tg("guide.control.col.can")}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {tg("guide.control.col.means")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((i) => (
              <tr key={i} className="max-sm:block max-sm:py-3">
                <th scope="row" className="py-3 pr-3 text-left align-top font-bold max-sm:block max-sm:py-0">
                  {tg(`guide.control.row${i}.label`)}
                </th>
                <td className="py-3 pr-3 align-top font-semibold whitespace-nowrap max-sm:block max-sm:py-0.5">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-caption">{tg(`guide.control.row${i}.can`)}</span>
                </td>
                <td className={`py-3 align-top max-sm:block max-sm:py-0 ${PROSE}`}>{tg(`guide.control.row${i}.text`)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {(["chance", "share", "spend"] as const).map((k) => (
          <div key={k} className="flex flex-col gap-2">
            <h3 className="text-body font-bold">{tg(`guide.control.${k}.title`)}</h3>
            <p className={PROSE}>{tg(`guide.control.${k}.body`)}</p>
            {k === "share" ? <p className="text-caption text-muted-foreground">{tg("guide.control.share.limits")}</p> : null}
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/odds" variant="secondary">
            {tg("guide.link.odds")}
          </ButtonLink>
          <ButtonLink to="/backtest#popularity" variant="secondary">
            {tg("guide.link.popularity")}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}

function Practice({ tg }: { tg: Tg }) {
  return (
    <Section id="practice" title={tg("guide.practice.title")} className={SECTION_CLASS}>
      <ol className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <li key={i}>
            <Card className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-bold tabular-nums"
              >
                {i}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-body font-bold">{tg(`guide.practice.s${i}.title`)}</h3>
                <p className={PROSE}>{tg(`guide.practice.s${i}.body`)}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Avoid({ tg }: { tg: Tg }) {
  return (
    <Section id="avoid" title={tg("guide.avoid.title")} className={SECTION_CLASS}>
      <div className="flex flex-col gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <h3 className="text-body font-bold">{tg(`guide.avoid.a${i}.title`)}</h3>
            <p className={PROSE}>{tg(`guide.avoid.a${i}.body`)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Won({ tg }: { tg: Tg }) {
  return (
    <Section id="won" title={tg("guide.won.title")} className={SECTION_CLASS}>
      <div className="flex flex-col gap-6">
        <p className={PROSE}>{tg("guide.won.intro")}</p>
        {WON_STEPS.map((id) => (
          <div key={id} id={`won-${id}`} className={`flex flex-col gap-1 ${SECTION_CLASS}`}>
            <h3 className="text-body font-bold">{tg(`guide.won.${id}.title`)}</h3>
            <p className={PROSE}>{tg(`guide.won.${id}.body`)}</p>
          </div>
        ))}
        <div className="flex flex-col gap-1 border-t border-border pt-4">
          <h3 className="text-body font-bold">{tg("guide.sources.title")}</h3>
          <Sources ids={WON_SOURCES} tg={tg} label={`${tg("guide.won.title")}: ${tg("guide.sources.title")}`} />
        </div>
      </div>
    </Section>
  );
}

function Faq({ tg }: { tg: Tg }) {
  return (
    <Section id="faq" title={tg("guide.faq.title")} className={SECTION_CLASS}>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Disclosure key={i} summary={tg(`guide.faq.q${i}`)} tone="card">
            {tg(`guide.faq.a${i}`)}
          </Disclosure>
        ))}
      </div>
    </Section>
  );
}

/**
 * /guide: "how to play sensibly" in six sections with a contents list, the verified "If you win"
 * routine with links to the companies' pages, and the questions and answers. The texts
 * (guide-copy.md section 3) are the `guide` dictionary, loaded with this page.
 */
export default function Guide() {
  const { t } = useI18n();
  // The guide texts are their own dictionary, fetched with this page.
  const ready = useNamespace("guide");
  usePageMeta("guide");
  if (!ready) return <PageFallback />;
  const tg = t;

  return (
    <div className="max-w-[68ch]">
      <PageHeader title={tg("guide.title")} description={tg("guide.lead")} />
      <div className="flex flex-col gap-10">
        <HonestyNote>{t("honesty.chance")}</HonestyNote>
        <nav aria-label={tg("guide.toc.aria")}>
          <Card className="flex flex-col gap-2">
            <h2 className="text-title-3 font-bold">{tg("guide.toc.title")}</h2>
            <ol className="flex flex-col">
              {SECTIONS.map((id) => (
                <li key={id}>
                  <Link
                    to={{ hash: id }}
                    className="flex min-h-11 items-center text-body font-semibold text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-foreground"
                  >
                    {tg(`guide.toc.${id}`)}
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        </nav>
        <Minute tg={tg} />
        <Control tg={tg} />
        <Practice tg={tg} />
        <Avoid tg={tg} />
        <Won tg={tg} />
        <Faq tg={tg} />
        <Section title={tg("guide.sources.title")}>
          <p className="text-caption text-muted-foreground">{tg("guide.sources.note")}</p>
          <Sources ids={PAGE_SOURCES} tg={tg} label={tg("guide.sources.title")} />
        </Section>
      </div>
    </div>
  );
}
