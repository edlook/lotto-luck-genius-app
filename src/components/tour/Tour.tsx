import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, Sheet, toast } from "@/components/ui";
import { useI18n, useNamespace } from "@/i18n/context";
import { cx } from "@/lib/cx";
import { tourRequest } from "@/lib/hintsRuntime";
import { tourStore } from "@/lib/storage/onboarding";

const STEPS = [1, 2, 3, 4, 5] as const;
/** Same as the dialog transition (index.css), then the host unmounts the tour. */
const EXIT_MS = 260;

/**
 * The first-launch tour: five short steps in the app's native <dialog> sheet (bottom sheet on
 * phones, centred dialog on desktop). Esc, the × button and "Skip" end it the same way as
 * "Get started"; either way it is not shown again (llg.tour.v1) and can be reopened from the
 * settings. The page stays inert behind it; the step text is a polite live region.
 */
export default function Tour({ onExited }: { onExited: () => void }) {
  // The tour texts are the `coach` dictionary; the dialog opens once it is there.
  const ready = useNamespace("coach");
  return ready ? <TourDialog onExited={onExited} /> : null;
}

function TourDialog({ onExited }: { onExited: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const finished = useRef(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  const last = step === STEPS.length - 1;
  const n = step + 1;

  useEffect(() => {
    // The browser focuses the first control (×); the primary button is the better start.
    const raf = window.requestAnimationFrame(() => nextRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(exitTimer.current);
    };
  }, []);

  const finish = (skipped: boolean) => {
    // Esc closes the <dialog> by itself and reports it back: handle that only once.
    if (finished.current) return;
    finished.current = true;
    tourStore.set({ done: true, at: new Date().toISOString() });
    tourRequest.set(false);
    setOpen(false);
    if (skipped) toast(t("tour.skipped.toast"));
    exitTimer.current = window.setTimeout(onExited, EXIT_MS);
  };

  return (
    <Sheet
      open={open}
      onClose={() => finish(true)}
      title={t(`tour.step${n}.title`)}
      closeLabel={t("common.close")}
      dismissible={false}
      footer={
        <>
          <Button key="skip" variant="ghost" className="mr-auto" onClick={() => finish(true)}>
            {t("tour.skip")}
          </Button>
          {step > 0 ? (
            <Button key="back" variant="secondary" onClick={() => setStep(step - 1)}>
              {t("tour.back")}
            </Button>
          ) : null}
          <Button key="next" ref={nextRef} onClick={() => (last ? finish(false) : setStep(step + 1))}>
            {t(last ? "tour.done" : "tour.next")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-1" aria-live="polite">
        <p className="text-caption font-semibold text-muted-foreground">
          {t("tour.dialog.aria")} · {t("tour.progress", { n, total: STEPS.length })}
        </p>
        <p className="text-body">{t(`tour.step${n}.body`)}</p>
        <div aria-hidden="true" className="flex gap-1.5">
          {STEPS.map((s) => (
            <span
              key={s}
              className={cx(
                "h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out",
                s === n ? "w-6 bg-primary" : "w-1.5 bg-border-strong",
              )}
            />
          ))}
        </div>
        {last ? (
          <Link
            to="/guide"
            onClick={() => finish(false)}
            className="inline-flex min-h-11 items-center self-start font-semibold text-foreground underline underline-offset-4"
          >
            {t("nav.guide")}
          </Link>
        ) : null}
      </div>
    </Sheet>
  );
}
