import { describe, expect, it, vi } from "vitest";
import { deferred } from "../../test/content";
import { createContentCatalogLoader } from "./catalog";

describe("host content catalog loader", () => {
  it("shares one pending initialization and retains the successful catalog", async () => {
    const pending = deferred<Response>();
    const fetchContent = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const load = createContentCatalogLoader({ fetch: fetchContent });
    const first = load();
    expect(load()).toBe(first);
    expect(fetchContent).toHaveBeenCalledTimes(1);
    pending.resolve(Response.json({ schemaVersion: 1, revision: "one" }));
    const catalog = await first;
    expect(await load()).toBe(catalog);
    expect(fetchContent).toHaveBeenCalledTimes(1);
  });

  it("clears rejected initialization for retry", async () => {
    const fetchContent = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        Response.json({ schemaVersion: 1, revision: "one" }),
      );
    const load = createContentCatalogLoader({ fetch: fetchContent });
    const first = load();
    expect(load()).toBe(first);
    await expect(first).rejects.toMatchObject({ code: "content-unavailable" });
    expect((await load()).version.revision).toBe("one");
    expect(fetchContent).toHaveBeenCalledTimes(2);
  });
});
