import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ContentCatalog } from "@wayshrine/core";
import type { ContentCatalogLoader } from "../lib/content/catalog";
import { ErrorModal } from "../components/ErrorModal";
import { LoadingIndicator } from "../components/LoadingIndicator";

type ContentCatalogState =
  | { status: "loading" }
  | { status: "ready"; catalog: ContentCatalog }
  | {
      status: "error";
      error: unknown;
      retry: () => void;
      acknowledged: boolean;
      acknowledge: () => void;
    };

const ContentCatalogContext = createContext<ContentCatalogState | undefined>(
  undefined,
);

export function ContentCatalogProvider({
  loadCatalog,
  children,
}: {
  loadCatalog: ContentCatalogLoader;
  children: ReactNode;
}) {
  const [state, setState] = useState<ContentCatalogState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    function ready(catalog: ContentCatalog) {
      if (active) setState({ status: "ready", catalog });
    }
    function failed(error: unknown) {
      if (!active) return;
      console.error("Content initialization failed.", error);
      setState({
        status: "error",
        error,
        retry,
        acknowledged: false,
        acknowledge,
      });
    }
    function acknowledge() {
      if (!active) return;
      setState((current) => {
        if (current.status !== "error") return current;
        return { ...current, acknowledged: true };
      });
    }
    function retry() {
      if (!active) return;
      active = false;
      setState({ status: "loading" });
      setAttempt((previous) => previous + 1);
    }

    // Also catches synchronous errors from an injected initializer.
    void Promise.resolve().then(loadCatalog).then(ready, failed);
    return () => {
      active = false;
    };
  }, [loadCatalog, attempt]);

  return (
    <ContentCatalogContext.Provider value={state}>
      {children}
    </ContentCatalogContext.Provider>
  );
}

export function useContentCatalog(): ContentCatalogState {
  const state = useContext(ContentCatalogContext);
  if (!state) throw new Error("ContentCatalogProvider is missing.");
  return state;
}

export function ContentCatalogStatus() {
  const state = useContentCatalog();
  if (state.status === "loading")
    return <LoadingIndicator label="Loading content" />;
  if (state.status === "error") {
    return (
      <>
        <ErrorModal opened={!state.acknowledged} onClose={state.acknowledge} />
        <button onClick={state.retry}>Retry content</button>
      </>
    );
  }
  return null;
}
