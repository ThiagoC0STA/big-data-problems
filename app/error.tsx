"use client";

import { RouteErrorFallback } from "@/components/fallbacks";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: Props) {
  return <RouteErrorFallback segment="root" error={error} reset={reset} />;
}
