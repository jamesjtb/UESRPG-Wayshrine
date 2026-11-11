import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { describe, expect, it, vi } from "vitest";
import {
  controlledReads,
  expectCharacteristic,
  fillPointBuy,
  expandOptions,
  openWizard,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";
import { createCharacteristicRoller } from "./steps/characteristics/dice";

type User = ReturnType<typeof userEvent.setup>;
type Dismissal = "close control" | "Escape" | "backdrop";

async function dismissWizard(user: User, dismissal: Dismissal) {
  if (dismissal === "Escape") await user.keyboard("{Escape}");
  else if (dismissal === "backdrop") {
    await user.click(
      document.querySelector<HTMLElement>(".mantine-Modal-overlay")!,
    );
  } else {
    await user.click(
      screen.getByRole("button", { name: "Close character creation" }),
    );
  }
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Create Character" }),
    ).toBeNull(),
  );
}

describe("Character creation modal", () => {
  it.each<Dismissal>(["close control", "Escape", "backdrop"])(
    "starts closed and resumes an unanswered first opening after %s",
    async (dismissal) => {
      const user = userEvent.setup();
      const finish = vi.spyOn(CharacterCreator.prototype, "finish");
      const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
      renderForge();
      const name = await screen.findByRole("textbox", {
        name: "Character name",
      });
      await user.type(name, "Neri");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByText("In progress")).toBeNull();
      expect(screen.queryByText(/^Resume:/)).toBeNull();
      const wizard = await openWizard();
      const disposals = dispose.mock.calls.length;
      await screen.findByRole("combobox", { name: "Race" });
      screen.getByRole("button", { name: "Close character creation" }).focus();
      await user.tab({ shift: true });
      expect(wizard.contains(document.activeElement)).toBe(true);
      screen.getByRole("button", { name: "Close character creation" }).focus();
      expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
        "disabled",
        true,
      );
      await dismissWizard(user, dismissal);
      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByRole("button", { name: "Create Character" }),
        ),
      );
      expect(screen.getByText("In progress")).toBeTruthy();
      expect(screen.getByText("Resume: Select Race")).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Create Character" }),
      ).toBeTruthy();
      expect(sheet().getByRole("textbox", { name: "Character name" })).toBe(
        name,
      );
      expect(name).toHaveProperty("value", "Neri");
      await openWizard();
      expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
        "value",
        "",
      );
      expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
        "disabled",
        true,
      );
      expect(dispose.mock.calls.length).toBe(disposals);
      expect(finish).not.toHaveBeenCalled();
    },
  );

  it.each<Dismissal>(["close control", "Escape", "backdrop"])(
    "retains both method drafts, rolls, assignments and current step after %s",
    async (dismissal) => {
      const user = userEvent.setup();
      const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
      const finish = vi.spyOn(CharacterCreator.prototype, "finish");
      renderForge(
        fixtureCatalog(),
        createCharacteristicRoller(() => 0.45),
      );
      await selectRace("Argonian");
      await sheet().findByText("Argonian");
      await user.click(screen.getByRole("button", { name: "Next" }));
      const pool = within(
        screen.getByRole("group", { name: "Rolled characteristics" }),
      );
      await user.click(
        pool.getByRole("button", { name: "Make Characteristic Roll" }),
      );
      await assignDraftResult(user, "Strength", 0);
      await fillPointBuy(user);
      const before = snapshots.mock.results.at(-1)!.value;
      // Birthsign is registered in Core but has no browser editor yet.
      expect(before.canFinish).toBe(false);
      expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
        "disabled",
        false,
      );
      expect(
        screen.queryByRole("button", { name: /finish|finalize/i }),
      ).toBeNull();
      await dismissWizard(user, dismissal);
      expect(screen.getByText("In progress")).toBeTruthy();
      expect(finish).not.toHaveBeenCalled();
      expect(screen.getByText("Resume: Generate Characteristics")).toBeTruthy();
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
      await openWizard();
      expect(
        screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
      ).toHaveProperty("checked", true);
      expect(
        screen.getByRole("textbox", { name: "Strength points" }),
      ).toHaveProperty("value", "20");
      expect(
        screen
          .getByRole("button", { name: "Favor Strength" })
          .getAttribute("aria-pressed"),
      ).toBe("true");
      await user.click(
        screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
      );
      expect(
        screen
          .getByRole("button", { name: "Rolled result for Strength" })
          .getAttribute("aria-description"),
      ).toContain("Result 1: 10 (5 + 5) — Strength");
      const after =
        snapshots.mock.results.at(-1)!.value.characteristicGeneration.drafts;
      expect(after.rolled).toEqual(
        before.characteristicGeneration.drafts.rolled,
      );
      expect(after.pointBuy).toEqual(
        before.characteristicGeneration.drafts.pointBuy,
      );
      expect(after.luck).toEqual(before.characteristicGeneration.drafts.luck);
      await user.click(screen.getByRole("button", { name: "Back" }));
      expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
        "value",
        "Argonian",
      );
    },
  );

  it("retains partial point-buy edits and explicit clears across dismissal", async () => {
    const user = userEvent.setup();
    const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
    renderForge();
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await expandOptions(user);
    await user.click(
      screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
    );
    const strength = screen.getByRole("textbox", { name: "Strength points" });
    await user.clear(strength);
    await user.type(strength, "1.");
    await user.clear(screen.getByRole("textbox", { name: "Endurance points" }));
    const before =
      snapshots.mock.results.at(-1)!.value.characteristicGeneration;
    await dismissWizard(user, "close control");
    await openWizard();
    expect(screen.getByRole("textbox", { name: "Strength points" })).toBe(
      strength,
    );
    expect(strength).toHaveProperty("value", "1.");
    expect(
      screen.getByRole("textbox", { name: "Endurance points" }),
    ).toHaveProperty("value", "");
    expect(
      snapshots.mock.results.at(-1)!.value.characteristicGeneration,
    ).toEqual(before);
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("dismisses a stacked error with Escape without closing the wizard", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pending = reads.hold("race", "altmer");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await act(async () => pending.reject(new Error("offline")));
    const error = await screen.findByRole("dialog", {
      name: "Something went wrong!",
    });
    within(error).getByRole("button", { name: "OK" }).focus();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Something went wrong!" }),
      ).toBeNull(),
    );
    expect(
      screen.getByRole("dialog", { name: "Create Character" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Retry race selection" }),
    );
    await screen.findByRole("checkbox", { name: "Alchemy" });
  });

  it.each(["race", "skill"] as const)(
    "settles a pending %s selection while closed and retains its answer on reopening",
    async (kind) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const pending = reads.hold(kind, kind === "race" ? "altmer" : "alchemy");
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Altmer");
      if (kind === "skill")
        await user.click(
          await screen.findByRole("checkbox", { name: "Alchemy" }),
        );
      await dismissWizard(user, "close control");
      await act(async () => pending.resolve());
      await sheet().findByText(kind === "race" ? "Altmer" : "Alchemy (Novice)");
      await openWizard();
      expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
        "value",
        "Altmer",
      );
      expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
        "checked",
        kind === "skill",
      );
      expect(
        screen.queryByRole("status", { name: /Loading race|Loading skills/ }),
      ).toBeNull();
    },
  );

  it("acknowledges a pending failure after dismissal, then resumes retry/cancel without resetting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pending = reads.hold("race", "altmer");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await selectRace("Altmer");
    await dismissWizard(user, "Escape");
    await act(async () => pending.reject(new Error("offline")));
    const error = await screen.findByRole("dialog", {
      name: "Something went wrong!",
    });
    await user.click(within(error).getByRole("button", { name: "OK" }));
    expect(
      screen.queryByRole("dialog", { name: "Create Character" }),
    ).toBeNull();
    await openWizard();
    expect(
      screen.getByRole("button", { name: "Retry race selection" }),
    ).toBeTruthy();
    await user.click(
      screen.getByRole("button", { name: "Cancel race selection" }),
    );
    expect(sheet().getByText("Argonian")).toBeTruthy();
    await selectRace("Altmer");
    await screen.findByRole("checkbox", { name: "Alchemy" });
  });
});
import { assignDraftResult } from "./test/forgeTestHelpers";
