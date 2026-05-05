"use client";

import { RouteErrorFallback } from "@/components/fallbacks";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppGroupError({ error, reset }: Props) {
  return <RouteErrorFallback segment="(app)" error={error} reset={reset} />;
}
