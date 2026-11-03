import type { ContentCatalog } from "@wayshrine/core";

export const testCatalog: ContentCatalog = {
  version: Object.freeze({ schemaVersion: 1, revision: "test" }),
  async list() {
    return [];
  },
  async get() {
    return undefined;
  },
};

export async function loadTestCatalog(): Promise<ContentCatalog> {
  return testCatalog;
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
