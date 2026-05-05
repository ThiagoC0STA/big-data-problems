/**
 * Resilience layer.
 *
 * - <WidgetBoundary/> per-feature error boundary tied to TanStack Query reset.
 * - <RowErrorBoundary/> minimal class boundary for virtualized rows.
 * - useOnlineStatus()  reactive online/offline indicator.
 *
 * Note: WidgetBoundary uses a small custom error boundary so we keep the
 * bundle lean and the lifecycle obvious.
 */

"use client";

import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Component, type ErrorInfo, type ReactNode, useEffect, useState } from "react";

import { RowFallback, WidgetError } from "@/components/fallbacks";

// --------------------------------------------------------------------- generic boundary

interface BoundaryState {
  hasError: boolean;
  error: unknown;
}

interface GenericBoundaryProps {
  children: ReactNode;
  fallbackRender: (args: { error: unknown; reset: () => void }) => ReactNode;
  onError?: (error: unknown, info: ErrorInfo) => void;
  resetKey?: unknown;
}

class GenericBoundary extends Component<GenericBoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: GenericBoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallbackRender({ error: this.state.error, reset: this.reset });
    }
    return this.props.children;
  }
}

// --------------------------------------------------------------------- widget boundary

interface WidgetBoundaryProps {
  children: ReactNode;
  title?: string;
  technique?: string;
  resetKey?: unknown;
  fallback?: (args: { error: unknown; reset: () => void }) => ReactNode;
}

export function WidgetBoundary({
  children,
  title,
  technique,
  resetKey,
  fallback,
}: WidgetBoundaryProps) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  return (
    <GenericBoundary
      resetKey={resetKey}
      fallbackRender={({ error, reset }) =>
        fallback ? (
          fallback({
            error,
            reset: () => {
              resetQueries();
              reset();
            },
          })
        ) : (
          <WidgetError
            title={title}
            error={error}
            technique={technique}
            onRetry={() => {
              resetQueries();
              reset();
            }}
          />
        )
      }
    >
      {children}
    </GenericBoundary>
  );
}

// --------------------------------------------------------------------- row boundary

interface RowErrorBoundaryProps {
  children: ReactNode;
  rowId: string;
  onError?: (rowId: string, error: unknown) => void;
}

interface RowState {
  hasError: boolean;
  error: unknown;
}

export class RowErrorBoundary extends Component<RowErrorBoundaryProps, RowState> {
  state: RowState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): RowState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError?.(this.props.rowId, error);
  }

  render() {
    if (this.state.hasError) {
      const reason =
        this.state.error instanceof Error ? this.state.error.message : "Render error.";
      return <RowFallback rowId={this.props.rowId} reason={reason} />;
    }
    return this.props.children;
  }
}

// --------------------------------------------------------------------- online status

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
