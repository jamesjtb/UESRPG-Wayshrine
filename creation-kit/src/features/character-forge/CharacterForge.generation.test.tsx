import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import {
  expandOptions,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

it("keeps generation controls before Options and Luck out of the result rows", async () => {
  const user = userEvent.setup();
  renderForge();
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await expandOptions(user);
  const methodSwitch = screen.getByRole("switch", {
    name: "Use Optional Point Buy Rules",
  });
  const draftTable = screen.getByRole("table", {
    name: "Characteristic draft preview",
  });

  function expectSwitchAfter(flowEnd: Element) {
    expect(
      draftTable.compareDocumentPosition(flowEnd) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      flowEnd.compareDocumentPosition(methodSwitch) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }

  expectSwitchAfter(
    screen.getByRole("group", { name: "Rolled characteristics" }),
  );
  await user.click(methodSwitch);
  expectSwitchAfter(
    screen.getByRole("button", { name: "Increase Personality points" }),
  );
  await user.click(methodSwitch);
  expectSwitchAfter(
    screen.getByRole("group", { name: "Rolled characteristics" }),
  );
});

it("switches editors through Core navigation while retaining the session, name and answers", async () => {
  const user = userEvent.setup();
  const dispose = vi.spyOn(CharacterCreator.prototype, "dispose");
  const finish = vi.spyOn(CharacterCreator.prototype, "finish");
  const setFavored = vi.spyOn(
    CharacterCreator.prototype,
    "setFavoredCharacteristics",
  );
  renderForge();
  const name = await screen.findByRole("textbox", { name: "Character name" });
  await user.type(name, "Neri");
  await selectRace("Altmer");
  await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
  await sheet().findByText("Alchemy (Novice)");
  const disposals = dispose.mock.calls.length;
  const editor = within(
    screen.getByRole("region", { name: "Character editor" }),
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
  await expandOptions(user);
  expect(
    editor.getByRole("heading", { name: "Generate Characteristics" }),
  ).toBeTruthy();
  expect(editor.queryByRole("combobox", { name: "Race" })).toBeNull();
  expect(editor.getAllByRole("button", { name: /^Favor / })).toHaveLength(7);
  expect(editor.queryByRole("checkbox")).toBeNull();
  expect(editor.queryByRole("button", { name: "Favor Luck" })).toBeNull();
  expect(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  ).toHaveProperty("checked", false);
  expect(editor.queryByText("Generation method")).toBeNull();
  expect(editor.queryByRole("radio")).toBeNull();
  expect(
    editor.getByRole("group", { name: "Rolled characteristics" }),
  ).toBeTruthy();
  expect(editor.queryByRole("textbox", { name: "Strength points" })).toBeNull();
  expect(
    editor.queryByText("Choose rolled or point-buy generation."),
  ).toBeNull();
  expect(
    editor.queryByText(/Luck requires|Luck uses a separate|Luck baseline:/),
  ).toBeNull();
  expect(editor.queryByRole("heading", { name: "Luck" })).toBeNull();
  expect(
    editor.getByRole("button", { name: "Make Characteristic Roll" }),
  ).toBeTruthy();
  expect(editor.queryByRole("group", { name: "Luck roll" })).toBeNull();
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  expect(
    editor.queryByText("Draft preview · Choose two favored characteristics"),
  ).toBeNull();
  await user.click(editor.getByRole("button", { name: "Favor Strength" }));
  await user.click(editor.getByRole("button", { name: "Favor Endurance" }));
  expect(setFavored.mock.results.at(-1)?.value.ok).toBe(true);
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  for (const button of editor.getAllByRole("button", { name: /^Favor / })) {
    expect(button).toHaveProperty(
      "disabled",
      button.getAttribute("aria-pressed") !== "true",
    );
  }
  const submissions = setFavored.mock.calls.length;
  await user.click(editor.getByRole("button", { name: "Favor Agility" }));
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  expect(setFavored).toHaveBeenCalledTimes(submissions);
  expect(setFavored.mock.calls.at(-1)).toEqual([["str", "end"]]);
  expect(
    editor
      .getByRole("button", { name: "Favor Agility" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  await user.click(editor.getByRole("button", { name: "Favor Endurance" }));
  for (const button of editor.getAllByRole("button", { name: /^Favor / })) {
    expect(button).toHaveProperty("disabled", false);
  }
  await user.click(editor.getByRole("button", { name: "Favor Agility" }));
  expect(setFavored.mock.calls.at(-1)).toEqual([["str", "ag"]]);
  expect(setFavored.mock.results.at(-1)?.value.ok).toBe(true);
  await user.click(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  );
  expect(
    editor.getByRole("textbox", { name: "Strength points" }),
  ).toHaveProperty("value", "0");
  expect(
    screen.queryByRole("dialog", { name: "Something went wrong!" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Finish" })).toBeNull();
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(screen.getByRole("textbox", { name: "Character name" })).toBe(name);
  expect(name).toHaveProperty("value", "Neri");
  expect(sheet().getByText("Alchemy (Novice)")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(editor.getByRole("combobox", { name: "Race" })).toHaveProperty(
    "value",
    "Altmer",
  );
  expect(editor.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
    "checked",
    true,
  );
  await user.click(screen.getByRole("button", { name: "Next" }));
  await expandOptions(user);
  expect(
    editor
      .getByRole("button", { name: "Favor Strength" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    editor
      .getByRole("button", { name: "Favor Agility" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    editor
      .getByRole("button", { name: "Favor Endurance" })
      .getAttribute("aria-pressed"),
  ).toBe("false");
  expect(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  ).toHaveProperty("checked", true);
  await user.click(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  );
  expect(
    within(
      editor.getByRole("group", { name: "Rolled characteristics" }),
    ).getByRole("button", { name: "Make Characteristic Roll" }),
  ).toBeTruthy();
  expect(
    editor.queryByText("Choose a roll to assign a characteristic."),
  ).toBeNull();
  expect(dispose.mock.calls).toHaveLength(disposals);
  expect(finish).not.toHaveBeenCalled();
});
