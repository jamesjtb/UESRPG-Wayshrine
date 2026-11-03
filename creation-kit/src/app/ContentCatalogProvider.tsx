import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ContentCatalog } from "@wayshrine/core";
import type { ContentCatalogLoader } from "../lib/content/catalog";

type ContentCatalogState =
    | { status: "loading" }
    | { status: "ready"; catalog: ContentCatalog }
    | { status: "error"; error: unknown; retry: () => void };

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
            if (active) setState({ status: "error", error, retry });
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
    if (state.status === "loading") return <p role="status">Loading content…</p>;
    if (state.status === "error") {
        return (
            <div role="alert">
                Content could not be loaded.{" "}
                <button onClick={state.retry}>Retry content</button>
            </div>
        );
    }
    return null;
}
