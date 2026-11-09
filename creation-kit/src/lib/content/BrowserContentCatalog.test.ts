import { CharacterCreator, parseContentDefinition } from "@wayshrine/core";
import { describe, expect, it, vi } from "vitest";
import { deferred } from "../../test/content";
import { BrowserContentCatalog } from "./BrowserContentCatalog";

const version = { schemaVersion: 1, revision: "revision-one" };
const localization = {
  language: "en",
  sourceRevision: "a".repeat(64),
  allowEnglishFallback: false,
};
const manifest = { version, localization, artifactFormat: 2 };
const trait = { label: "Trait", description: "Description", params: ["X"] };
const index = {
  ...manifest,
  kind: "trait",
  entries: [{ key: "trait", label: "Trait" }],
};
const definition = {
  ...manifest,
  kind: "trait",
  key: "trait",
  definition: trait,
};
const baseUrl = "https://example.test/tools/";
const manifestUrl = `${baseUrl}content/en/manifest.json`;
const indexUrl = `${baseUrl}content/en/${version.revision}/trait/index.json`;
const definitionUrl = `${baseUrl}content/en/${version.revision}/trait/definitions/trait.json`;

function fixture() {
  const responses = new Map<string, unknown>([
    [manifestUrl, manifest],
    [indexUrl, index],
    [definitionUrl, definition],
  ]);
  const fetchContent = vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (!responses.has(url)) return new Response(null, { status: 404 });
    return Response.json(responses.get(url));
  });
  function create() {
    return BrowserContentCatalog.create({ baseUrl, fetch: fetchContent });
  }
  return { responses, fetchContent, create };
}

