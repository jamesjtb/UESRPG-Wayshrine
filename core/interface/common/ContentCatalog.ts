import type { Race } from "../character/Race";
import type { Birthsign } from "../character/Birthsign";
import type { Power } from "../character/Power";
import type Skill from "../character/Skill";
import type { Trait } from "../character/Trait";

export interface ContentDefinitions {
  race: Race;
  skill: Skill;
  trait: Trait;
  birthsign: Birthsign;
  power: Power;
}

export type ContentKind = keyof ContentDefinitions;

/** Browsing data, not a full definition. Labels may be localization keys. */
export interface ContentSummary {
  readonly key: string;
  readonly label: string;
}

export interface ContentVersion {
  readonly schemaVersion: number;
  readonly revision: string;
}

/**
 * One immutable content revision, shared by the host's tools and wizards.
 * Hosts initialize the catalog; Core never discovers its environment.
 *
 * Definitions use stable content keys and contain no host documents or IDs.
 * `get` returns undefined only for absent keys; access/loading/validation failures
 * reject with ContentError. Adapters must not retain complete definition catalogs.
 */
export interface ContentCatalog {
  readonly version: ContentVersion;
  list(kind: ContentKind): Promise<readonly ContentSummary[]>;
  get<K extends ContentKind>(
    kind: K,
    key: string,
  ): Promise<ContentDefinitions[K] | undefined>;
}

export type ContentErrorCode =
  | "content-unavailable"
  | "content-access-denied"
  | "invalid-content"
  | "incompatible-content"
  | "content-version-mismatch";
