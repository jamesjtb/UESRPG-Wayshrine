import type {
  ContentCatalog,
  ContentKind,
  ContentVersion,
} from "../../interface/common/ContentCatalog";
import { ContentError } from "./ContentError";
import {
  CONTENT_SCHEMA_VERSION,
  contentIndexSchema,
  contentVersionSchema,
  parseContentDefinition,
} from "./schemas";

/** Session-local validation, not a cache. Only the pinned version is retained. */
export class ContentReader {
  readonly version: ContentVersion;

  constructor(private readonly catalog: ContentCatalog) {
    const version = contentVersionSchema.safeParse(catalog.version);
    if (
      !version.success ||
      version.data.schemaVersion !== CONTENT_SCHEMA_VERSION
    ) {
      throw new ContentError(
        "incompatible-content",
        "Unsupported content schema version.",
      );
    }
    this.version = version.data;
  }

  async get<K extends ContentKind>(kind: K, key: string) {
    const value = await this.read(() => this.catalog.get(kind, key));
    return value === undefined
      ? undefined
      : parseContentDefinition(kind, key, value);
  }

  async list(kind: ContentKind) {
    const value = await this.read(() => this.catalog.list(kind));
    const result = contentIndexSchema.safeParse(value);
    if (!result.success) {
      throw new ContentError("invalid-content", `Invalid ${kind} index.`, {
        cause: result.error,
      });
    }
    return result.data;
  }

  private async read<T>(load: () => Promise<T>): Promise<T> {
    try {
      this.checkVersion();
      const value = await load();
      this.checkVersion();
      return value;
    } catch (error) {
      if (error instanceof ContentError) throw error;
      throw new ContentError(
        "content-unavailable",
        "Unable to load content. Retry the selection.",
        {
          cause: error,
        },
      );
    }
  }

  private checkVersion() {
    const current = this.catalog.version;
    if (
      current.schemaVersion !== this.version.schemaVersion ||
      current.revision !== this.version.revision
    ) {
      throw new ContentError(
        "content-version-mismatch",
        "Content changed during this session. Start a new creator with the updated catalog.",
      );
    }
  }
}
