import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/lib/cx";
import { IconButton } from "./IconButton";

export interface DialogProps {
  open: boolean;
  /** Called on Esc, backdrop click, the close button, or when the browser closes the dialog. */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** Label of the × button, e.g. t("common.close"). */
  closeLabel: string;
  children?: ReactNode;
  /** Action row, pinned under the scrolling body. */
  footer?: ReactNode;
  /** "center" = modal dialog; "sheet" = bottom sheet on phones, centred dialog from 1024 px. */
  variant?: "center" | "sheet";
  /** Close when the backdrop is clicked. Default: true. */
  dismissible?: boolean;
  className?: string;
}

/**
 * Modal on the native <dialog> element: the browser handles the focus trap, Esc,
 * inert background and the top layer; focus returns to the trigger on close.
 * Enter/exit animate with CSS (@starting-style, transition-behavior: allow-discrete);
 * reduced motion keeps only the fade. Page scroll is locked while open (index.css).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  variant = "center",
  dismissible = true,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Esc and form[method=dialog] close the element directly; report it to the owner.
    const handleClose = () => onCloseRef.current();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, []);

  return (
    <dialog
      ref={ref}
      data-variant={variant}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClick={(e) => {
        // A click on the <dialog> itself (not its content) is a click on the backdrop.
        if (dismissible && e.target === e.currentTarget) e.currentTarget.close();
      }}
      className={cx(
        "llg-dialog m-auto flex-col overflow-hidden border border-border bg-surface-2 p-0 text-foreground shadow-raised open:flex",
        "max-h-[min(85dvh,48rem)] w-[min(100%-2rem,32rem)] max-w-none rounded-xl",
        variant === "sheet" &&
          "max-lg:mb-0 max-lg:max-h-[90dvh] max-lg:w-full max-lg:rounded-b-none max-lg:border-x-0 max-lg:border-b-0",
        className,
      )}
    >
      {variant === "sheet" ? (
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong lg:hidden" />
      ) : null}
      <header className="flex shrink-0 items-start gap-3 px-4 pt-3 pb-2 sm:px-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
          <h2 id={titleId} className="text-title-3 font-bold">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="text-body text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <IconButton label={closeLabel} onClick={() => ref.current?.close()} className="-mr-2">
          <X />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">{children}</div>
      {footer ? (
        <footer
          className={cx(
            "flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 pt-3 sm:px-5",
            variant === "sheet" ? "pb-[calc(0.75rem+var(--safe-bottom))] lg:pb-3" : "pb-3",
          )}
        >
          {footer}
        </footer>
      ) : variant === "sheet" ? (
        <div aria-hidden="true" className="h-[var(--safe-bottom)] shrink-0 lg:hidden" />
      ) : null}
    </dialog>
  );
}

/** Bottom sheet on phones (centred dialog on desktop). Same API as Dialog. */
export function Sheet(props: Omit<DialogProps, "variant">) {
  return <Dialog {...props} variant="sheet" />;
}
