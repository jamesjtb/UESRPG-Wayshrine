import type { ContentErrorCode } from "../../interface/common/ContentCatalog";

/** Transport adapters and Core validation use the same small failure vocabulary. */
export class ContentError extends Error {
  constructor(
    readonly code: ContentErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ContentError";
  }
}
