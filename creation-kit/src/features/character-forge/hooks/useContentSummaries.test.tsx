import { StrictMode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ContentCatalog,
  ContentKind,
  ContentSummary,
} from "@wayshrine/core";
import { deferred } from "../../../test/content";
import { fixtureCatalog } from "../test/testCatalog";
import { useContentSummaries } from "./useContentSummaries";

const entries: readonly ContentSummary[] = [{ key: "altmer", label: "Altmer" }];

function pendingCatalog() {
  const read = deferred<readonly ContentSummary[]>();
  const catalog = fixtureCatalog();
  const list = vi.spyOn(catalog, "list").mockReturnValue(read.promise);
  return { catalog, list, read };
}

describe("useContentSummaries", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([{ summaries: entries }, { summaries: [] }])(
    "loads lightweight summaries: $summaries",
    async ({ summaries }) => {
      const { catalog, list, read } = pendingCatalog();
      const get = vi.spyOn(catalog, "get");
      const { result } = renderHook(() => useContentSummaries(catalog, "race"));
      expect(result.current.status).toBe("loading");
      expect(result.current).not.toHaveProperty("entries");
      await act(async () => read.resolve(summaries));
      expect(result.current).toMatchObject({
        status: "ready",
        entries: summaries,
      });
      expect(list).toHaveBeenCalledExactlyOnceWith("race");
      expect(get).not.toHaveBeenCalled();
    },
  );

  it.each(["success", "failure"])(
    "retains acknowledged failure and starts a fresh retry ending in %s",
    async (outcome) => {
      const { catalog, list, read } = pendingCatalog();
      const retryRead = deferred<readonly ContentSummary[]>();
      const { result, rerender } = renderHook(() =>
        useContentSummaries(catalog, "race"),
      );
      const loadingActions = result.current;
      const error = new Error("private transport details");
      await act(async () => read.reject(error));
      expect(result.current).toMatchObject({
        status: "error",
        acknowledged: false,
      });
      expect(result.current).not.toHaveProperty("error");
      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        "Race index loading failed.",
        error,
      );
      act(() => loadingActions.acknowledge());
      expect(result.current).toMatchObject({ acknowledged: false });
      act(() => result.current.acknowledge());
      rerender();
      expect(result.current).toMatchObject({
        status: "error",
        acknowledged: true,
      });
      expect(console.error).toHaveBeenCalledTimes(1);
      const oldActions = result.current;
      list.mockReturnValue(retryRead.promise);
      act(() => result.current.retry());
      expect(result.current.status).toBe("loading");
      expect(result.current).not.toHaveProperty("acknowledged");
      act(() => {
        oldActions.retry();
        oldActions.acknowledge();
      });
      await act(async () => {
        if (outcome === "success") retryRead.resolve(entries);
        else retryRead.reject(error);
      });
      expect(list).toHaveBeenCalledTimes(2);
      if (outcome === "success") {
        expect(result.current).toMatchObject({ status: "ready", entries });
        expect(console.error).toHaveBeenCalledTimes(1);
      } else {
        expect(result.current).toMatchObject({
          status: "error",
          acknowledged: false,
        });
        expect(console.error).toHaveBeenCalledTimes(2);
      }
      act(() => oldActions.acknowledge());
      expect(result.current).not.toMatchObject({ acknowledged: true });
    },
  );

  it.each(["success", "failure"])(
    "ignores %s after unmount",
    async (outcome) => {
      const { catalog, read } = pendingCatalog();
      const { result, unmount } = renderHook(() =>
        useContentSummaries(catalog, "race"),
      );
      await act(async () => {});
      const before = result.current;
      unmount();
      await act(async () => {
        before.retry();
        before.acknowledge();
        if (outcome === "success") read.resolve(entries);
        else read.reject(new Error("unmounted"));
      });
      expect(result.current).toBe(before);
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["catalog", "success"],
    ["catalog", "failure"],
    ["kind", "success"],
    ["kind", "failure"],
  ])("ignores obsolete %s source completion: %s", async (source, outcome) => {
    const first = pendingCatalog();
    const second = pendingCatalog();
    const nextRead = deferred<readonly ContentSummary[]>();
    const { result, rerender } = renderHook(
      ({ catalog, kind }: { catalog: ContentCatalog; kind: ContentKind }) =>
        useContentSummaries(catalog, kind),
      { initialProps: { catalog: first.catalog, kind: "race" } },
    );
    await act(async () => {});
    first.list.mockReturnValue(nextRead.promise);
    const nextCatalog = source === "catalog" ? second.catalog : first.catalog;
    const kind = source === "kind" ? "skill" : "race";
    rerender({ catalog: nextCatalog, kind });
    expect(result.current.status).toBe("loading");
    await act(async () => {
      if (outcome === "success") first.read.resolve(entries);
      else first.read.reject(new Error("obsolete"));
    });
    expect(result.current.status).toBe("loading");
    expect(console.error).not.toHaveBeenCalled();
    await act(async () => {
      if (source === "catalog") second.read.resolve([]);
      else nextRead.resolve([]);
    });
    expect(result.current).toMatchObject({ status: "ready", entries: [] });
    expect(nextCatalog.list).toHaveBeenLastCalledWith(kind);
  });

  it("publishes no old summaries or failure when the source changes", async () => {
    const first = pendingCatalog();
    const second = pendingCatalog();
    const { result, rerender } = renderHook(
      ({ catalog }) => useContentSummaries(catalog, "race"),
      { initialProps: { catalog: first.catalog } },
    );
    await act(async () => first.read.resolve(entries));
    rerender({ catalog: second.catalog });
    expect(result.current.status).toBe("loading");
    expect(result.current).not.toHaveProperty("entries");
    await act(async () => second.read.reject(new Error("second")));
    const stale = result.current;
    rerender({ catalog: first.catalog });
    act(() => {
      stale.retry();
      stale.acknowledge();
    });
    expect(result.current.status).toBe("loading");
    await act(async () => {});
    expect(result.current).toMatchObject({ status: "ready", entries });
    expect(first.list).toHaveBeenCalledTimes(2);
  });

  it.each(["success", "failure"])(
    "survives StrictMode replay with a shared pending %s",
    async (outcome) => {
      const { catalog, list, read } = pendingCatalog();
      const { result } = renderHook(
        () => useContentSummaries(catalog, "race"),
        { wrapper: StrictMode },
      );
      await act(async () => {});
      expect(list).toHaveBeenCalledTimes(2);
      await act(async () => {
        if (outcome === "success") read.resolve(entries);
        else read.reject(new Error("shared failure"));
      });
      if (outcome === "success") {
        expect(result.current).toMatchObject({ status: "ready", entries });
        expect(console.error).not.toHaveBeenCalled();
      } else {
        expect(result.current).toMatchObject({
          status: "error",
          acknowledged: false,
        });
        expect(console.error).toHaveBeenCalledTimes(1);
      }
    },
  );

  it("catches synchronous list throws", async () => {
    const catalog = fixtureCatalog();
    const error = new Error("synchronous read");
    vi.spyOn(catalog, "list").mockImplementation(() => {
      throw error;
    });
    const { result } = renderHook(() => useContentSummaries(catalog, "trait"));
    await act(async () => {});
    expect(result.current).toMatchObject({
      status: "error",
      acknowledged: false,
    });
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "Trait index loading failed.",
      error,
    );
  });

  it.each(["success", "failure"])(
    "ignores the cleaned-up StrictMode operation's %s",
    async (outcome) => {
      const { catalog, list, read } = pendingCatalog();
      const replay = deferred<readonly ContentSummary[]>();
      list
        .mockReturnValueOnce(read.promise)
        .mockReturnValueOnce(replay.promise);
      const { result } = renderHook(
        () => useContentSummaries(catalog, "race"),
        { wrapper: StrictMode },
      );
      await act(async () => {
        if (outcome === "success") read.resolve(entries);
        else read.reject(new Error("cleaned up"));
      });
      expect(result.current.status).toBe("loading");
      expect(console.error).not.toHaveBeenCalled();
      await act(async () => replay.resolve([]));
      expect(result.current).toMatchObject({ status: "ready", entries: [] });
      expect(list).toHaveBeenCalledTimes(2);
    },
  );
});
