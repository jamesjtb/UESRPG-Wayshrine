import {
    CONTENT_SCHEMA_VERSION,
    ContentError,
    contentVersionSchema,
    parseContentDefinition,
} from "@wayshrine/core";
import type {
    ContentCatalog,
    ContentDefinitions,
    ContentKind,
    ContentSummary,
    ContentVersion,
} from "@wayshrine/core";
import {
    definitionArtifactSchema,
    definitionFilename,
    indexArtifactSchema,
    manifestSchema,
} from "./artifacts";

export interface BrowserContentCatalogOptions {
    baseUrl?: string;
    fetch?: typeof fetch;
}

async function fetchJson(
    fetchContent: typeof fetch,
    url: string,
): Promise<unknown> {
    let response: Response;
    try {
        response = await fetchContent(url);
    } catch (cause) {
        throw new ContentError("content-unavailable", `Cannot load ${url}.`, {
            cause,
        });
    }
    if (response.status === 401 || response.status === 403) {
        throw new ContentError("content-access-denied", `Access denied: ${url}.`);
    }
    if (!response.ok) {
        throw new ContentError(
            "content-unavailable",
            `Cannot load ${url}: ${response.status}.`,
        );
    }
    try {
        return await response.json();
    } catch (cause) {
        throw new ContentError("invalid-content", `Invalid JSON: ${url}.`, {
            cause,
        });
    }
}

function validateVersion(value: unknown): ContentVersion {
    const result = contentVersionSchema.safeParse(value);
    if (!result.success) {
        throw new ContentError("invalid-content", "Invalid content version.", {
            cause: result.error,
        });
    }
    if (result.data.schemaVersion !== CONTENT_SCHEMA_VERSION) {
        throw new ContentError(
            "incompatible-content",
            "Unsupported content schema version.",
        );
    }
    return result.data;
}

function validateEnvelopeVersion(value: unknown, expected: ContentVersion) {
    if (value === null || typeof value !== "object" || !("version" in value)) {
        throw new ContentError("invalid-content", "Missing content version.");
    }
    const version = validateVersion(value.version);
    if (version.revision !== expected.revision) {
        throw new ContentError(
            "content-version-mismatch",
            "Content revision changed. Reload to start a new session.",
        );
    }
}

/** One host-owned revision. Only summaries survive settled reads. */
export class BrowserContentCatalog implements ContentCatalog {
    readonly version: ContentVersion;
    private readonly indexes = new Map<
        ContentKind,
        Promise<readonly ContentSummary[]>
    >();
    private readonly definitions = new Map<string, Promise<unknown>>();

    private constructor(
        version: ContentVersion,
        private readonly contentUrl: string,
        private readonly fetchContent: typeof fetch,
    ) {
        this.version = Object.freeze({ ...version });
        Object.freeze(this);
    }

    static async create(
        options: BrowserContentCatalogOptions = {},
    ): Promise<BrowserContentCatalog> {
        const baseUrl = new URL(
            options.baseUrl ?? import.meta.env.BASE_URL,
            document.baseURI,
        );
        const contentUrl = new URL("content/", baseUrl).href;
        const fetchContent = options.fetch ?? globalThis.fetch.bind(globalThis);
        const value = await fetchJson(fetchContent, `${contentUrl}manifest.json`);
        validateVersion(value);
        const manifest = manifestSchema.safeParse(value);
        if (!manifest.success) {
            throw new ContentError("invalid-content", "Invalid content manifest.", {
                cause: manifest.error,
            });
        }
        return new BrowserContentCatalog(manifest.data, contentUrl, fetchContent);
    }

    async list(kind: ContentKind): Promise<readonly ContentSummary[]> {
        return structuredClone(await this.loadIndex(kind));
    }

    async get<K extends ContentKind>(
        kind: K,
        key: string,
    ): Promise<ContentDefinitions[K] | undefined> {
        const entries = await this.loadIndex(kind);
        if (!entries.some((entry) => entry.key === key)) return undefined;

        const path = `${kind}/definitions/${encodeURIComponent(definitionFilename(key))}`;
        let pending = this.definitions.get(path);
        if (!pending) {
            pending = this.readDefinition(kind, key, path);
            this.definitions.set(path, pending);
            // Handle both outcomes without creating an ignored rejecting finally promise.
            void pending.then(
                () => this.definitions.delete(path),
                () => this.definitions.delete(path),
            );
        }
        // Core validates once per read; each caller receives its own detached copy.
        return structuredClone(await pending) as ContentDefinitions[K];
    }

    private loadIndex(kind: ContentKind): Promise<readonly ContentSummary[]> {
        let pending = this.indexes.get(kind);
        if (!pending) {
            pending = this.readIndex(kind);
            this.indexes.set(kind, pending);
            void pending.catch(() => this.indexes.delete(kind));
        }
        return pending;
    }

    private async readIndex(
        kind: ContentKind,
    ): Promise<readonly ContentSummary[]> {
        const value = await this.read(`${kind}/index.json`);
        const result = indexArtifactSchema.safeParse(value);
        if (!result.success) {
            throw new ContentError("invalid-content", "Invalid content index.", {
                cause: result.error,
            });
        }
        if (result.data.kind !== kind) {
            throw new ContentError(
                "invalid-content",
                "Content index kind does not match.",
            );
        }
        return result.data.entries;
    }

    private async readDefinition<K extends ContentKind>(
        kind: K,
        key: string,
        path: string,
    ): Promise<ContentDefinitions[K]> {
        const value = await this.read(path);
        const result = definitionArtifactSchema.safeParse(value);
        if (!result.success) {
            throw new ContentError(
                "invalid-content",
                "Invalid content definition envelope.",
                { cause: result.error },
            );
        }
        if (result.data.kind !== kind || result.data.key !== key) {
            throw new ContentError(
                "invalid-content",
                "Content definition identity does not match.",
            );
        }
        return parseContentDefinition(kind, key, result.data.definition);
    }

    private async read(path: string): Promise<unknown> {
        const revision = encodeURIComponent(this.version.revision);
        const value = await fetchJson(
            this.fetchContent,
            `${this.contentUrl}${revision}/${path}`,
        );
        validateEnvelopeVersion(value, this.version);
        return value;
    }
}
