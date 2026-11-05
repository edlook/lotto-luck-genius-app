import type { ReactNode } from "react";
import { Button, Dialog } from "@/components/ui";
import { useI18n } from "@/i18n/context";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra action before the confirm button (e.g. "Export first"). */
  extra?: ReactNode;
  children?: ReactNode;
}

/** Destructive confirmation. "Cancel" comes first and is the safe default in tab order. */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel, extra, children }: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      closeLabel={t("common.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          {extra}
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
