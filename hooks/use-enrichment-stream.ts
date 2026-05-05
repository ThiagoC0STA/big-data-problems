"use client";

import { useEffect, useReducer, useRef } from "react";

import { enrichmentStreamPath, getEnrichmentJob } from "@/lib/api-client";
import { apiUrl } from "@/lib/http";
import type { EnrichmentJob, SSEEnrichmentEvent } from "@/lib/types";

export type StreamStatus = "idle" | "connected" | "retrying" | "polling" | "lost" | "complete";

interface State {
  job: EnrichmentJob | null;
  events: SSEEnrichmentEvent[];
  status: StreamStatus;
  retries: number;
}

type Action =
  | { type: "set_status"; status: StreamStatus }
  | { type: "set_job"; job: EnrichmentJob }
  | { type: "push_event"; event: SSEEnrichmentEvent }
  | { type: "set_retries"; retries: number }
  | { type: "reset" };

const INITIAL: State = { job: null, events: [], status: "idle", retries: 0 };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set_status":
      return { ...state, status: action.status };
    case "set_job":
      return { ...state, job: action.job };
    case "push_event":
      return { ...state, events: [...state.events, action.event].slice(-100) };
    case "set_retries":
      return { ...state, retries: action.retries };
    case "reset":
      return INITIAL;
  }
}

const MAX_SSE_RETRIES = 5;

export function useEnrichmentStream(jobId: string | null) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const sseRef = useRef<EventSource | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) {
      dispatch({ type: "reset" });
      return;
    }

    let cancelled = false;
    let retries = 0;

    const cleanup = () => {
      sseRef.current?.close();
      sseRef.current = null;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const startPolling = () => {
      if (cancelled) return;
      dispatch({ type: "set_status", status: "polling" });
      const poll = async () => {
        try {
          const job = await getEnrichmentJob(jobId);
          if (cancelled) return;
          dispatch({ type: "set_job", job });
          if (job.status === "completed" || job.status === "failed") {
            dispatch({ type: "set_status", status: "complete" });
            cleanup();
          }
        } catch {
          // swallow; we'll try again on the next tick
        }
      };
      poll();
      pollingRef.current = setInterval(poll, 3000);
    };

    const connect = () => {
      if (cancelled) return;
      dispatch({ type: "set_status", status: retries === 0 ? "connected" : "retrying" });

      const url = apiUrl(enrichmentStreamPath(jobId));
      const es = new EventSource(url);
      sseRef.current = es;

      es.addEventListener("open", () => {
        retries = 0;
        dispatch({ type: "set_retries", retries: 0 });
        dispatch({ type: "set_status", status: "connected" });
      });

      const handleEvent = (raw: MessageEvent) => {
        try {
          const data = JSON.parse(raw.data) as SSEEnrichmentEvent;
          dispatch({ type: "push_event", event: data });
          if (typeof data.processed === "number" && typeof data.total === "number") {
            getEnrichmentJob(jobId)
              .then((job) => !cancelled && dispatch({ type: "set_job", job }))
              .catch(() => {});
          }
          if (data.type === "complete") {
            dispatch({ type: "set_status", status: "complete" });
            cleanup();
          }
        } catch {
          // ignore malformed payloads
        }
      };

      es.addEventListener("message", handleEvent);
      es.addEventListener("progress", handleEvent);
      es.addEventListener("product_updated", handleEvent);
      es.addEventListener("complete", handleEvent);
      es.addEventListener("error", () => {
        es.close();
        sseRef.current = null;
        if (cancelled) return;
        retries += 1;
        dispatch({ type: "set_retries", retries });
        if (retries >= MAX_SSE_RETRIES) {
          dispatch({ type: "set_status", status: "lost" });
          startPolling();
          return;
        }
        const wait = Math.min(1000 * 2 ** retries, 16000);
        dispatch({ type: "set_status", status: "retrying" });
        reconnectTimerRef.current = setTimeout(connect, wait);
      });
    };

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [jobId]);

  return state;
}
