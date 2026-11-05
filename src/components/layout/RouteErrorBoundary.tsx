import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "@/components/ui";
import { useI18n } from "@/i18n/context";

function RouteError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <ErrorState
      title={t("error.unknown.title")}
      body={t("error.unknown.body")}
      retryLabel={t("common.retry")}
      onRetry={onRetry}
    />
  );
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors and failed lazy chunks (e.g. offline after an update) of one
 * screen. Retry reloads the page, which also picks up a new service-worker build.
 */
export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Screen failed to render", error, info.componentStack);
  }

  override render() {
    if (this.state.error) return <RouteError onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
