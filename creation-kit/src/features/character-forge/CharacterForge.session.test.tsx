import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { HashRouter, Route, Routes } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharacterCreator } from "@wayshrine/core";
import { AppRoutes } from "../../app/routes";
import { ContentCatalogProvider } from "../../app/ContentCatalogProvider";
import { CreationKitLayout } from "../../layouts/CreationKitLayout/CreationKitLayout";
import {
  controlledReads,
  closeWizard,
  openWizard,
  expectCharacteristic,
  fillPointBuy,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";
import { CharacterForge } from "./CharacterForge";
import { createCharacteristicRoller } from "./steps/characteristics/dice";

describe("Character Forge session lifetime", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("discards generated answers on route exit and ignores an old race failure after reopening", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const old = reads.hold("race", "altmer");
    const rollDice = createCharacteristicRoller(() => 0.45);
    const load = async () => catalog;
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/#/character-sheet");
    render(
      <StrictMode>
        <MantineProvider env="test">
          <ContentCatalogProvider loadCatalog={load}>
            <HashRouter>
              <CreationKitLayout>
                <Routes>
                  <Route
                    path="/character-sheet"
                    element={<CharacterForge rollDice={rollDice} />}
                  />
                  <Route path="/" element={<h1>Home</h1>} />
                </Routes>
              </CreationKitLayout>
            </HashRouter>
          </ContentCatalogProvider>
        </MantineProvider>
      </StrictMode>,
    );
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await closeWizard();
    await user.type(
      screen.getByRole("textbox", { name: "Character name" }),
      "Old session",
    );
    await openWizard();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await fillPointBuy(user);
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 20,
      favored: true,
      total: 45,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 10,
      favored: false,
      total: 40,
    });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await selectRace("Altmer");
    expect(screen.getByRole("status", { name: "Loading race" })).toBeTruthy();
    await closeWizard();
    await user.click(screen.getByRole("link", { name: "Home" }));
    expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Character Sheet" }));
    await sheet().findByText("No race selected.");
    expect(screen.queryByText("In progress")).toBeNull();
    expect(screen.queryByText(/^Resume:/)).toBeNull();
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 0,
      favored: false,
      total: 30,
    });
    expect(sheet().getAllByRole("columnheader")).toHaveLength(9);
    expectCharacteristic("Strength", {
      baseline: 0,
      generated: 0,
      favored: false,
      total: 0,
    });
    await act(async () => old.reject(new Error("old race unavailable")));
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    expectCharacteristic("Strength", {
      baseline: 25,
      generated: 0,
      favored: false,
      total: 25,
    });
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 0,
      favored: false,
      total: 30,
    });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("checkbox", { name: "Strength" })).toHaveProperty(
      "checked",
      false,
    );
    expect(screen.getByRole("radio", { name: "Point buy" })).toHaveProperty(
      "checked",
      false,
    );
    expect(screen.getByRole("radio", { name: "Rolled" })).toHaveProperty(
      "checked",
      false,
    );
    expect(
      screen.getByRole("textbox", { name: "Character name" }),
    ).toHaveProperty("value", "");
    await user.click(screen.getByRole("radio", { name: "Point buy" }));
    expect(
      screen.getByRole("textbox", { name: "Strength points" }),
    ).toHaveProperty("value", "0");
    expect(console.error).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Something went wrong!" }),
    ).toBeNull();
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
      await closeWizard();
      await user.click(screen.getByRole("link", { name: "Home" }));
      expect(dispose.mock.calls.length).toBe(disposedBeforeExit + 1);
      expect(screen.getByRole("heading", { name: /Welcome/ })).toBeTruthy();
      await user.click(screen.getByRole("link", { name: "Character Sheet" }));
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
      expect(
        screen.queryByRole("dialog", { name: "Something went wrong!" }),
      ).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
      // StrictMode may request the loader twice; route changes must not request it again.
      const loadsBeforeEdit = load.mock.calls.length;
      await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
      await sheet().findByText("Alchemy (Novice)");
      expect(load.mock.calls.length).toBe(loadsBeforeEdit);
    },
  );
});
