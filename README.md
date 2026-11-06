# Lotto-Luck-Genius

Personal PWA for EuroJackpot and Lotto 6 aus 49: honest random generator with a popularity
estimate, ticket check against real draws, exact odds and expected value, draw statistics.
No accounts, no backend: draw archives are static JSON in `public/data/`, tickets live in
`localStorage`. Interface in Russian (default), English and German.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:8080 |
| `npm run build` | Type check + production build into `dist/` (with service worker) |
| `npm run preview` | Serve `dist/` on http://localhost:4173 |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint (flat config) / TypeScript strict |
| `npm run contrast` | WCAG contrast of the colour tokens in `src/index.css` |
| `npm run i18n` | Rebuild `src/i18n/{ru,en,de}.json` from `../texts/site-copy.md` |
| `npm run icons` | Redraw the PWA icons and favicons (no dependencies) |
| `npm run data:update` | Fetch new draws (EuroJackpot official JSON, Lotto 6aus49 archive + WestLotto spot-check) into `public/data/`; raw downloads are cached in `.data-cache/` (git-ignored) |

Node ≥ 20.19.

## Structure

```
src/
  App.tsx                 routes (all screens lazy)
  main.tsx, index.css     entry, design tokens (Tailwind v4 @theme)
  styles/fonts.css        Manrope Variable, Cyrillic + Latin subsets only
  components/ui/          own UI primitives (see below)
  components/layout/      AppShell, TopBar, BottomNav, SideNav, GameSwitch, LanguageSwitch, PageHeader
  components/common/      HonestyNote, NumberPicker (slip grid + text), PopularityReport, Disclosure,
                          ConfirmDialog, DrawDataStatus, focusLater
  components/tickets/     TicketCard, TicketEditor (sheet), SaveTicketPanel, useTicketTransfer (JSON)
  components/stats/       FrequencyChart (CSS bars + table), CompareTable
  pages/                  one file per route
  hooks/                  useGame, useDraws, useArchive, usePageMeta, useUniformityTest, useIdle,
                          useMediaQuery, useInView
  i18n/                   provider (Intl.PluralRules, lazy EN/DE), generated dictionaries
  lib/                    maths and data: odds, ev, popularity, rng, generator, ticketCheck,
                          ticketStatus, stats, drawCalendar, eras, csvImport, games, archive;
                          backtest, popularityValidation, analysisJobs, seededRng;
                          screen logic: ticketSummary, ticketDraft, drawsView, statsView, userDrawOps
  lib/storage/            localStore (useSyncExternalStore), stores, validate, gameStore
  workers/stats.worker.ts Monte Carlo uniformity test off the main thread
  workers/analysis.worker.ts /backtest analyses (strategy backtest, popularity check) off the main thread
scripts/                  data, icons, i18n, contrast
public/data/              draw archives (served and cached at runtime, not precached)
```

## Components (`@/components/ui`)

All are plain React + Tailwind, keyboard and screen-reader ready, touch targets ≥ 44 px.

- `Button` `{ variant: primary|secondary|ghost|danger, size: md(44)|lg(56), block, loading, icon }`;
  `ButtonLink` = router `Link` styled as a button; `buttonClasses(opts)` for other elements.
- `IconButton` `{ label (required → aria-label), variant, pressed }`, 44×44.
- `Field` `{ label, help, error, required, optionalText }` wraps one control and wires
  `id`, `aria-describedby`, `aria-invalid` through context (`useFieldControl` for custom controls).
- `Input` (48 px, 16 px text); `NumberInput` `{ value: number|null, onChange, min, max, step,
  decimals, decrementLabel, incrementLabel, locale }` — accepts "," and ".", clamps on blur,
  arrow keys step, −/+ buttons when both labels are given.
- `Card` `{ as, padding }`, `Section` `{ title, id, description, actions, level, card }`.
- `SegmentedControl<T>` `{ options[{value,label,lang}], value, onChange, label|labelledBy,
  orientation, block }` — ARIA radio group with arrow keys.
- `Tabs<T>` `{ items[{id,label,panel}], value|defaultValue, onChange, label, keepMounted }`.
- `Dialog` / `Sheet` `{ open, onClose, title, description, closeLabel, footer, dismissible }` on
  native `<dialog>` (focus trap, Esc, inert page from the browser). `Sheet` is a bottom sheet
  below 1024 px. `onClose` may be called after the owner already set `open=false` — keep it idempotent.
- `toast(message, { variant, description, action, duration })`, `toast.success`, `toast.error`,
  `toast.dismiss(id)`; render `<Toaster closeLabel>` once (done in `AppShell`). Default 6 s,
  paused on hover/focus; polite and assertive live regions.
- `Ball` `{ value, variant: main|euro|superzahl|empty, size: sm(32)|md(44)|lg(56), state:
  default|matched|missed, label }`; `BallRow` `{ main, euro, superzahl, size, matches, after }`
  with the spoken summary from `ball.summary.*`.
- `Skeleton`, `SkeletonGroup { label }`, `EmptyState { icon, title, body, actions }`,
  `ErrorState { title, body, retryLabel, onRetry, actions }`.

Class names are joined with `cx()` (`@/lib/cx`); there is no tailwind-merge, so pass
additive classes rather than overriding existing ones.

## Hooks

- `useGame(): [GameId, setGame]` — global game, stored as `llg.game`.
- `useDraws(game): DrawSet` — archive + user-added draws (`llg.userDraws.v1`), `byDate`,
  `pastWinning`, `completeness`, `meta` (source, licence, `payout` share for EuroJackpot),
  `isLoading`, `isError`, `refetch`.
- `useArchive(game, enabled = true)` — the small cache behind it (1 h fresh, 1 retry, de-duplicated
  requests). `useDraws(game, false)` / `useArchive(game, false)` read the cache without fetching.
- The app shell loads the archive for the tickets badge only after `useIdle()` and only when there
  are tickets of the game or the sidebar is visible, so /odds and /about never wait for it.
- `useIdle()`, `useMediaQuery(query)`, `useInView(ref)` — small helpers for deferred work.
- `usePageMeta(page, params?)` — title, description and `<html lang>` from `seo.{page}.*`.
- `useI18n()` — `t`, `tp` (plural), `num`, `money`, `percent`, `date`, `weekday`, `lang`, `setLang`.
- `useUniformityTest(observed, draws, k, pool)` — Monte Carlo p-value in a Web Worker.
- `useLocalStore(store)` with `ticketsStore`, `userDrawsStore`, `oddsStore` from `lib/storage/stores`.

## Data and privacy

Draw data: Lotto 6 aus 49 from `daowa89/lottery-archive` (scripts MIT, data from
lottozahlenonline.de, personal non-commercial use), EuroJackpot from the official
eurojackpot.com JSON service (personal use). The site is `noindex, nofollow`; no analytics,
no third-party requests, fonts are self-hosted.
