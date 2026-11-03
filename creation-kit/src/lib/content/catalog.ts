import type { ContentCatalog } from "@wayshrine/core";
import { BrowserContentCatalog } from "./BrowserContentCatalog";
import type { BrowserContentCatalogOptions } from "./BrowserContentCatalog";

export type ContentCatalogLoader = () => Promise<ContentCatalog>;

/** Created once by the host, independent of React consumer lifetimes. */
export function createContentCatalogLoader(
  options?: BrowserContentCatalogOptions,
): ContentCatalogLoader {
  let pending: Promise<ContentCatalog> | undefined;

  return function load() {
    if (!pending) {
      pending = BrowserContentCatalog.create(options);
      void pending.catch(() => {
        pending = undefined;
      });
    }
    return pending;
  };
}
