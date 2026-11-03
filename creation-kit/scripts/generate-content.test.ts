import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { stringify } from "yaml";
import type { ContentVersion } from "@wayshrine/core";
import {
  definitionFilename,
  indexArtifactSchema,
} from "../src/lib/content/artifacts";
import { generateContent } from "./generate-content";

const skill = { governingCharacteristics: ["int"] };
const trait = {
  label: "Trait label",
  description: "Trait description",
  params: ["X"],
};
const race = {
  label: "{LOCALE.race}",
  description: "Race description",
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
  for (const directory of temporaryDirectories) {
    await rm(directory, { recursive: true, force: true });
  }
  temporaryDirectories.length = 0;
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "wayshrine-content-"));
  temporaryDirectories.push(root);
  const source = join(root, "source");
  const output = join(root, "output");
  for (const directory of ["races", "skills", "traits"]) {
    await mkdir(join(source, directory), { recursive: true });
  }
  await writeFile(join(source, "races/core.yml"), stringify({ race }));
  await writeFile(join(source, "skills/core.yml"), stringify({ skill }));
  await writeFile(join(source, "traits/core.yml"), stringify({ trait }));
  return { root, source, output };
}

async function readJson(root: string, path: string): Promise<unknown> {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function readOutput(root: string) {
  const contents = new Map<string, string>();
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      contents.set(relative(root, path), await readFile(path, "utf8"));
    }
  }
  return contents;
}

async function expectFixtureArtifacts(output: string, version: ContentVersion) {
  const expectedArtifacts = [
    { kind: "race", label: race.label, definition: race },
    {
      kind: "skill",
      label: "skill",
      definition: { ...skill, skillKey: "skill" },
    },
    { kind: "trait", label: trait.label, definition: trait },
  ];
  for (const { kind, label, definition } of expectedArtifacts) {
    const directory = `${version.revision}/${kind}`;
    expect(await readJson(output, `${directory}/index.json`)).toEqual({
      version,
      kind,
      entries: [{ key: kind, label }],
    });
    expect(
      await readJson(output, `${directory}/definitions/${kind}.json`),
    ).toEqual({
      version,
      kind,
      key: kind,
      definition,
    });
  }
}

async function writeKeyedSkills(
  source: string,
  cases: readonly { key: string }[],
) {
  const definitions: Record<string, unknown> = Object.create(null);
  for (const { key } of cases) {
    definitions[key] = { ...skill, skillKey: key };
  }
  await writeFile(join(source, "skills/keys.yaml"), stringify(definitions));
}

async function expectEncodedSkills(
  output: string,
  version: ContentVersion,
  cases: readonly { key: string; filename: string }[],
) {
  const directory = `${version.revision}/skill/definitions`;
  for (const { key, filename } of cases) {
    expect(definitionFilename(key)).toBe(filename);
    expect(await readJson(output, `${directory}/${filename}`)).toEqual({
      version,
      kind: "skill",
      key,
      definition: { ...skill, skillKey: key },
    });
  }
}

