import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logError";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
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
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {this.props.fallbackMessage || "Something went wrong"}
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={this.handleReset}>
              Try again
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