describe("BrowserContentCatalog", () => {
  it("selects an explicit canonical language and pins localization metadata", async () => {
    const { fetchContent, responses } = fixture();
    const french = {
      ...manifest,
      localization: { ...localization, language: "fr" },
    };
    responses.set(`${baseUrl}content/fr/manifest.json`, french);
    const catalog = await BrowserContentCatalog.create({
      baseUrl,
      language: "fr",
      fetch: fetchContent,
    });
    expect(catalog.localization).toEqual(french.localization);
    expect(Object.isFrozen(catalog.localization)).toBe(true);
    expect(fetchContent).toHaveBeenCalledExactlyOnceWith(
      `${baseUrl}content/fr/manifest.json`,
    );
    await expect(
      BrowserContentCatalog.create({
        baseUrl,
        language: "EN",
        fetch: fetchContent,
      }),
    ).rejects.toMatchObject({ code: "invalid-content" });
    responses.set(`${baseUrl}content/fr/manifest.json`, manifest);
    await expect(
      BrowserContentCatalog.create({
        baseUrl,
        language: "fr",
        fetch: fetchContent,
      }),
    ).rejects.toMatchObject({ code: "content-version-mismatch" });
  });

  it.each(["index", "definition"])(
    "rejects mixed localization and incompatible formats in %s",
    async (resource) => {
      const { create, responses } = fixture();
      const catalog = await create();
      const url = resource === "index" ? indexUrl : definitionUrl;
      const artifact = resource === "index" ? index : definition;
      for (const changed of [
        { language: "fr" },
        { sourceRevision: "b".repeat(64) },
        { allowEnglishFallback: true },
      ]) {
        responses.set(url, {
          ...artifact,
          localization: { ...localization, ...changed },
        });
        await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
          code: "content-version-mismatch",
        });
      }
      responses.set(url, { ...artifact, artifactFormat: 1 });
      await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
        code: "incompatible-content",
      });
    },
  );

  it("rejects unsupported manifest formats", async () => {
    const { create, responses } = fixture();
    responses.set(manifestUrl, { ...manifest, artifactFormat: 1 });
    await expect(create()).rejects.toMatchObject({
      code: "incompatible-content",
    });
  });

  it("loads only the manifest, relevant lightweight index, and requested definition", async () => {
    const { create, fetchContent } = fixture();
    const catalog = await create();
    expect(fetchContent.mock.calls.map(([url]) => url)).toEqual([manifestUrl]);
    expect(catalog.version).toEqual(version);
    expect(Object.isFrozen(catalog.version)).toBe(true);
    expect(Object.isFrozen(catalog)).toBe(true);
    expect(await catalog.list("trait")).toEqual(index.entries);
    expect(await catalog.get("trait", "trait")).toEqual(
      parseContentDefinition("trait", "trait", trait),
    );
    expect(fetchContent.mock.calls.map(([url]) => url)).toEqual([
      manifestUrl,
      indexUrl,
      definitionUrl,
    ]);
  });

  it("returns undefined only for absent keys, not indexed missing files", async () => {
    const { create, responses, fetchContent } = fixture();
    const catalog = await create();
    expect(await catalog.get("trait", "absent")).toBeUndefined();
    expect(fetchContent).toHaveBeenCalledTimes(2);
    responses.delete(definitionUrl);
    await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
      code: "content-unavailable",
    });
  });

  it.each([
    {
      value: { ...manifest, version: { schemaVersion: 2, revision: "new" } },
      code: "incompatible-content",
    },
    { value: { schemaVersion: 0, revision: "new" }, code: "invalid-content" },
    { value: { schemaVersion: 1, revision: "" }, code: "invalid-content" },
    { value: { schemaVersion: 1 }, code: "invalid-content" },
    { value: { ...version, extra: true }, code: "invalid-content" },
  ])("rejects invalid/unsupported manifest $value", async ({ value, code }) => {
    const { create, responses } = fixture();
    responses.set(manifestUrl, value);
    await expect(create()).rejects.toMatchObject({ code });
  });

  it.each(["index", "definition"])(
    "validates %s response version before returning data",
    async (resource) => {
      const { create, responses } = fixture();
      const url = resource === "index" ? indexUrl : definitionUrl;
      const artifact = resource === "index" ? index : definition;
      const catalog = await create();
      responses.set(url, {
        ...artifact,
        version: { ...version, revision: "other" },
      });
      await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
        code: "content-version-mismatch",
      });
      responses.set(url, {
        ...artifact,
        version: { ...version, schemaVersion: 2 },
      });
      await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
        code: "incompatible-content",
      });
    },
  );

  it.each([
    { resource: "index", value: { ...index, kind: "skill" } },
    {
      resource: "index",
      value: {
        ...index,
        entries: [{ key: "trait", label: "Trait", definition: trait }],
      },
    },
    { resource: "index", value: { ...index, version: null } },
    { resource: "definition", value: { ...definition, kind: "race" } },
    { resource: "definition", value: { ...definition, key: "other" } },
    {
      resource: "definition",
      value: { ...definition, definition: { ...trait, hostId: "no" } },
    },
    { resource: "definition", value: { ...definition, definition: {} } },
    { resource: "definition", value: { kind: "trait" } },
  ])(
    "rejects malformed $resource envelopes/payloads",
    async ({ resource, value }) => {
      const { create, responses } = fixture();
      responses.set(resource === "index" ? indexUrl : definitionUrl, value);
      const catalog = await create();
      await expect(catalog.get("trait", "trait")).rejects.toMatchObject({
        code: "invalid-content",
      });
    },
  );

  it.each([
    { status: 401, code: "content-access-denied" },
    { status: 403, code: "content-access-denied" },
    { status: 404, code: "content-unavailable" },
    { status: 500, code: "content-unavailable" },
  ])("classifies HTTP $status", async ({ status, code }) => {
    const fetchContent = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status }));
    await expect(
      BrowserContentCatalog.create({ baseUrl, fetch: fetchContent }),
    ).rejects.toMatchObject({ code });
  });

  it("classifies network and malformed JSON failures with causes", async () => {
    const cause = new TypeError("offline");
    const fetchContent = vi.fn<typeof fetch>().mockRejectedValueOnce(cause);
    await expect(
      BrowserContentCatalog.create({ baseUrl, fetch: fetchContent }),
    ).rejects.toMatchObject({ code: "content-unavailable", cause });
    fetchContent.mockResolvedValueOnce(new Response("not json"));
    await expect(
      BrowserContentCatalog.create({ baseUrl, fetch: fetchContent }),
    ).rejects.toMatchObject({
      code: "invalid-content",
      cause: expect.any(Error),
    });
  });

  it.each([
    { key: "a/b", filename: "a%252Fb.json" },
    { key: "a%2Fb", filename: "a%25252Fb.json" },
    { key: "../index", filename: "%252E%252E%252Findex.json" },
    { key: ".", filename: "%252E.json" },
    { key: "index", filename: "index.json" },
  ])(
    "encodes disk filenames again for $key under a subdirectory hash route",
    async ({ key, filename }) => {
      window.history.replaceState(null, "", "/tools/#/character-forge");
      const { fetchContent, responses } = fixture();
      responses.set(indexUrl, { ...index, entries: [{ key, label: "Trait" }] });
      const url = `${baseUrl}content/en/${version.revision}/trait/definitions/${filename}`;
      responses.set(url, { ...definition, key });
      const catalog = await BrowserContentCatalog.create({
        baseUrl: new URL("./", baseUrl).href,
        fetch: fetchContent,
      });
      expect(await catalog.get("trait", key)).toEqual(trait);
      expect(fetchContent).toHaveBeenLastCalledWith(url);
    },
  );

  it("resolves Vite's relative base against the document, not its hash route", async () => {
    window.history.replaceState(null, "", "/tools/#/character-forge");
    const fetchContent = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(manifest));
    await BrowserContentCatalog.create({ baseUrl: "./", fetch: fetchContent });
    expect(fetchContent).toHaveBeenCalledWith(
      `${window.location.origin}/tools/content/en/manifest.json`,
    );
  });

  it("deduplicates pending indexes and definitions, detaches callers, and releases settled definitions", async () => {
    const { create, fetchContent } = fixture();
    const catalog = await create();
    const pendingIndex = deferred<Response>();
    fetchContent.mockReturnValueOnce(pendingIndex.promise);
    const firstList = catalog.list("trait");
    const secondList = catalog.list("trait");
    expect(fetchContent).toHaveBeenCalledTimes(2);
    pendingIndex.resolve(Response.json(index));
    const [leftIndex, rightIndex] = await Promise.all([firstList, secondList]);
    expect(leftIndex).not.toBe(rightIndex);
    expect(leftIndex[0]).not.toBe(rightIndex[0]);
    Object.assign(leftIndex[0]!, { label: "mutated" });
    expect(await catalog.list("trait")).toEqual(index.entries);

    const pendingDefinition = deferred<Response>();
    fetchContent.mockReturnValueOnce(pendingDefinition.promise);
    const first = catalog.get("trait", "trait");
    const second = catalog.get("trait", "trait");
    await vi.waitFor(() => expect(fetchContent).toHaveBeenCalledTimes(3));
    pendingDefinition.resolve(Response.json(definition));
    const [left, right] = await Promise.all([first, second]);
    Object.assign(left!.params!, { 0: "mutated" });
    expect(right).toEqual(trait);
    expect(await catalog.get("trait", "trait")).toEqual(trait);
    expect(fetchContent).toHaveBeenCalledTimes(4);
  });

  it.each(["index", "definition"])(
    "deduplicates failed %s reads and permits retry",
    async (resource) => {
      const { create, fetchContent } = fixture();
      const catalog = await create();
      if (resource === "definition") await catalog.list("trait");
      const pending = deferred<Response>();
      fetchContent.mockReturnValueOnce(pending.promise);
      const first = catalog.get("trait", "trait");
      const second = catalog.get("trait", "trait");
      const settled = Promise.allSettled([first, second]);
      await vi.waitFor(() =>
        expect(fetchContent).toHaveBeenCalledTimes(
          resource === "index" ? 2 : 3,
        ),
      );
      pending.reject(new Error("offline"));
      const results = await settled;
      expect(results.map((result) => result.status)).toEqual([
        "rejected",
        "rejected",
      ]);
      expect(await catalog.get("trait", "trait")).toEqual(trait);
    },
  );

  it("shares a browser catalog between creators without sharing answers or disposal", async () => {
    const { create, responses } = fixture();
    const race = {
      label: "Race",
      description: "",
      racialTraits: [],
      baselineCharacteristics: {
        str: 20,
        end: 20,
        ag: 20,
        int: 20,
        wp: 20,
        prc: 20,
        prs: 20,
      },
      racialBonuses: [
        {
          bonusType: "skill",
          choiceGroups: [{ id: "training", choose: 1, options: ["skill"] }],
        },
      ],
    };
    responses.set(`${baseUrl}content/en/${version.revision}/race/index.json`, {
      ...manifest,
      kind: "race",
      entries: [{ key: "race", label: "Race" }],
    });
    responses.set(
      `${baseUrl}content/en/${version.revision}/race/definitions/race.json`,
      { ...manifest, kind: "race", key: "race", definition: race },
    );
    responses.set(`${baseUrl}content/en/${version.revision}/skill/index.json`, {
      ...manifest,
      kind: "skill",
      entries: [{ key: "skill", label: "Skill" }],
    });
    responses.set(
      `${baseUrl}content/en/${version.revision}/skill/definitions/skill.json`,
      {
        ...manifest,
        kind: "skill",
        key: "skill",
        definition: { skillKey: "skill", governingCharacteristics: ["int"] },
      },
    );
    const catalog = await create();
    const first = new CharacterCreator(catalog);
    const second = new CharacterCreator(catalog);
    await Promise.all([first.chooseRace("race"), second.chooseRace("race")]);
    expect((await first.chooseRacialBonus("race/training", ["skill"])).ok).toBe(
      true,
    );
    expect(second.getSnapshot().racialBonusChoices[0]?.selections).toEqual([]);
    first.dispose();
    expect(
      (await second.chooseRacialBonus("race/training", ["skill"])).ok,
    ).toBe(true);
    expect(await catalog.list("race")).toHaveLength(1);
    second.dispose();
  });
});