describe("static content compiler", () => {
  it("writes a manifest, lightweight indexes, and individual Core definitions", async () => {
    const { source, output } = await createFixture();
    const version = await generateContent(source, output);
    expect(await readJson(output, "manifest.json")).toEqual(version);
    expect(version.revision).toMatch(/^[a-f0-9]{64}$/);

    await expectFixtureArtifacts(output, version);
    expect((await readOutput(output)).size).toBe(7);
  });

  it("ignores file ordering, filenames, object ordering, and YAML formatting", async () => {
    const { source, output } = await createFixture();
    await writeFile(join(source, "skills/z.yaml"), stringify({ extra: skill }));
    const firstVersion = await generateContent(source, output);
    const firstOutput = await readOutput(output);

    await rm(join(source, "skills/core.yml"));
    await rm(join(source, "skills/z.yaml"));
    await writeFile(
      join(source, "skills/a.yaml"),
      "# comment\nextra: {governingCharacteristics: [int]}\nskill: {governingCharacteristics: [int]}\n",
    );
    await writeFile(
      join(source, "traits/core.yml"),
      stringify({
        trait: {
          params: ["X"],
          description: trait.description,
          label: trait.label,
        },
      }),
    );

    expect(await generateContent(source, output)).toEqual(firstVersion);
    expect(await readOutput(output)).toEqual(firstOutput);
  });

  it("keeps array ordering significant in revisions", async () => {
    const { source, output } = await createFixture();
    await writeFile(
      join(source, "skills/core.yml"),
      stringify({ skill: { governingCharacteristics: ["int", "wp"] } }),
    );
    const first = await generateContent(source, output);
    await writeFile(
      join(source, "skills/core.yml"),
      stringify({ skill: { governingCharacteristics: ["wp", "int"] } }),
    );
    const second = await generateContent(source, output);
    expect(second.revision).not.toBe(first.revision);
  });

  it("accepts matching skillKey values and keeps arbitrary keys in safe filenames", async () => {
    const { source, output } = await createFixture();
    const cases = [
      { key: "index", filename: "index.json" },
      { key: "../index", filename: "%2E%2E%2Findex.json" },
      { key: ".", filename: "%2E.json" },
      { key: "..", filename: "%2E%2E.json" },
      { key: "a/b", filename: "a%2Fb.json" },
      { key: "a%2Fb", filename: "a%252Fb.json" },
      { key: "a\\b", filename: "a%5Cb.json" },
      { key: "雪?#", filename: "%E9%9B%AA%3F%23.json" },
      { key: "__proto__", filename: "__proto__.json" },
      { key: "!'()*", filename: "%21%27%28%29%2A.json" },
    ];
    await writeKeyedSkills(source, cases);

    const version = await generateContent(source, output);
    await expectEncodedSkills(output, version, cases);
    const indexPath = `${version.revision}/skill/index.json`;
    const index = indexArtifactSchema.parse(await readJson(output, indexPath));
    expect(index.entries).toHaveLength(cases.length + 1);
  });

  const invalidInputs = [
    { name: "malformed YAML", path: "skills/core.yml", yaml: "skill: [" },
    {
      name: "duplicate YAML keys",
      path: "skills/core.yml",
      yaml: "skill: {}\nskill: {}",
    },
    {
      name: "duplicate nested keys",
      path: "skills/core.yml",
      yaml: "skill: {governingCharacteristics: [int], governingCharacteristics: [wp]}",
    },
    {
      name: "duplicate definitions across files",
      path: "skills/duplicate.yaml",
      yaml: stringify({ skill }),
    },
    { name: "non-map root", path: "skills/core.yml", yaml: "- skill" },
    {
      name: "empty document",
      path: "skills/core.yml",
      yaml: "# no definitions",
    },
    {
      name: "non-map definition",
      path: "skills/core.yml",
      yaml: "skill: text",
    },
    {
      name: "invalid Core definition",
      path: "skills/core.yml",
      yaml: "skill: {governingCharacteristics: []}",
    },
    {
      name: "contradictory skillKey",
      path: "skills/core.yml",
      yaml: stringify({ skill: { ...skill, skillKey: "other" } }),
    },
    { name: "missing skill reference", path: "skills/core.yml", yaml: "{}" },
    { name: "missing trait reference", path: "traits/core.yml", yaml: "{}" },
    {
      name: "incorrect trait parameters",
      path: "traits/core.yml",
      yaml: stringify({ trait: { ...trait, params: ["Y"] } }),
    },
    {
      name: "invalid choice count",
      path: "races/core.yml",
      yaml: stringify({
        race: {
          ...race,
          racialBonuses: [
            {
              bonusType: "skill",
              choiceGroups: [{ id: "training", choose: 2, options: ["skill"] }],
            },
          ],
        },
      }),
    },
  ];
  it.each(invalidInputs)(
    "rejects $name before writing output",
    async ({ path, yaml }) => {
      const { source, output } = await createFixture();
      await writeFile(join(source, path), yaml);
      await expect(generateContent(source, output)).rejects.toThrow();
      await expect(readdir(output)).rejects.toMatchObject({ code: "ENOENT" });
    },
  );

  it("preserves all previous output when validation fails", async () => {
    const { source, output } = await createFixture();
    await generateContent(source, output);
    const before = await readOutput(output);
    await writeFile(join(source, "skills/core.yml"), "{}");
    await expect(generateContent(source, output)).rejects.toThrow(
      "unknown skill",
    );
    expect(await readOutput(output)).toEqual(before);
  });

  it("replaces the generated directory on success without touching sibling files", async () => {
    const { root, source, output } = await createFixture();
    const first = await generateContent(source, output);
    await writeFile(join(root, "keep.txt"), "outside generated output");
    await writeFile(join(output, "discard.txt"), "inside generated output");
    await writeFile(
      join(source, "skills/core.yml"),
      stringify({ skill: { ...skill, label: "New label" } }),
    );

    const second = await generateContent(source, output);
    expect(second.revision).not.toBe(first.revision);
    expect((await readdir(output)).sort()).toEqual(
      [second.revision, "manifest.json"].sort(),
    );
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe(
      "outside generated output",
    );
  });

  it("compiles the actual Core YAML catalogs", async () => {
    const { output } = await createFixture();
    const source = fileURLToPath(
      new URL("../../core/content/", import.meta.url),
    );
    const version = await generateContent(source, output);
    const indexPath = `${version.revision}/race/index.json`;
    const index = indexArtifactSchema.parse(await readJson(output, indexPath));
    expect(index.entries.map((entry) => entry.key)).toEqual([
      "altmer",
      "argonian",
    ]);
  });
});
