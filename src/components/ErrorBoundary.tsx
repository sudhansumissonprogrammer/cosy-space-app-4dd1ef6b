import React from "react";
import { logError } from "@/lib/logError";
import { recoverFromChunkLoadError } from "@/lib/chunkLoadRecovery";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level ErrorBoundary.
 * Uses plain HTML buttons + inline SVG icons to avoid pulling
 * heavy dependencies (Button → Radix Slot, lucide-react) into
 * the critical JS bundle. This saves ~57KB gzip on storefront cold load.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (recoverFromChunkLoadError(error)) return;

    logError({
      message: error.message,
      stack: error.stack,
      context: "ErrorBoundary",
      metadata: { componentStack: info.componentStack?.slice(0, 500) },
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    if (recoverFromChunkLoadError(this.state.error)) return;
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            {/* Inline AlertTriangle SVG — avoids importing lucide-react */}
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.fallbackMessage || "Something went wrong"}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {/* Inline RefreshCw SVG */}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
