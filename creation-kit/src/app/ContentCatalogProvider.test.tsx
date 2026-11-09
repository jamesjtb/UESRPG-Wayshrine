import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ContentCatalog } from "@wayshrine/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, testCatalog } from "../test/content";
import { createContentCatalogLoader } from "../lib/content/catalog";
import { App } from "./App";
import {
  ContentCatalogProvider,
  useContentCatalog,
} from "./ContentCatalogProvider";

const manifest = {
  version: testCatalog.version,
  artifactFormat: 2,
  localization: {
    language: "en",
    sourceRevision: "a".repeat(64),
    allowEnglishFallback: false,
  },
};

function Consumer() {
  const state = useContentCatalog();
  if (state.status === "ready") return <p>{state.catalog.version.revision}</p>;
  if (state.status === "error")
    return <button onClick={state.retry}>Retry</button>;
  return <p>Loading</p>;
}

describe("ContentCatalogProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  it("shares host initialization under StrictMode and between consumers", async () => {
    const pending = deferred<Response>();
    const fetchContent = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const load = createContentCatalogLoader({ fetch: fetchContent });
    render(
      <StrictMode>
        <ContentCatalogProvider loadCatalog={load}>
          <Consumer />
          <Consumer />
        </ContentCatalogProvider>
      </StrictMode>,
    );
    await waitFor(() => expect(fetchContent).toHaveBeenCalledTimes(1));
    await act(async () => pending.resolve(Response.json(manifest)));
    expect(await screen.findAllByText("test")).toHaveLength(2);
    expect(fetchContent).toHaveBeenCalledTimes(1);
  });

  it("retains initialization across consumer unmount/remount without aborting", async () => {
    const pending = deferred<Response>();
    const fetchContent = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const load = createContentCatalogLoader({ fetch: fetchContent });
    const first = render(
      <ContentCatalogProvider loadCatalog={load}>
        <Consumer />
      </ContentCatalogProvider>,
    );
    await waitFor(() => expect(fetchContent).toHaveBeenCalledTimes(1));
    first.unmount();
    await act(async () => pending.resolve(Response.json(manifest)));
    render(
      <ContentCatalogProvider loadCatalog={load}>
        <Consumer />
      </ContentCatalogProvider>,
    );
    expect(await screen.findByText("test")).toBeTruthy();
    expect(fetchContent).toHaveBeenCalledTimes(1);
  });

  it("ignores an obsolete initializer's completion", async () => {
    const old = deferred<ContentCatalog>();
    const loadOld = () => old.promise;
    const loadNew = async () => testCatalog;
    const view = render(
      <ContentCatalogProvider loadCatalog={loadOld}>
        <Consumer />
      </ContentCatalogProvider>,
    );
    await act(async () => {});
    view.rerender(
      <ContentCatalogProvider loadCatalog={loadNew}>
        <Consumer />
      </ContentCatalogProvider>,
    );
    expect(await screen.findByText("test")).toBeTruthy();
    await act(async () => old.reject(new Error("obsolete")));
    expect(screen.getByText("test")).toBeTruthy();
    expect(screen.queryByText("Retry")).toBeNull();
  });

  it("handles synchronous initializer errors and retries only on request", async () => {
    const user = userEvent.setup();
    const load = vi
      .fn<() => Promise<ContentCatalog>>()
      .mockImplementationOnce(() => {
        throw new Error("sync failure");
      })
      .mockResolvedValue(testCatalog);
    render(
      <ContentCatalogProvider loadCatalog={load}>
        <Consumer />
      </ContentCatalogProvider>,
    );
    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(load).toHaveBeenCalledTimes(1);
    await user.click(retry);
    expect(await screen.findByText("test")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps Home and navigation usable during loading/failure and retries shared initialization", async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    const fetchContent = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(Response.json(manifest));
    const load = createContentCatalogLoader({ fetch: fetchContent });
    render(<App loadCatalog={load} />);
    expect(
      screen.getByRole("status", { name: "Loading content" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Welcome/ })).toBeTruthy();
    await waitFor(() => expect(fetchContent).toHaveBeenCalledTimes(1));
    await act(async () => pending.reject(new Error("offline")));
    expect(
      await screen.findByRole("dialog", { name: "Something went wrong!" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("link", { name: "Character Sheet" }));
    expect(
      screen.getByRole("heading", { name: "Character Sheet" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "Retry content" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchContent).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: /Welcome/ })).toBeTruthy();
  });
});
