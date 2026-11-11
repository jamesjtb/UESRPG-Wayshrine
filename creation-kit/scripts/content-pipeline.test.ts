// @vitest-environment jsdom
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  BIRTHSIGN_CHARGE_TABLES,
  CharacterCreator,
  SkillRank,
} from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../src/test/setup";
import {
  closeWizard,
  openWizard,
  renderForge,
  sheet,
} from "../src/features/character-forge/test/forgeTestHelpers";
import { BrowserContentCatalog } from "../src/lib/content/BrowserContentCatalog";
import { generateContent } from "./generate-content";

const contentUrl = "https://example.test/wayshrine/content/";

it("reads a small French publication through the real browser adapter", async () => {
  await mkdir("/tmp/opencode", { recursive: true });
  const root = await mkdtemp("/tmp/opencode/wayshrine-french-");
  try {
    const source = join(root, "content");
    const output = join(root, "output");
    await mkdir(join(source, "birthsigns"), { recursive: true });
    const signs = Object.fromEntries(
      BIRTHSIGN_CHARGE_TABLES.flatMap((table) => table.entries).map((key) => [
        key,
        {
          label: "{LOCALE.skills.skill.label}",
          description: "{LOCALE.skills.skill.description}",
          bonuses: [],
          starCursed: { overwriteBaseBonuses: false, bonuses: [] },
        },
      ]),
    );
    await writeFile(join(source, "birthsigns/core.yml"), JSON.stringify(signs));
    await mkdir(join(source, "skills"), { recursive: true });
    await writeFile(
      join(source, "skills/core.yml"),
      `skill:
  label: "{LOCALE.skills.skill.label}"
  description: "{LOCALE.skills.skill.description}"
  governingCharacteristics: [int]
`,
    );
    for (const language of ["en", "fr"]) {
      const directory = join(root, "locales", language, "skills");
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "core.yml"),
        `skill: {label: "${language} label", description: "${language} description"}`,
      );
    }
    const [manifest] = await generateContent(source, output, {
      languages: ["fr"],
    });
    const fetchContent = staticFileFetch(output);
    const catalog = await BrowserContentCatalog.create({
      baseUrl: "https://example.test/wayshrine/",
      language: "fr",
      fetch: fetchContent,
    });
    expect(catalog.version).toEqual(manifest!.version);
    expect(catalog.localization).toEqual(manifest!.localization);
    expect(await catalog.list("skill")).toEqual([
      { key: "skill", label: "fr label" },
    ]);
    expect(await catalog.get("skill", "skill")).toMatchObject({
      label: "fr label",
      description: "fr description",
      skillKey: "skill",
    });
    expect(
      fetchContent.mock.calls.every(([url]) =>
        String(url).startsWith(`${contentUrl}fr/`),
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(["en", "fr"])(
  "displays compiled %s content in Forge through the real catalog and creator",
  async (language) => {
    const root = await mkdtemp("/tmp/opencode/wayshrine-forge-locales-");
    try {
      // Reuse actual authored mechanics and English text. Only the leaves needed
      // to demonstrate translated presentation are test-only French authoring.
      const locales = join(root, "locales");
      await cp(resolve("../core/locales/en"), join(locales, "en"), {
        recursive: true,
      });
      await mkdir(join(locales, "fr/races"), { recursive: true });
      await mkdir(join(locales, "fr/skills"), { recursive: true });
      await writeFile(
        join(locales, "fr/races/core.yml"),
        'altmer: {label: "Haut-Elfe", description: "Description de test du Haut-Elfe."}\nbosmer: {label: "Elfe des bois", description: "Texte de test non jouable."}\n',
      );
      await writeFile(
        join(locales, "fr/skills/standard.yml"),
        'alchemy: {label: "Alchimie", description: "Description de test de l’alchimie."}\n',
      );
      const output = join(root, "output");
      const manifests = await generateContent(
        resolve("../core/content"),
        output,
        {
          languages: ["en", "fr"],
          localeDirectory: locales,
          allowEnglishFallback: true,
        },
      );
      expect(manifests[0]!.version.revision).not.toBe(
        manifests[1]!.version.revision,
      );
      const fetchContent = staticFileFetch(output);
      const catalog = await BrowserContentCatalog.create({
        baseUrl: "https://example.test/wayshrine/",
        language,
        fetch: fetchContent,
      });
      const raceLabel = language === "fr" ? "Haut-Elfe" : "Altmer";
      const skillLabel = language === "fr" ? "Alchimie" : "Alchemy";
      const race = await catalog.get("race", "altmer");
      const skill = await catalog.get("skill", "alchemy");
      expect(race?.description).toContain(
        language === "fr" ? "Description de test" : "The Altmer (or High Elves",
      );
      expect(skill?.description).toContain(
        language === "fr" ? "Description de test" : "Alchemy is the arcane art",
      );
      const user = userEvent.setup();
      renderForge(catalog);
      const name = await screen.findByRole("textbox", {
        name: "Character name",
      });
      await user.click(name);
      await user.paste("My {LOCALE} name");
      await openWizard();
      await user.click(await screen.findByRole("combobox", { name: "Race" }));
      expect(
        screen.getAllByRole("option").map((option) => option.textContent),
      ).toEqual([raceLabel, "Argonian"]);
      expect(
        screen.queryByRole("option", { name: /Bosmer|Elfe des bois/ }),
      ).toBeNull();
      await user.click(screen.getByRole("option", { name: raceLabel }));
      await screen.findByRole("checkbox", { name: skillLabel });
      expect(sheet().getByText(raceLabel)).toBeTruthy();
      expect(
        sheet().getByText(race!.description, { normalizer: (text) => text }),
      ).toBeTruthy();
      // Other offered skills explicitly fall back to English in the French set.
      expect(screen.getByRole("checkbox", { name: "Alteration" })).toBeTruthy();
      await user.click(screen.getByRole("checkbox", { name: skillLabel }));
      expect(await sheet().findByText(`${skillLabel} (Novice)`)).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Next" }));
      await closeWizard();
      await openWizard();
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("checkbox", { name: skillLabel })).toHaveProperty(
        "checked",
        true,
      );
      expect(
        sheet().getByText(race!.description, { normalizer: (text) => text }),
      ).toBeTruthy();
      expect(name).toHaveProperty("value", "My {LOCALE} name");
      expect(document.body.textContent).not.toContain("{LOCALE");
      expect(
        fetchContent.mock.calls.every(([url]) =>
          String(url).startsWith(`${contentUrl}${language}/`),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

function staticFileFetch(output: string) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    expect(url.startsWith(contentUrl)).toBe(true);
    // A static host decodes the URL once, preserving encoded definition filenames.
    const path = decodeURIComponent(url.slice(contentUrl.length));
    return new Response(await readFile(join(output, path), "utf8"), {
      headers: { "Content-Type": "application/json" },
    });
  });
}

it("uses compiled authored content through the browser catalog in a pinned creator", async () => {
  await mkdir("/tmp/opencode", { recursive: true });
  const output = await mkdtemp("/tmp/opencode/wayshrine-pipeline-");
  try {
    const source = resolve("../core/content");
    const [manifest] = await generateContent(source, output);
    const version = manifest!.version;
    const fetchContent = staticFileFetch(output);
    const catalog = await BrowserContentCatalog.create({
      baseUrl: "https://example.test/wayshrine/",
      fetch: fetchContent,
    });
    const creator = new CharacterCreator(catalog);
    expect(catalog.version).toEqual(version);
    expect(Object.isFrozen(catalog.version)).toBe(true);
    expect(fetchContent).toHaveBeenCalledTimes(1);

    const races = await catalog.list("race");
    expect(races.map(({ key }) => key)).toEqual(["altmer", "argonian"]);
    for (const summary of races) {
      expect(Object.keys(summary).sort()).toEqual(["key", "label"]);
    }

    expect((await creator.chooseRace("altmer")).ok).toBe(true);
    const snapshot = creator.getSnapshot();
    expect(snapshot.contentVersion).toEqual(version);
    expect(snapshot.pendingChoices).toHaveLength(1);
    expect(snapshot.pendingChoices[0]).toMatchObject({
      id: "altmer/magical-training",
      choose: 1,
    });
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(
      fetchContent.mock.calls.some(([url]) =>
        String(url).includes("/skill/definitions/"),
      ),
    ).toBe(false);
    for (const summary of snapshot.racialSkillOptions) {
      expect(Object.keys(summary).sort()).toEqual(["key", "label"]);
    }

    expect(
      (await creator.chooseRacialBonus("altmer/magical-training", ["alchemy"]))
        .ok,
    ).toBe(true);
    expect(creator.getSnapshot().pendingChoices).toEqual([]);
    expect(creator.getCharacterPreview().skills).toMatchObject([
      { skill: { skillKey: "alchemy" }, skillRank: SkillRank.Novice },
    ]);

    expect((await creator.chooseRace("argonian")).ok).toBe(true);
    expect(creator.getSnapshot().answers.racialBonuses).toEqual([]);
    expect(creator.getSnapshot().contentVersion).toEqual(version);
    expect(creator.getCharacterPreview().skills).toEqual([]);
    expect(creator.getCharacterPreview().race).toMatchObject({
      baselineCharacteristics: { ag: 28 },
    });

    // Indexes survive session reads; complete definitions do not remain cached.
    await catalog.get("race", "altmer");
    const paths = fetchContent.mock.calls.map(([url]) => String(url));
    expect(paths.filter((url) => url.endsWith("/manifest.json"))).toHaveLength(
      1,
    );
    expect(
      paths.filter((url) => url.endsWith("/race/index.json")),
    ).toHaveLength(1);
    expect(
      paths.filter((url) => url.endsWith("/race/definitions/altmer.json")),
    ).toHaveLength(2);
    expect(
      paths.slice(1).every((url) => url.includes(`/${version.revision}/`)),
    ).toBe(true);
    creator.dispose();
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
