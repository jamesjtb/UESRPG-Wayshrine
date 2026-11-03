import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { HashRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "@wayshrine/core";
import { AppRoutes } from "../../app/routes";
import { ContentCatalogProvider } from "../../app/ContentCatalogProvider";
import { CreationKitLayout } from "../../layouts/CreationKitLayout/CreationKitLayout";
import { controlledReads, selectRace, sheet } from "./forgeTestHelpers";
import { fixtureCatalog } from "./testCatalog";

describe("Character Forge session lifetime", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each([
    { kind: "race", key: "altmer", outcome: "success" },
    { kind: "race", key: "altmer", outcome: "failure" },
    { kind: "skill", key: "alchemy", outcome: "success" },
    { kind: "skill", key: "alchemy", outcome: "failure" },
  ] as const)(
    "ignores late $kind $outcome after route exit and keeps the returning session fresh",
    async ({ kind, key, outcome }) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const old = reads.hold(kind, key);
      const load = vi.fn(async () => catalog);
      const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
      const user = userEvent.setup();
      window.history.replaceState(null, "", "/#/character-forge");
      render(
        <StrictMode>
          <MantineProvider env="test">
            <ContentCatalogProvider loadCatalog={load}>
              <HashRouter>
                <CreationKitLayout>
                  <AppRoutes />
                </CreationKitLayout>
              </HashRouter>
            </ContentCatalogProvider>
          </MantineProvider>
        </StrictMode>,
      );
      await selectRace("Altmer");
      if (kind === "skill")
        await user.click(
          await screen.findByRole("checkbox", { name: "Alchemy" }),
        );
      const disposedBeforeExit = dispose.mock.calls.length;
      const loadsBeforeExit = load.mock.calls.length;
      await user.click(screen.getByRole("link", { name: "Home" }));
      expect(dispose.mock.calls.length).toBe(disposedBeforeExit + 1);
      expect(screen.getByRole("heading", { name: /Welcome/ })).toBeTruthy();
      await user.click(screen.getByRole("link", { name: "Character Forge" }));
      expect(load.mock.calls.length).toBe(loadsBeforeExit);
      expect(await sheet().findByText("No race selected.")).toBeTruthy();
      await selectRace("Altmer");
      await screen.findByRole("checkbox", { name: "Alchemy" });
      expect(sheet().getByText("No skills.")).toBeTruthy();
      await act(async () => {
        if (outcome === "success") old.resolve();
        else old.reject(new Error("unmounted selection"));
      });
      expect(sheet().getByText("Altmer")).toBeTruthy();
      expect(sheet().getByText("No skills.")).toBeTruthy();
      expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
        "checked",
        false,
      );
      expect(screen.queryByRole("status", { name: /Loading/ })).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
      // StrictMode may request the loader twice; route changes must not request it again.
      const loadsBeforeEdit = load.mock.calls.length;
      await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
      await sheet().findByText("Alchemy (Novice)");
      expect(load.mock.calls.length).toBe(loadsBeforeEdit);
    },
  );
});
