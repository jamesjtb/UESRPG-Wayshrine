import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { createCharacteristicRoller } from "./steps/characteristics/dice";
import disclosureClasses from "./components/ToContinue.module.css";
import {
  closeWizard,
  expandOptions,
  openWizard,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

it("starts Options collapsed and retains expansion and Core options through generation updates and wizard dismissal", async () => {
  const user = userEvent.setup();
  const snapshots = vi.spyOn(CharacterCreator.prototype, "getSnapshot");
  renderForge(
    undefined,
    createCharacteristicRoller(() => 0.45),
  );
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  const options = screen.getByRole("button", { name: "Options" });
  expect(
    options.closest(".mantine-Accordion-root")?.className.split(" "),
  ).toContain(disclosureClasses.frame);
  expect(options.className.split(" ")).toContain(disclosureClasses.control);
  expect(options.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("switch")).toBeNull();
  const initial = screen.getByRole("button", {
    name: "Make Characteristic Roll",
  });
  expect(
    initial.compareDocumentPosition(options) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  await expandOptions(user);
  const panel = screen.getByRole("region", { name: "Options" });
  expect(within(panel).getAllByRole("switch")).toHaveLength(2);
  expect(panel.textContent).toBe(
    "Unlimited RerollsUse Optional Point Buy Rules",
  );
  const unlimited = screen.getByRole("switch", { name: "Unlimited Rerolls" });
  const method = screen.getByRole("switch", {
    name: "Use Optional Point Buy Rules",
  });
  expect(unlimited).toHaveProperty("checked", false);
  expect(method).toHaveProperty("checked", false);
  await user.click(unlimited);
  expect(
    snapshots.mock.results.at(-1)!.value.characteristicGeneration.rerolls
      .unlimited,
  ).toBe(true);
  await user.click(initial);
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  expect(options.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "Reroll" })).toBeTruthy();
  await user.click(method);
  expect(options.getAttribute("aria-expanded")).toBe("true");
  const strength = screen.getByRole("textbox", { name: "Strength points" });
  await user.clear(strength);
  await user.type(strength, "12");
  const beforeCollapse =
    snapshots.mock.results.at(-1)!.value.characteristicGeneration;
  await user.click(options);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(strength).toHaveProperty("value", "12");
  expect(snapshots.mock.results.at(-1)!.value.characteristicGeneration).toEqual(
    beforeCollapse,
  );
  await expandOptions(user);
  expect(unlimited).toHaveProperty("checked", true);
  expect(method).toHaveProperty("checked", true);
  await closeWizard();
  await openWizard();
  expect(
    screen
      .getByRole("button", { name: "Options" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
  expect(
    screen.getByRole("switch", { name: "Unlimited Rerolls" }),
  ).toHaveProperty("checked", true);
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(
    screen
      .getByRole("button", { name: "Options" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  expect(screen.queryByRole("switch")).toBeNull();
  expect(
    screen.getByRole("textbox", { name: "Strength points" }),
  ).toHaveProperty("value", "12");
  await expandOptions(user);
  expect(
    screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  ).toHaveProperty("checked", true);
  expect(
    screen.getByRole("switch", { name: "Unlimited Rerolls" }),
  ).toHaveProperty("checked", true);
});
