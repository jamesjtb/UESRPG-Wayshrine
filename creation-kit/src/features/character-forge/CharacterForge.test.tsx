import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "@wayshrine/core";
import type { ContentCatalog, ContentSummary } from "@wayshrine/core";
import {
  ContentCatalogProvider,
  ContentCatalogStatus,
} from "../../app/ContentCatalogProvider";
import { deferred } from "../../test/content";
import { CharacterForge } from "./CharacterForge";
import { fixtureCatalog } from "./testCatalog";
import { App } from "../../app/App";
import { BrowserContentCatalog } from "../../lib/content/BrowserContentCatalog";
import { contentKinds } from "../../lib/content/artifacts";

function renderForge(catalog = fixtureCatalog()) {
  return render(
    <StrictMode>
      <MantineProvider env="test">
        <ContentCatalogProvider loadCatalog={async () => catalog}>
          <ContentCatalogStatus />
          <CharacterForge />
        </ContentCatalogProvider>
      </MantineProvider>
    </StrictMode>,
  );
}

async function selectRace(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("combobox", { name: "Race" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

function nextButton() {
  return screen.getByRole("button", { name: "Next" });
}

function preview() {
  return within(
    screen.getByRole("heading", { name: "Unnamed Character (Draft)" })
      .parentElement!,
  );
}

describe("Character Forge race editing", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("acknowledges a browser catalog JSON failure without unblocking the failed selection", async () => {
    const user = userEvent.setup();
    const error = vi.mocked(console.error);
    const fixture = fixtureCatalog();
    let fail = true;
    const fetchContent = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("manifest.json")) return Response.json(fixture.version);
      const kind = contentKinds.find((candidate) =>
        url.includes(`/${candidate}/`),
      );
      if (!kind) throw new Error(`Unexpected fixture URL: ${url}`);
      if (url.endsWith("index.json")) {
        return Response.json({
          version: fixture.version,
          kind,
          entries: await fixture.list(kind),
        });
      }
      if (fail)
        return new Response("<html>Not JSON</html>", {
          headers: { "Content-Type": "text/html" },
        });
      const filename = new URL(url).pathname.split("/").at(-1)!;
      const key = decodeURIComponent(filename.slice(0, -".json".length));
      return Response.json({
        version: fixture.version,
        kind,
        key,
        definition: await fixture.get(kind, key),
      });
    });
    const catalog = await BrowserContentCatalog.create({
      baseUrl: "http://localhost/",
      fetch: fetchContent,
    });
    renderForge(catalog);
    await selectRace("Altmer");
    const modal = await screen.findByRole("dialog", {
      name: "Something went wrong!",
    });
    expect(within(modal).getByRole("button", { name: "OK" })).toBeTruthy();
    expect(error).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid-content",
          message: expect.stringContaining("Invalid JSON:"),
        }),
      ]),
    );
    expect(screen.queryByText(/Invalid JSON:|http:\/\/localhost/)).toBeNull();
    await user.click(within(modal).getByRole("button", { name: "OK" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(screen.queryByRole("status", { name: "Loading race" })).toBeNull();
    expect(preview().queryByText("Int: 30")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry race selection" }),
    ).toBeTruthy();
    // A separate UI state change must not re-announce the acknowledged failure.
    await user.click(screen.getByRole("combobox", { name: "Race" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Retry race selection" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Something went wrong!" }),
    ).toBeTruthy();
    expect(error).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole("button", { name: "OK" }));
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Retry race selection" }),
    );
    await screen.findByRole("checkbox", { name: "Alchemy" });
    expect(preview().getByText("Int: 30")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("uses the shell's single initialization notice and starts editing only after content retry", async () => {
    const user = userEvent.setup();
    const catalog = fixtureCatalog();
    const list = vi.spyOn(catalog, "list");
    const pending = deferred<ContentCatalog>();
    const loadCatalog = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(catalog);
    window.history.replaceState(null, "", "/#/character-forge");
    render(<App loadCatalog={loadCatalog} />);
    expect(
      screen.getAllByRole("status", { name: "Loading content" }),
    ).toHaveLength(1);
    expect(screen.queryByRole("status", { name: "Loading races" })).toBeNull();
    expect(list).not.toHaveBeenCalled();
    const failure = new Error("offline");
    await act(async () => pending.reject(failure));
    expect(
      await screen.findAllByRole("dialog", { name: "Something went wrong!" }),
    ).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      "Content initialization failed.",
      failure,
    );
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.click(screen.getByRole("button", { name: "Retry content" }));
    await screen.findByRole("combobox", { name: "Race" });
    expect(list).toHaveBeenCalledWith("race");
  });

  it("loads only summaries while browsing, then renders Core baselines, traits and selected Novice skills", async () => {
    const user = userEvent.setup();
    const finish = vi.spyOn(CharacterCreator.prototype, "finish");
    const next = vi.spyOn(CharacterCreator.prototype, "next");
    const catalog = fixtureCatalog();
    const get = vi.spyOn(catalog, "get");
    renderForge(catalog);
    await screen.findByRole("combobox", { name: "Race" });
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText("Str: 0")).toBeNull();
    expect(preview().getByText("No race selected.")).toBeTruthy();
    expect(screen.queryByText(/No final statistics/)).toBeNull();
    await selectRace("Altmer");
    await screen.findByRole("checkbox", { name: "Alchemy" });
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(
      screen.queryByRole("button", { name: "Confirm race choices" }),
    ).toBeNull();
    const stepNavigation = within(
      screen.getByRole("navigation", { name: "Character creation navigation" }),
    );
    expect(stepNavigation.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(stepNavigation.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(preview().getByText("Altmer")).toBeTruthy();
    expect(preview().getByRole("heading", { name: "Traits" })).toBeTruthy();
    expect(preview().getByRole("heading", { name: "Skills" })).toBeTruthy();
    expect(preview().getByText("No skills.")).toBeTruthy();
    expect(preview().getByText("Int: 30")).toBeTruthy();
    expect(
      preview().getByText("Magic Weakness (Type: magic, X: 2)"),
    ).toBeTruthy();
    expect(
      preview().getByRole("heading", { name: "Characteristics" }),
    ).toBeTruthy();
    expect(preview().queryByText(/Baselines only/)).toBeNull();
    expect(screen.getByText("Choose 1").tagName).toBe("STRONG");
    expect(screen.queryByText(/Choose exactly/)).toBeNull();
    expect(screen.queryByText(/\{LOCALE/)).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
    expect(await preview().findByText("Alchemy (Novice)")).toBeTruthy();
    expect(stepNavigation.getByRole("button", { name: "Back" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(stepNavigation.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(get.mock.calls.filter(([kind]) => kind === "skill")).toEqual([
      ["skill", "alchemy"],
    ]);
    expect(
      screen.queryByRole("button", { name: "Confirm race choices" }),
    ).toBeNull();
    expect(screen.queryByText(/Race choices confirmed/)).toBeNull();
    await user.click(nextButton());
    expect(finish).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "Alteration" }));
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.getByRole("checkbox", { name: "Alteration" })).toHaveProperty(
      "checked",
      true,
    );
    expect(preview().queryByText("Alchemy (Novice)")).toBeNull();
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText(/Choose exactly/)).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
    expect(await preview().findByText("Alteration (Novice)")).toBeTruthy();
    await selectRace("Argonian");
    await waitFor(() => expect(screen.queryByRole("checkbox")).toBeNull());
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(preview().getByText("A plain description.")).toBeTruthy();
    expect(preview().queryByText("Alteration (Novice)")).toBeNull();
  });

  it("renders choose-two, overlapping and choose-zero groups uniformly with Core-only effects", async () => {
    const user = userEvent.setup();
    renderForge();
    await selectRace("Many choices");
    const pair = within(await screen.findByRole("group", { name: "Choose 2" }));
    const overlap = within(screen.getByRole("group", { name: "Choose 1" }));
    const none = within(screen.getByRole("group", { name: "Choose 0" }));
    await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
    expect(preview().queryByText("Alchemy (Novice)")).toBeNull();
    await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
    await user.click(overlap.getByRole("checkbox", { name: "Alchemy" }));
    await preview().findByText("Alteration (Novice)");
    expect(preview().getAllByText("Alchemy (Novice)")).toHaveLength(1);
    expect(preview().getByText("Alteration (Novice)")).toBeTruthy();
    await user.click(none.getByRole("checkbox", { name: "Alchemy" }));
    expect(none.getByRole("checkbox")).toHaveProperty("checked", true);
    expect(nextButton()).toHaveProperty("disabled", true);
    await user.click(none.getByRole("checkbox", { name: "Alchemy" }));
    expect(none.getByRole("checkbox")).toHaveProperty("checked", false);
    expect(nextButton()).toHaveProperty("disabled", true);
  });

  it("shows race-index loading and retryable failures without preloading definitions", async () => {
    const catalog = fixtureCatalog();
    const pending = deferred<readonly ContentSummary[]>();
    const originalList = catalog.list.bind(catalog);
    let failed = true;
    vi.spyOn(catalog, "list").mockImplementation((kind) => {
      if (kind !== "race") return originalList(kind);
      return failed ? pending.promise : originalList(kind);
    });
    const get = vi.spyOn(catalog, "get");
    const user = userEvent.setup();
    renderForge(catalog);
    expect(
      await screen.findByRole("status", { name: "Loading races" }),
    ).toBeTruthy();
    const failure = new Error("offline index URL");
    await act(async () => pending.reject(failure));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledWith(
      "Race index loading failed.",
      failure,
    );
    expect(screen.queryByText(/offline index URL/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "OK" }));
    failed = false;
    await user.click(screen.getByRole("button", { name: "Retry races" }));
    await screen.findByRole("combobox", { name: "Race" });
    expect(get).not.toHaveBeenCalled();
  });

  it("suppresses stale preview during a failed race change and lets the user cancel or retry", async () => {
    const catalog = fixtureCatalog();
    const originalGet = catalog.get.bind(catalog);
    let fail = true;
    catalog.get = async (kind, key) => {
      if (kind === "race" && key === "argonian" && fail)
        throw new Error("offline");
      return originalGet(kind, key);
    };
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await screen.findByRole("checkbox", { name: "Alchemy" });
    await selectRace("Argonian");
    await screen.findByRole("button", { name: "Retry race selection" });
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(preview().queryByText("Int: 30")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
      "disabled",
      false,
    );
    await user.click(
      screen.getByRole("button", { name: "Cancel race selection" }),
    );
    expect(preview().getByText("Altmer")).toBeTruthy();
    await selectRace("Argonian");
    await screen.findByRole("button", { name: "Retry race selection" });
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    await user.click(screen.getByRole("button", { name: "OK" }));
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Retry race selection" }),
    );
    expect(await preview().findByText("A plain description.")).toBeTruthy();
  });

  it("lets failed skill definitions be retried without losing the answer", async () => {
    const catalog = fixtureCatalog();
    const originalGet = catalog.get.bind(catalog);
    let fail = true;
    catalog.get = async (kind, key) => {
      if (kind === "skill" && fail) throw new Error("offline");
      return originalGet(kind, key);
    };
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
    await screen.findByRole("button", { name: "Retry skill selection" });
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      expect.arrayContaining([
        expect.objectContaining({ code: "content-unavailable" }),
      ]),
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      true,
    );
    expect(screen.queryByRole("status", { name: "Loading skills" })).toBeNull();
    expect(nextButton()).toHaveProperty("disabled", true);
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Retry skill selection" }),
    );
    expect(await preview().findByText("Alchemy (Novice)")).toBeTruthy();
  });

  it("creates fresh StrictMode sessions and disposes them without touching the shared catalog", async () => {
    const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
    const catalog: ContentCatalog = fixtureCatalog();
    const { unmount } = renderForge(catalog);
    await selectRace("Argonian");
    await preview().findByText("Argonian");
    expect(dispose.mock.calls.length).toBeGreaterThan(0);
    const before = dispose.mock.calls.length;
    unmount();
    expect(dispose.mock.calls.length).toBe(before + 1);
    expect(await catalog.list("race")).toHaveLength(3);
  });

  it("ignores an obsolete race failure without logging or opening a modal", async () => {
    const catalog = fixtureCatalog();
    const originalGet = catalog.get.bind(catalog);
    const pending = deferred<void>();
    catalog.get = async (kind, key) => {
      if (kind === "race" && key === "altmer") await pending.promise;
      return originalGet(kind, key);
    };
    renderForge(catalog);
    await selectRace("Altmer");
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    await selectRace("Argonian");
    await preview().findByText("Argonian");
    await act(async () => pending.reject(new Error("obsolete JSON failure")));
    expect(preview().getByText("Argonian")).toBeTruthy();
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("shows scoped race and skill spinners without hiding valid sheet sections during skill loading", async () => {
    const catalog = fixtureCatalog();
    const originalGet = catalog.get.bind(catalog);
    const race = deferred<void>();
    const skill = deferred<void>();
    catalog.get = async (kind, key) => {
      if (kind === "race" && key === "altmer") await race.promise;
      if (kind === "skill" && key === "alchemy") await skill.promise;
      return originalGet(kind, key);
    };
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    const editor = within(
      screen.getByRole("region", { name: "Character editor" }),
    );
    const sheet = within(
      screen.getByRole("region", { name: "Character sheet" }),
    );
    expect(
      editor.getAllByRole("status", { name: "Loading race" }),
    ).toHaveLength(1);
    expect(sheet.getByText("No race selected.")).toBeTruthy();
    expect(sheet.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Content is still loading.")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    await act(async () => race.resolve());
    await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
    expect(
      editor.getAllByRole("status", { name: "Loading skills" }),
    ).toHaveLength(1);
    expect(editor.queryByRole("status", { name: "Loading race" })).toBeNull();
    expect(sheet.getByText("Altmer")).toBeTruthy();
    expect(sheet.getByText("Int: 30")).toBeTruthy();
    expect(sheet.getByText("Magic Weakness (Type: magic, X: 2)")).toBeTruthy();
    expect(sheet.queryByText("Alchemy (Novice)")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(nextButton()).toHaveProperty("disabled", true);
    expect(screen.queryByText("Content is still loading.")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => skill.resolve());
    expect(await sheet.findByText("Alchemy (Novice)")).toBeTruthy();
    expect(editor.queryByRole("status", { name: "Loading skills" })).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });
});
