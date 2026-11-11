import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  rename,
} from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import {
  definitionFilename,
  indexArtifactSchema,
  manifestSchema,
} from "../src/lib/content/artifacts";
import { generateContent } from "./generate-content";
import { BIRTHSIGN_CHARGE_TABLES } from "@wayshrine/core";

const skill = {
  label: "{LOCALE.skills.skill.label}",
  description: "{LOCALE.skills.skill.description}",
  governingCharacteristics: ["int"],
};
const trait = {
  label: "{LOCALE.traits.trait.label}",
  description: "{LOCALE.traits.trait.description}",
  params: ["X"],
};
const birthsign = {
  label: "{LOCALE.birthsigns.sign.label}",
  description: "{LOCALE.birthsigns.sign.description}",
  bonuses: [],
  starCursed: { overwriteBaseBonuses: false, bonuses: [] },
};
const tableSigns = Object.fromEntries(
  BIRTHSIGN_CHARGE_TABLES.flatMap((table) => table.entries).map((key) => [
    key,
    birthsign,
  ]),
);
const power = {
  label: "{LOCALE.powers.power.label}",
  description: "{LOCALE.powers.power.description}",
};
const race = {
  label: "{LOCALE.races.race.label}",
  description: "{LOCALE.races.race.description}",
  baselineCharacteristics: {
    str: 20,
    end: 20,
    ag: 20,
    int: 20,
    wp: 20,
    prc: 20,
    prs: 20,
  },
  racialTraits: [{ traitKey: "trait", params: { X: 1 } }],
  racialBonuses: [
    {
      bonusType: "skill",
      choiceGroups: [{ id: "training", choose: 1, options: ["skill"] }],
    },
  ],
};
const temporaryDirectories: string[] = [];
afterEach(async () => {
  for (const directory of temporaryDirectories)
    await rm(directory, { recursive: true, force: true });
  temporaryDirectories.length = 0;
});

async function yaml(path: string, value: unknown) {
  await writeFile(path, stringify(value));
}

function localeEntries(language: string, definitions: Record<string, unknown>) {
  const entries: Record<string, unknown> = {};
  for (const key of Object.keys(definitions)) {
    entries[key] = {
      label: `${language} ${key}`,
      description: `${language} ${key} description`,
    };
  }
  return entries;
}

async function writeDomainLocales(
  locales: string,
  domain: string,
  definitions: Record<string, unknown>,
) {
  for (const language of ["en", "fr"]) {
    const directory = join(locales, language, domain);
    await mkdir(directory, { recursive: true });
    await yaml(
      join(directory, "core.yml"),
      localeEntries(language, definitions),
    );
  }
}

