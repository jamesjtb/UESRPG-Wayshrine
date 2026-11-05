import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CharacterCreator } from "@wayshrine/core";
import { expect, it, vi } from "vitest";
import { renderForge, selectRace, sheet } from "./test/forgeTestHelpers";

it("places the optional point-buy switch after the active flow and before Luck", async () => {
  const user = userEvent.setup();
  renderForge();
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  const methodSwitch = screen.getByRole("switch", {
    name: "Use Optional Point Buy Rules",
  });

  function expectSwitchBetween(flowEnd: Element) {
    expect(
      flowEnd.compareDocumentPosition(methodSwitch) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      methodSwitch.compareDocumentPosition(
        screen.getByRole("heading", { name: "Luck" }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }

  expectSwitchBetween(
    screen.getByRole("group", { name: "Rolled characteristics" }),
  );
  await user.click(methodSwitch);
  expectSwitchBetween(
    screen.getByRole("button", { name: "Increase Personality points" }),
  );
  await user.click(methodSwitch);
  expectSwitchBetween(
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
  expect(
    editor.getByRole("heading", { name: "Generate Characteristics" }),
  ).toBeTruthy();
  expect(editor.queryByRole("combobox", { name: "Race" })).toBeNull();
  expect(editor.getAllByRole("checkbox")).toHaveLength(7);
  expect(editor.queryByRole("checkbox", { name: "Luck" })).toBeNull();
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
  expect(editor.getByRole("heading", { name: "Luck" })).toBeTruthy();
  expect(
    within(editor.getByRole("group", { name: "Luck roll" })).getByRole(
      "button",
      { name: "Roll" },
    ),
  ).toBeTruthy();
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  expect(editor.getByText("Choose two")).toBeTruthy();
  await user.click(editor.getByRole("checkbox", { name: "Strength" }));
  await user.click(editor.getByRole("checkbox", { name: "Endurance" }));
  expect(setFavored.mock.results.at(-1)?.value.ok).toBe(true);
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  for (const checkbox of editor.getAllByRole<HTMLInputElement>("checkbox")) {
    expect(checkbox).toHaveProperty("disabled", !checkbox.checked);
  }
  const submissions = setFavored.mock.calls.length;
  await user.click(editor.getByRole("checkbox", { name: "Agility" }));
  expect(
    editor.queryByText("Choose exactly two favored characteristics."),
  ).toBeNull();
  expect(setFavored).toHaveBeenCalledTimes(submissions);
  expect(setFavored.mock.calls.at(-1)).toEqual([["str", "end"]]);
  expect(editor.getByRole("checkbox", { name: "Agility" })).toHaveProperty(
    "checked",
    false,
  );
  await user.click(editor.getByRole("checkbox", { name: "Endurance" }));
  for (const checkbox of editor.getAllByRole("checkbox")) {
    expect(checkbox).toHaveProperty("disabled", false);
  }
  await user.click(editor.getByRole("checkbox", { name: "Agility" }));
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
  expect(editor.getByRole("checkbox", { name: "Strength" })).toHaveProperty(
    "checked",
    true,
  );
  expect(editor.getByRole("checkbox", { name: "Agility" })).toHaveProperty(
    "checked",
    true,
  );
  expect(editor.getByRole("checkbox", { name: "Endurance" })).toHaveProperty(
    "checked",
    false,
  );
  expect(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  ).toHaveProperty("checked", true);
  await user.click(
    editor.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  );
  expect(
    within(
      editor.getByRole("group", { name: "Rolled characteristics" }),
    ).getByRole("button", { name: "Roll" }),
  ).toBeTruthy();
  expect(
    editor.queryByText("Choose a roll to assign a characteristic."),
  ).toBeNull();
  expect(dispose.mock.calls).toHaveLength(disposals);
  expect(finish).not.toHaveBeenCalled();
});
