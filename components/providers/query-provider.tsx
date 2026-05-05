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
            // Smart retry: never retry 4xx (except a few transient ones),
            // back off exponentially on 5xx and network errors, cap at 3.
            retry: (failureCount, error) => {
              if (failureCount >= 3) return false;
              if (error instanceof HttpError) {
                if (error.status === 0) return true; // network/timeout
                return isRetryableStatus(error.status);
              }
              return true;
            },
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
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
