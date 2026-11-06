import { useEffect } from "react";
import { toast } from "@/components/ui";
import { useI18n } from "@/i18n/context";

/**
 * The service worker skips waiting and claims open pages (see vite.config.ts), so a new build
 * takes over by itself. This page still runs the old scripts, so when the controller changes
 * (and there was one before: not the very first install) the user is offered a reload (QA B1).
 */
export function useServiceWorkerUpdate(): void {
  const { t } = useI18n();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const hadController = sw.controller !== null;
    if (!hadController) return;
    const onChange = () => {
      toast(t("update.available"), {
        duration: 0,
        action: { label: t("update.action"), onClick: () => window.location.reload() },
      });
    };
    sw.addEventListener("controllerchange", onChange, { once: true });
    return () => sw.removeEventListener("controllerchange", onChange);
  }, [t]);
}
