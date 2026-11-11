import type {
  ContentCatalog,
  ContentDefinitions,
  ContentKind,
} from "../../interface/common/ContentCatalog";
import type { Race } from "../../interface/character/Race";
import type Skill from "../../interface/character/Skill";

type Definitions = {
  [K in ContentKind]: Readonly<Record<string, ContentDefinitions[K]>>;
};

/** Async fake with controllable transport delays/failures and visible access history. */
export class TestContentCatalog implements ContentCatalog {
  version = { schemaVersion: 2, revision: "test-revision" };
  readonly getCalls: { kind: ContentKind; key: string }[] = [];
  readonly listCalls: ContentKind[] = [];
  beforeGet: ((kind: ContentKind, key: string) => Promise<void>) | undefined;
  beforeList: ((kind: ContentKind) => Promise<void>) | undefined;

  constructor(readonly definitions: Definitions) {}

  async get<K extends ContentKind>(
    kind: K,
    key: string,
  ): Promise<ContentDefinitions[K] | undefined> {
    this.getCalls.push({ kind, key });
    await this.beforeGet?.(kind, key);
    const definitions: Readonly<Record<string, ContentDefinitions[K]>> =
      this.definitions[kind];
    return Object.hasOwn(definitions, key) ? definitions[key] : undefined;
  }

  async list(kind: ContentKind) {
    this.listCalls.push(kind);
    await this.beforeList?.(kind);
    return Object.entries(this.definitions[kind]).map(([key, definition]) => ({
      key,
      label: definition.label ?? key,
    }));
  }
}

export function creationCatalogs() {
  const altmer: Race = {
    label: "Altmer",
    description: "",
    baselineCharacteristics: {
      str: 20,
      end: 23,
      ag: 23,
      int: 30,
      wp: 28,
      prc: 25,
      prs: 25,
    },
    racialTraits: [{ traitKey: "weakness", params: { type: "magic", X: 2 } }],
    racialBonuses: [
      {
        bonusType: "skill",
        choiceGroups: [
          { id: "magic", choose: 1, options: ["alchemy", "alteration"] },
        ],
      },
    ],
  };
  const argonian: Race = {
    ...altmer,
    label: "Argonian",
    baselineCharacteristics: { ...altmer.baselineCharacteristics, str: 25 },
    racialTraits: [{ traitKey: "amphibious" }],
  };
  delete argonian.racialBonuses;
  const races = { altmer, argonian };
  const skills: Record<string, Skill> = {
    alchemy: { skillKey: "alchemy", governingCharacteristics: ["int"] },
    alteration: { skillKey: "alteration", governingCharacteristics: ["wp"] },
  };
  const traits = {
    weakness: { label: "Weakness", description: "", params: ["type", "X"] },
    amphibious: { label: "Amphibious", description: "" },
  };
  const catalog = new TestContentCatalog({
    race: races,
    skill: skills,
    trait: traits,
    birthsign: {
      theWarrior: {
        label: "Warrior",
        description: "Test sign",
        bonuses: [],
        starCursed: { overwriteBaseBonuses: false, bonuses: [] },
      },
    },
    power: {},
  });
  return { catalog, races, skills, traits, altmer };
}

export function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
