"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

import { HttpError, isRetryableStatus } from "@/lib/http";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            // At most one retry. Compounding 3 retries × 8s backoff turned
            // a single slow query into minutes of UI wait, which is the
            // exact failure mode that motivated this change.
            retry: (failureCount, error) => {
              if (failureCount >= 1) return false;
              if (error instanceof HttpError) {
                if (error.status === 0) return true; // network/timeout
                return isRetryableStatus(error.status);
              }
              return true;
            },
            retryDelay: 500,
            placeholderData: (prev: unknown) => prev,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
