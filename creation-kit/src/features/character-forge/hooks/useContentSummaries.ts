import { useEffect, useRef, useState } from "react";
import type {
  ContentCatalog,
  ContentKind,
  ContentSummary,
} from "@wayshrine/core";

type SummaryState =
  | { status: "loading" }
  | { status: "ready"; entries: readonly ContentSummary[] }
  | { status: "error"; acknowledged: boolean };

interface Request {
  catalog: ContentCatalog;
  kind: ContentKind;
}

export function useContentSummaries(
  catalog: ContentCatalog,
  kind: ContentKind,
) {
  const [request, setRequest] = useState<Request>({ catalog, kind });
  const [result, setResult] = useState<{
    request: Request;
    state: SummaryState;
  }>({ request, state: { status: "loading" } });
  const active = useRef<Request | null>(null);

  // Reset before publishing a render for a new source, not after its effect runs.
  if (request.catalog !== catalog || request.kind !== kind) {
    setRequest({ catalog, kind });
  }

  useEffect(() => {
    let live = true;
    active.current = request;
    function ready(entries: readonly ContentSummary[]) {
      if (!live || active.current !== request) return;
      setResult({ request, state: { status: "ready", entries } });
    }
    function failed(error: unknown) {
      if (!live || active.current !== request) return;
      const label = request.kind[0]!.toUpperCase() + request.kind.slice(1);
      console.error(`${label} index loading failed.`, error);
      setResult({ request, state: { status: "error", acknowledged: false } });
    }
    void Promise.resolve()
      .then(() => request.catalog.list(request.kind))
      .then(ready, failed);
    return () => {
      live = false;
      if (active.current === request) active.current = null;
    };
  }, [request]);

  function retry() {
    if (active.current !== request || state.status !== "error") return;
    active.current = null;
    setRequest({ catalog, kind });
  }

  function acknowledge() {
    if (active.current !== request || state.status !== "error") return;
    setResult((current) => {
      if (current.request !== request || current.state.status !== "error")
        return current;
      return { request, state: { status: "error", acknowledged: true } };
    });
  }

  const state: SummaryState =
    result.request === request ? result.state : { status: "loading" };
  return { ...state, retry, acknowledge };
}
