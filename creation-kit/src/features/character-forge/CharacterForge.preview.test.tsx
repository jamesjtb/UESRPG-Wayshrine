import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import { fixtureCatalog } from "./test/testCatalog";
import {
  controlledReads,
  closeWizard,
  openWizard,
  expectCharacteristic,
  fillPointBuy,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

it("suppresses generation during pending/failed race changes, restores on cancel, and recalculates against a new race", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  const catalog = fixtureCatalog((definitions) => {
    const argonian = definitions.race.argonian!;
    argonian.baselineCharacteristics = {
      ...argonian.baselineCharacteristics,
      str: 18,
      int: 22,
    };
  });
  const reads = controlledReads(catalog);
  const failure = reads.hold("race", "altmer");
  const user = userEvent.setup();
  renderForge(
    catalog,
    createCharacteristicRoller(() => 0.45),
  );
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await closeWizard();
  await user.type(
    screen.getByRole("textbox", { name: "Character name" }),
    "Keira",
  );
  await openWizard();
  await user.click(screen.getByRole("button", { name: "Next" }));
  await fillPointBuy(user);
  const drafts =
    snapshots.mock.results.at(-1)!.value.characteristicGeneration.drafts;
  expectCharacteristic("Strength", {
    baseline: 18,
    generated: 20,
    favored: true,
    total: 38,
  });
  expectCharacteristic("Intelligence", {
    baseline: 22,
    generated: 10,
    favored: false,
    total: 32,
  });
  expectCharacteristic("Luck", {
    baseline: 30,
    generated: 10,
    favored: false,
    total: 40,
  });

  function expectSuppressed() {
    expect(sheet().getAllByRole("columnheader")).toHaveLength(9);
    expectCharacteristic("Strength", {
      baseline: 0,
      generated: 0,
      favored: false,
      total: 0,
    });
    expect(sheet().queryByRole("img", { name: "Favored" })).toBeNull();
    expectCharacteristic("Luck", {
      baseline: 30,
      generated: 0,
      favored: false,
      total: 30,
    });
    const snapshot = snapshots.mock.results.at(-1)!.value;
    expect(snapshot.characteristicGeneration.drafts).toEqual(drafts);
    expect(snapshot.canFinish).toBe(false);
  }

  await user.click(screen.getByRole("button", { name: "Back" }));
  await selectRace("Altmer");
  expect(screen.getByRole("status", { name: "Loading race" })).toBeTruthy();
  expectSuppressed();
  await act(async () => failure.reject(new Error("race offline")));
  await screen.findByRole("dialog", { name: "Something went wrong!" });
  expectSuppressed();
  await user.click(screen.getByRole("button", { name: "OK" }));
  await user.click(
    screen.getByRole("button", { name: "Cancel race selection" }),
  );
  expectCharacteristic("Strength", {
    baseline: 18,
    generated: 20,
    favored: true,
    total: 38,
  });
  expectCharacteristic("Luck", {
    baseline: 30,
    generated: 10,
    favored: false,
    total: 40,
  });
  expect(snapshots.mock.results.at(-1)!.value.canFinish).toBe(true);

  await selectRace("Altmer");
  await screen.findByRole("checkbox", { name: "Alchemy" });
  expectCharacteristic("Strength", {
    baseline: 25,
    generated: 20,
    favored: true,
    total: 45,
  });
  expectCharacteristic("Intelligence", {
    baseline: 30,
    generated: 10,
    favored: false,
    total: 40,
  });
  expectCharacteristic("Luck", {
    baseline: 30,
    generated: 10,
    favored: false,
    total: 40,
  });
  expect(snapshots.mock.results.at(-1)!.value.canFinish).toBe(false);
  await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
  await sheet().findByText("Alchemy (Novice)");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(
    screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  ).toHaveProperty("checked", true);
  expect(
    screen.getByRole("textbox", { name: "Strength points" }),
  ).toHaveProperty("value", "20");
  expect(
    screen.getByRole("textbox", { name: "Character name" }),
  ).toHaveProperty("value", "Keira");
  expect(
    within(screen.getByRole("group", { name: "Luck roll" })).getByRole(
      "button",
      { name: "Luck roll, total 10, assigned Luck" },
    ),
  ).toBeTruthy();
  expect(
    snapshots.mock.results.at(-1)!.value.characteristicGeneration.drafts,
  ).toEqual(drafts);
  expect(snapshots.mock.results.at(-1)!.value.canFinish).toBe(true);
  expect(console.error).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Finish" })).toBeNull();
});
