// @vitest-environment jsdom
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CharacterCreator, SkillRank } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { BrowserContentCatalog } from "../src/lib/content/BrowserContentCatalog";
import { generateContent } from "./generate-content";

const contentUrl = "https://example.test/wayshrine/content/";

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
    const version = await generateContent(source, output);
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
