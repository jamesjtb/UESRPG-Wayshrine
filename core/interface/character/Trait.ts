/** A reusable trait definition from the content catalog. */
export interface Trait {
  label: string;
  description: string;
  params?: readonly string[];
}

/** How a character acquired a trait. */
export type TraitOrigin = "race" | "purchased" | "birthsign";

/** A trait applied to a character, including its parameter values. */
export interface AppliedTrait {
  traitKey: string;
  params?: Readonly<Record<string, string | number>>;
  origin?: TraitOrigin;
  sourceId?: string;
}

/** Trait definitions indexed by their content keys. */
export type TraitCatalog = Readonly<Record<string, Trait>>;