async function fixture() {
  await mkdir("/tmp/opencode", { recursive: true });
  const root = await mkdtemp("/tmp/opencode/wayshrine-content-");
  temporaryDirectories.push(root);
  const source = join(root, "content");
  const output = join(root, "output");
  const locales = join(root, "locales");
  const content = {
    races: { race },
    skills: { skill },
    traits: { trait },
    birthsigns: { ...tableSigns, sign: birthsign },
    powers: { power },
  };
  for (const [domain, definitions] of Object.entries(content)) {
    await mkdir(join(source, domain), { recursive: true });
    await yaml(join(source, domain, "core.yml"), definitions);
    await writeDomainLocales(locales, domain, definitions);
  }
  return { root, source, output, locales };
}
async function readJson(root: string, path: string) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}
async function readOutput(root: string) {
  const contents = new Map<string, string>();
  for (const entry of await readdir(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    contents.set(relative(root, path), await readFile(path, "utf8"));
  }
  return contents;
}

describe("localized static content compiler", () => {
  it("includes birthsign authoring and consumed prose in identity and exports birthsigns", async () => {
    const { source, output, locales } = await fixture();
    const [first] = await generateContent(source, output);
    await yaml(join(source, "birthsigns/core.yml"), {
      ...tableSigns,
      sign: {
        ...birthsign,
        bonuses: [
          { bonusType: "attribute", bonusTargetKey: "speed", bonusValue: 2 },
        ],
      },
    });
    const [second] = await generateContent(source, output);
    expect(second!.localization.sourceRevision).not.toBe(
      first!.localization.sourceRevision,
    );
    expect(second!.version.revision).not.toBe(first!.version.revision);
    await yaml(join(locales, "en/birthsigns/core.yml"), {
      ...localeEntries("en", tableSigns),
      sign: { label: "Sign", description: "Changed birthsign text" },
    });
    const [third] = await generateContent(source, output);
    expect(third!.localization.sourceRevision).toBe(
      second!.localization.sourceRevision,
    );
    expect(third!.version.revision).not.toBe(second!.version.revision);
    expect(
      (await readdir(join(output, `en/${third!.version.revision}`))).sort(),
    ).toEqual(["birthsign", "power", "race", "skill", "trait"]);
  });

  it("publishes selected languages with matching translated indexes and definitions", async () => {
    const { source, output } = await fixture();
    const manifests = await generateContent(source, output, {
      languages: ["en", "fr"],
    });
    expect(manifests[0]!.localization.sourceRevision).toBe(
      manifests[1]!.localization.sourceRevision,
    );
    expect(manifests[0]!.version.revision).not.toBe(
      manifests[1]!.version.revision,
    );
    for (const manifest of manifests) {
      const language = manifest.localization.language;
      expect(
        manifestSchema.parse(
          await readJson(output, `${language}/manifest.json`),
        ),
      ).toEqual(manifest);
      for (const kind of ["race", "skill", "trait", "power"]) {
        const path = `${language}/${manifest.version.revision}/${kind}`;
        const index = indexArtifactSchema.parse(
          await readJson(output, `${path}/index.json`),
        );
        const full = await readJson(output, `${path}/definitions/${kind}.json`);
        expect(index.entries).toEqual([
          { key: kind, label: `${language} ${kind}` },
        ]);
        expect(full.definition.label).toBe(index.entries[0]!.label);
        expect(full.definition.description).toBe(
          `${language} ${kind} description`,
        );
        expect(full.localization).toEqual(manifest.localization);
      }
    }
    expect([...(await readOutput(output))].join()).not.toContain("LOCALE");
    expect((await readOutput(output)).size).toBe(46);
  });

  it("is independent of shard names, object order, comments and YAML formatting", async () => {
    const { source, output, locales } = await fixture();
    const first = await generateContent(source, output);
    const before = await readOutput(output);
    await rename(
      join(source, "skills/core.yml"),
      join(source, "skills/renamed.yaml"),
    );
    await writeFile(
      join(locales, "en/skills/core.yml"),
      '# comment\nskill: {description: "en skill description", label: "en skill"}\n',
    );
    expect(await generateContent(source, output)).toEqual(first);
    expect(await readOutput(output)).toEqual(before);
  });

  it("hashes published translations and English parity inputs but excludes staged text", async () => {
    const { source, output, locales } = await fixture();
    const [first] = await generateContent(source, output, {
      languages: ["fr"],
    });
    await yaml(join(locales, "fr/skills/core.yml"), {
      skill: { label: "Compétence", description: "fr skill description" },
    });
    const [second] = await generateContent(source, output, {
      languages: ["fr"],
    });
    expect(second!.version.revision).not.toBe(first!.version.revision);
    expect(second!.localization.sourceRevision).toBe(
      first!.localization.sourceRevision,
    );
    await yaml(join(locales, "en/skills/core.yml"), {
      skill: { label: "Changed English", description: "en skill description" },
    });
    const [third] = await generateContent(source, output, {
      languages: ["fr"],
    });
    expect(third!.version.revision).not.toBe(second!.version.revision);
    await yaml(join(locales, "fr/races/staged.yml"), {
      extra: { label: "Staged", description: "Staged prose" },
    });
    expect(
      await generateContent(source, output, { languages: ["fr"] }),
    ).toEqual([third]);
  });

  it("preserves meaningful array ordering in source and localized revisions", async () => {
    const { source, output } = await fixture();
    await yaml(join(source, "skills/core.yml"), {
      skill: { ...skill, governingCharacteristics: ["int", "wp"] },
    });
    const [first] = await generateContent(source, output);
    await yaml(join(source, "skills/core.yml"), {
      skill: { ...skill, governingCharacteristics: ["wp", "int"] },
    });
    const [second] = await generateContent(source, output);
    expect(second!.version.revision).not.toBe(first!.version.revision);
    expect(second!.localization.sourceRevision).not.toBe(
      first!.localization.sourceRevision,
    );
  });

  it("fails strict incomplete publication without replacing any previous output; fallback is explicit", async () => {
    const { source, output, locales } = await fixture();
    await generateContent(source, output);
    const before = await readOutput(output);
    await yaml(join(locales, "fr/skills/core.yml"), {
      skill: { label: "Compétence" },
    });
    await expect(
      generateContent(source, output, { languages: ["en", "fr"] }),
    ).rejects.toThrow(
      /skills\/core.yml:skill.description \[fr\/missing-target-key\]/,
    );
    expect(await readOutput(output)).toEqual(before);
    const [manifest] = await generateContent(source, output, {
      languages: ["fr"],
      allowEnglishFallback: true,
    });
    expect(manifest!.localization.allowEnglishFallback).toBe(true);
    const full = await readJson(
      output,
      `fr/${manifest!.version.revision}/skill/definitions/skill.json`,
    );
    expect(full.definition).toMatchObject({
      label: "Compétence",
      description: "en skill description",
    });
    const [strictEnglish] = await generateContent(source, output);
    const [fallbackEnglish] = await generateContent(source, output, {
      allowEnglishFallback: true,
    });
    expect(strictEnglish!.version.revision).not.toBe(
      fallbackEnglish!.version.revision,
    );
  });

  it.each([
    ["content/skills/core.yml", "skill: ["],
    ["content/skills/core.yml", "skill: {}\nskill: {}"],
    ["locales/en/skills/core.yml", "skill: {label: A, label: B}"],
    ["locales/fr/skills/core.yml", "skill: {label: 123}"],
    ["content/birthsigns/core.yml", "sign: {label: bad}"],
    ["content/skills/core.yml", "{}"],
    ["content/traits/core.yml", "{}"],
    ["content/skills/core.yml", "- skill"],
    ["content/skills/core.yml", "# empty"],
  ])("rejects invalid input at %s before writing", async (path, text) => {
    const { root, source, output } = await fixture();
    await writeFile(join(root, path), text);
    await expect(generateContent(source, output)).rejects.toThrow();
    await expect(readdir(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects cross-shard duplicates with source diagnostics", async () => {
    const { source, output, locales } = await fixture();
    await yaml(join(locales, "en/skills/duplicate.yml"), {
      skill: { label: "Duplicate" },
    });
    await expect(generateContent(source, output)).rejects.toThrow(
      /duplicate.yml:skill.*duplicate-key/,
    );
    await rm(join(locales, "en/skills/duplicate.yml"));
    await yaml(join(source, "skills/duplicate.yml"), { skill });
    await expect(generateContent(source, output)).rejects.toThrow(
      /duplicate.yml:skill.*duplicate-key/,
    );
  });

  it.each([["fr", "fr"], ["EN"], ["../en"], []])(
    "rejects invalid selections %j",
    async (...languages) => {
      const { source, output } = await fixture();
      await expect(
        generateContent(source, output, { languages }),
      ).rejects.toThrow();
    },
  );

  it("retains safe filename encoding while enforcing the shared authored key contract", async () => {
    expect(definitionFilename("../a/b")).toBe("%2E%2E%2Fa%2Fb.json");
    expect(definitionFilename("a%2Fb")).toBe("a%252Fb.json");
    const { source, output } = await fixture();
    await yaml(join(source, "skills/keys.yml"), {
      index: { ...skill, skillKey: "index" },
    });
    const [manifest] = await generateContent(source, output);
    expect(
      await readJson(
        output,
        `en/${manifest!.version.revision}/skill/definitions/index.json`,
      ),
    ).toMatchObject({ key: "index" });
    await yaml(join(source, "skills/keys.yml"), { "../index": skill });
    await expect(generateContent(source, output)).rejects.toThrow();
  });

  it("replaces generated output on success and preserves siblings", async () => {
    const { root, source, output } = await fixture();
    await generateContent(source, output);
    await writeFile(join(root, "keep.txt"), "keep");
    await writeFile(join(output, "discard.txt"), "discard");
    await generateContent(source, output);
    expect(await readdir(output)).toEqual(["en"]);
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("keep");
  });

  it("compiles real English across all five domains including twelve signs and ten powers", async () => {
    const { output } = await fixture();
    const source = fileURLToPath(
      new URL("../../core/content/", import.meta.url),
    );
    const [manifest] = await generateContent(source, output);
    const directory = `en/${manifest!.version.revision}`;
    const index = indexArtifactSchema.parse(
      await readJson(output, `${directory}/race/index.json`),
    );
    expect(index.entries.map((entry) => entry.key)).toEqual([
      "altmer",
      "argonian",
    ]);
    expect(index.entries[0]!.label).toBe("Altmer");
    expect((await readdir(join(output, directory))).sort()).toEqual([
      "birthsign",
      "power",
      "race",
      "skill",
      "trait",
    ]);
    const signs = indexArtifactSchema.parse(
      await readJson(output, `${directory}/birthsign/index.json`),
    );
    const powers = indexArtifactSchema.parse(
      await readJson(output, `${directory}/power/index.json`),
    );
    expect(signs.entries).toHaveLength(12);
    expect(powers.entries).toHaveLength(10);
    const thief = await readJson(
      output,
      `${directory}/birthsign/definitions/theThief.json`,
    );
    expect(thief.definition.description).not.toContain("Star-Cursed");
    expect(thief.definition.starCursed.description).toContain(
      "any character who naturally rolled the Thief sign",
    );
    expect(thief.definition.starCursed.eligibility).toEqual({
      requiresNaturallyRolledSign: true,
      canSelectBySpendingLuck: false,
    });
    const guardian = await readJson(
      output,
      `${directory}/power/definitions/ancestorGuardian.json`,
    );
    expect(guardian.definition.description).toContain(
      "\n\nThe GM should remember",
    );
    const word = await readJson(
      output,
      `${directory}/power/definitions/blessedWord.json`,
    );
    expect(word.definition.description).toContain("\n\nThe circle follows");
    expect([...(await readOutput(output))].join()).not.toContain("LOCALE");
  });

  it("hashes consumed nested English and target leaves, excluding staged nested text", async () => {
    const { source, output, locales } = await fixture();
    const sign = {
      ...birthsign,
      starCursed: {
        ...birthsign.starCursed,
        description: "{LOCALE.birthsigns.sign.starCursed.description}",
      },
      bonuses: [
        {
          bonusType: "choice",
          choiceGroup: {
            id: "gift",
            choose: 1,
            prompt: "{LOCALE.birthsigns.sign.choices.gift.prompt}",
            options: [
              {
                id: "power",
                effects: [{ bonusType: "power", bonusTargetKey: "power" }],
              },
            ],
          },
          lifecycle: { selection: "once" },
        },
      ],
    };
    await yaml(join(source, "birthsigns/core.yml"), { ...tableSigns, sign });
    await yaml(join(source, "powers/core.yml"), {
      power: {
        ...power,
        description: "{LOCALE.birthsigns.sign.starCursed.description}",
      },
    });
    const english = {
      ...localeEntries("en", tableSigns),
      sign: {
        label: "Sign",
        description: "Lore",
        starCursed: { description: "English variant" },
        choices: {
          gift: { prompt: "Choose a power" },
          staged: { prompt: "Unused" },
        },
      },
    };
    await yaml(join(locales, "en/birthsigns/core.yml"), english);
    await yaml(join(locales, "fr/birthsigns/core.yml"), {
      ...localeEntries("fr", tableSigns),
      sign: {
        label: "Signe",
        description: "Histoire",
        starCursed: { description: "Variante" },
      },
    });
    const options = { languages: ["fr"], allowEnglishFallback: true };
    const [first] = await generateContent(source, output, options);
    english.sign.choices.staged.prompt = "Still unused";
    await yaml(join(locales, "en/birthsigns/core.yml"), english);
    const [unused] = await generateContent(source, output, options);
    expect(unused).toEqual(first);
    english.sign.starCursed.description = "Changed English variant";
    await yaml(join(locales, "en/birthsigns/core.yml"), english);
    const [consumed] = await generateContent(source, output, options);
    expect(consumed!.localization.sourceRevision).toBe(
      first!.localization.sourceRevision,
    );
    expect(consumed!.version.revision).not.toBe(first!.version.revision);
    english.sign.choices.gift.prompt = "Changed fallback prompt";
    await yaml(join(locales, "en/birthsigns/core.yml"), english);
    const [fallback] = await generateContent(source, output, options);
    expect(fallback!.version.revision).not.toBe(consumed!.version.revision);
    const full = await readJson(
      output,
      `fr/${fallback!.version.revision}/birthsign/definitions/sign.json`,
    );
    expect(full.definition.starCursed.description).toBe("Variante");
    const crossKind = await readJson(
      output,
      `fr/${fallback!.version.revision}/power/definitions/power.json`,
    );
    expect(crossKind.definition.description).toBe("Variante");
    expect(full.definition.bonuses[0].choiceGroup.prompt).toBe(
      "Changed fallback prompt",
    );
  });

  it("rejects invalid birthsign references and missing table signs before replacing output", async () => {
    const { source, output } = await fixture();
    await generateContent(source, output);
    const before = await readOutput(output);
    for (const bonus of [
      { bonusType: "power", bonusTargetKey: "absent" },
      { bonusType: "trait", bonusTargetKey: "trait", bonusParams: {} },
    ]) {
      await yaml(join(source, "birthsigns/core.yml"), {
        ...tableSigns,
        sign: {
          ...birthsign,
          starCursed: {
            overwriteBaseBonuses: false,
            bonuses: [
              {
                bonusType: "choice",
                choiceGroup: {
                  id: "bad",
                  choose: 1,
                  options: [{ id: "bad", effects: [bonus] }],
                },
                lifecycle: { selection: "once" },
              },
            ],
          },
        },
      });
      await expect(generateContent(source, output)).rejects.toThrow(
        "Invalid birthsign sign",
      );
      expect(await readOutput(output)).toEqual(before);
    }
    await yaml(join(source, "birthsigns/core.yml"), { sign: birthsign });
    await expect(generateContent(source, output)).rejects.toThrow(
      "Unknown birthsign in warrior charge table",
    );
    expect(await readOutput(output)).toEqual(before);
  });
});
