import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentCatalog, ContentVersion } from "@wayshrine/core";
import { BrowserContentCatalog } from "../../lib/content/BrowserContentCatalog";
import { contentKinds } from "../../lib/content/artifacts";
import { deferred } from "../../test/content";
import {
  controlledReads,
  expectNavigationBlocked,
  expectRaceCanAdvance,
  expectCharacteristicBaseline,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";

function changedVersion(
  version: ContentVersion,
  field: string,
): ContentVersion {
  if (field === "schema") return { ...version, schemaVersion: 3 };
  return { ...version, revision: "changed" };
}

describe("Character Forge content validation", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each(["missing trait", "missing parameter", "extra parameter"])(
    "reports %s as a content error, without applying racial effects",
    async (problem) => {
      const catalog = fixtureCatalog((definitions) => {
        if (problem === "missing trait") delete definitions.trait.magicWeakness;
        if (problem === "missing parameter")
          definitions.trait.magicWeakness!.params = ["type", "X", "required"];
        if (problem === "extra parameter")
          definitions.trait.magicWeakness!.params = ["type"];
      });
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Altmer");
      await screen.findByRole("dialog", { name: "Something went wrong!" });
      expect(console.error).toHaveBeenCalledWith(
        "Character content selection failed.",
        expect.arrayContaining([
          expect.objectContaining({ code: "invalid-race-definition" }),
        ]),
      );
      expect(sheet().getByText("No race selected.")).toBeTruthy();
      expectCharacteristicBaseline("Intelligence", 0);
      expect(sheet().queryByText(/Magic Weakness/)).toBeNull();
      expectNavigationBlocked();
      await user.click(screen.getByRole("button", { name: "OK" }));
      expect(
        screen.queryByText(/Unknown racial trait|Incorrect parameters/),
      ).toBeNull();
      expectNavigationBlocked();
    },
  );

  it("does not repair a missing unselected option or grant the available selection", async () => {
    const catalog = fixtureCatalog((definitions) => {
      delete definitions.skill.alteration;
    });
    const get = vi.spyOn(catalog, "get");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-choice-definition",
          choiceId: "altmer/magic",
        }),
      ]),
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("checkbox", { name: "Alteration" })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      true,
    );
    expect(sheet().getByText("No skills.")).toBeTruthy();
    expect(get).not.toHaveBeenCalledWith("skill", "alchemy");
    expectNavigationBlocked();
  });

  it("treats an indexed but absent selected definition as a failed skill read, not a user mistake", async () => {
    const catalog = fixtureCatalog();
    const original = catalog.get.bind(catalog);
    catalog.get = async (kind, key) => {
      if (kind === "skill" && key === "alchemy") return undefined;
      return original(kind, key);
    };
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-content",
          message: "Selected skill is missing: alchemy.",
        }),
      ]),
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(
      screen.getByRole("button", { name: "Retry skill selection" }),
    ).toBeTruthy();
    expect(sheet().getByText("No skills.")).toBeTruthy();
    expectNavigationBlocked();
  });

  it("reports an offered race whose definition disappeared without replacing the committed race", async () => {
    const catalog = fixtureCatalog();
    const original = catalog.get.bind(catalog);
    catalog.get = async (kind, key) => {
      if (kind === "race" && key === "altmer") return undefined;
      return original(kind, key);
    };
    renderForge(catalog);
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await selectRace("Altmer");
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      [{ code: "unknown-race", message: "Unknown race." }],
    );
    expect(sheet().getByText("Argonian")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
      "value",
      "Argonian",
    );
    expect(screen.queryByRole("status", { name: "Loading race" })).toBeNull();
    expectRaceCanAdvance();
  });

  it.each(["schema", "revision"])(
    "blocks effects when the catalog's %s changes during a pending skill read",
    async (field) => {
      const fixture = fixtureCatalog();
      let version = fixture.version;
      const catalog: ContentCatalog = {
        ...fixture,
        get version() {
          return version;
        },
      };
      const reads = controlledReads(catalog);
      const skill = reads.hold("skill", "alchemy");
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Altmer");
      await user.click(
        await screen.findByRole("checkbox", { name: "Alchemy" }),
      );
      version = changedVersion(version, field);
      await act(async () => skill.resolve());
      await screen.findByRole("dialog", { name: "Something went wrong!" });
      expect(console.error).toHaveBeenCalledWith(
        "Character content selection failed.",
        expect.arrayContaining([
          expect.objectContaining({ code: "content-version-mismatch" }),
        ]),
      );
      expect(sheet().getByText("No skills.")).toBeTruthy();
      expectCharacteristicBaseline("Intelligence", 30);
      expectNavigationBlocked();
    },
  );

  it.each(["schema", "revision"])(
    "shows a generic modal when a browser race response changes %s during the request",
    async (field) => {
      const fixture = fixtureCatalog();
      const response = deferred<Response>();
      const manifest = {
        version: fixture.version,
        artifactFormat: 2,
        localization: {
          language: "en",
          sourceRevision: "a".repeat(64),
          allowEnglishFallback: false,
        },
      };
      const fetchContent = vi.fn<typeof fetch>(async (input) => {
        const url = String(input);
        if (url.endsWith("manifest.json")) return Response.json(manifest);
        const kind = contentKinds.find((candidate) =>
          url.includes(`/${candidate}/`),
        );
        if (!kind) throw new Error(`Unexpected fixture URL: ${url}`);
        if (url.endsWith("index.json"))
          return Response.json({
            ...manifest,
            kind,
            entries: await fixture.list(kind),
          });
        return response.promise;
      });
      const catalog = await BrowserContentCatalog.create({
        baseUrl: "http://localhost/",
        fetch: fetchContent,
      });
      renderForge(catalog);
      await selectRace("Altmer");
      await waitFor(() =>
        expect(fetchContent).toHaveBeenCalledWith(
          expect.stringContaining("/race/definitions/altmer.json"),
        ),
      );
      const version = changedVersion(fixture.version, field);
      await act(async () =>
        response.resolve(
          Response.json({
            ...manifest,
            version,
            kind: "race",
            key: "altmer",
            definition: await fixture.get("race", "altmer"),
          }),
        ),
      );
      await screen.findByRole("dialog", { name: "Something went wrong!" });
      let code = "content-version-mismatch";
      if (field === "schema") code = "incompatible-content";
      expect(console.error).toHaveBeenCalledWith(
        "Character content selection failed.",
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
      expect(
        screen.queryByText(
          /Content revision changed|Unsupported content schema|http:\/\/localhost/,
        ),
      ).toBeNull();
      expect(sheet().getByText("No race selected.")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Retry race selection" }),
      ).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading race" })).toBeNull();
      expectNavigationBlocked();
    },
  );
});
