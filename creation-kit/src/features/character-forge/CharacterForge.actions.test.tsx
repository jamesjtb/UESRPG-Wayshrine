import { StrictMode } from "react";
import { Accordion, MantineProvider } from "@mantine/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ContentCatalogProvider } from "../../app/ContentCatalogProvider";
import { deferred } from "../../test/content";
import { CharacterForge } from "./CharacterForge";
import { fixtureCatalog } from "./test/testCatalog";
import {
  controlledReads,
  fillPointBuy,
  openWizard,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

function renderActionsForge(catalog = fixtureCatalog()) {
  let roll = 0;
  return render(
    <StrictMode>
      <MantineProvider
        env="test"
        theme={{
          components: {
            Accordion: Accordion.extend({
              defaultProps: { transitionDuration: 0 },
            }),
          },
        }}
      >
        <ContentCatalogProvider loadCatalog={async () => catalog}>
          <CharacterForge
            rollDice={() => ({ id: `r${roll++}`, dice: [5, 6] })}
          />
        </ContentCatalogProvider>
      </MantineProvider>
    </StrictMode>,
  );
}

function expectActionsBelowTitle(title: string, text: string) {
  const heading = screen.getByRole("heading", { name: title });
  const presentation = heading.nextElementSibling;
  expect(presentation?.textContent).toContain(text);
  expect(presentation?.closest("footer")).toBeNull();
}

function expandedLabels() {
  return within(
    screen.getByRole("region", { name: /^Complete the following to continue/ }),
  )
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

it("places pending racial choices below the title and removes only resolved groups", async () => {
  const user = userEvent.setup();
  renderActionsForge();
  await openWizard();
  await screen.findByRole("combobox", { name: "Race" });
  expectActionsBelowTitle("Select Race", "Choose a race");
  await selectRace("Many choices");
  const toggle = await screen.findByRole("button", {
    name: "Choose 2 racial skills 2 remaining",
  });
  expectActionsBelowTitle("Select Race", "Choose 2 racial skills");
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(toggle);
  expect(expandedLabels()).toEqual([
    "Choose 2 racial skills",
    "Choose 1 racial skill",
  ]);
  const pair = within(screen.getByRole("group", { name: "Choose 2" }));
  await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
  expect(
    screen.getByRole("button", {
      name: "Complete the following to continue 2 remaining",
    }),
  ).toBe(toggle);
  await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
  await waitFor(() =>
    expect(screen.queryByText("Choose 2 racial skills")).toBeNull(),
  );
  expectActionsBelowTitle("Select Race", "Choose 1 racial skill");
  expect(screen.queryByRole("button", { name: /remaining/ })).toBeNull();
  await user.click(
    within(screen.getByRole("group", { name: "Choose 1" })).getByRole(
      "checkbox",
      { name: "Alchemy" },
    ),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  expect(screen.queryByText("Choose 1 racial skill")).toBeNull();
  await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
  expectActionsBelowTitle("Select Race", "Choose 2 racial skills");
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
  await waitFor(() =>
    expect(screen.queryByText("Choose 2 racial skills")).toBeNull(),
  );
  expect(
    screen.getByRole("heading", { name: "Select Race" }).nextElementSibling
      ?.tagName,
  ).not.toBe("FOOTER");
});

it("uses shared indicators until race browsing and selection settle successfully", async () => {
  const catalog = fixtureCatalog();
  const indexGate = deferred<void>();
  const list = catalog.list.bind(catalog);
  vi.spyOn(catalog, "list").mockImplementation(async (kind) => {
    if (kind === "race") await indexGate.promise;
    return list(kind);
  });
  const reads = controlledReads(catalog);
  const raceGate = reads.hold("race", "argonian");
  renderActionsForge(catalog);
  await openWizard();
  const title = screen.getByRole("heading", { name: "Select Race" });
  const browsing = within(title.nextElementSibling! as HTMLElement).getByRole(
    "status",
    { name: "Loading available races" },
  );
  expect(browsing.querySelector(".mantine-Loader-root")).not.toBeNull();
  await act(async () => indexGate.resolve());
  expectActionsBelowTitle("Select Race", "Choose a race");
  expect(
    screen.queryByRole("status", { name: "Loading available races" }),
  ).toBeNull();
  await selectRace("Argonian");
  const selection = within(title.nextElementSibling! as HTMLElement).getByRole(
    "status",
    { name: "Loading race selection" },
  );
  expect(selection.querySelector(".mantine-Loader-root")).not.toBeNull();
  await act(async () => raceGate.resolve());
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
      "disabled",
      false,
    ),
  );
  expect(
    screen.queryByRole("status", { name: "Loading race selection" }),
  ).toBeNull();
  expect(screen.queryByText("Choose a race")).toBeNull();
  expect(
    title.nextElementSibling?.classList.contains("mantine-Paper-root"),
  ).toBe(false);
});

it("shows race load/retry blockers below the title without replacing inline recovery controls", async () => {
  const catalog = fixtureCatalog();
  const reads = controlledReads(catalog);
  const gate = reads.hold("race", "argonian");
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  renderActionsForge(catalog);
  await selectRace("Argonian");
  const title = screen.getByRole("heading", { name: "Select Race" });
  expect(
    within(title.nextElementSibling! as HTMLElement).getByRole("status", {
      name: "Loading race selection",
    }),
  ).toBeTruthy();
  expect(screen.queryByText(/Wait for .* to load/)).toBeNull();
  expect(screen.getByRole("status", { name: "Loading race" })).toBeTruthy();
  await act(async () => gate.reject(new Error("offline")));
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "OK" }));
  expectActionsBelowTitle("Select Race", "Retry or cancel race selection");
  expect(
    screen.getByRole("button", { name: "Retry race selection" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
  await user.click(
    screen.getByRole("button", { name: "Retry race selection" }),
  );
  await sheet().findByText("Argonian");
  await waitFor(() =>
    expect(screen.queryByText("Retry or cancel race selection")).toBeNull(),
  );
  expect(errorLog).toHaveBeenCalled();
});

it("updates rolled tasks from Core's combined initial roll across step navigation", async () => {
  const user = userEvent.setup();
  renderActionsForge();
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  const toggle = screen.getByRole("button", {
    name: "Choose two favored characteristics 4 remaining",
  });
  expectActionsBelowTitle(
    "Generate Characteristics",
    "Choose two favored characteristics",
  );
  await user.click(toggle);
  expect(expandedLabels()).toEqual([
    "Choose two favored characteristics",
    "Roll characteristic results",
    "Assign all characteristic results",
    "Roll Luck",
  ]);
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  await user.click(screen.getByRole("button", { name: "Favor Endurance" }));
  expect(
    screen.getByRole("button", {
      name: "Complete the following to continue 3 remaining",
    }),
  ).toBe(toggle);
  await user.click(
    within(
      screen.getByRole("group", { name: "Rolled characteristics" }),
    ).getByRole("button", { name: "Make Characteristic Roll" }),
  );
  expectActionsBelowTitle(
    "Generate Characteristics",
    "Assign all characteristic results",
  );
  expect(screen.queryByText("Roll Luck")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Back" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.queryByRole("button", { name: /remaining/ })).toBeNull();
  expectActionsBelowTitle(
    "Generate Characteristics",
    "Assign all characteristic results",
  );
  const labels = [
    "Strength",
    "Endurance",
    "Agility",
    "Intelligence",
    "Willpower",
    "Perception",
    "Personality",
  ];
  for (const [index, label] of labels.entries()) {
    await assignDraftResult(user, label, index);
  }
  expect(screen.queryByText("Assign all characteristic results")).toBeNull();
  expect(screen.queryByRole("button", { name: /remaining/ })).toBeNull();
  const firstResult = screen.getByRole("button", {
    name: "Rolled result for Strength",
  });
  await user.click(firstResult);
  await user.click(await screen.findByRole("menuitem", { name: "Unassign" }));
  expectActionsBelowTitle(
    "Generate Characteristics",
    "Assign all characteristic results",
  );
  await assignDraftResult(user, "Strength", 0);
  expect(screen.queryByText("Assign all characteristic results")).toBeNull();
  // The last registered Core step still has no Next, regardless of this presentation.
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("groups point-buy tasks, retains inline numeric feedback, and hides completed actions", async () => {
  const user = userEvent.setup();
  renderActionsForge();
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(
    screen.getByRole("button", {
      name: "Choose two favored characteristics 4 remaining",
    }),
  );
  await fillPointBuy(user);
  expect(screen.queryByRole("button", { name: /remaining/ })).toBeNull();
  expect(screen.queryByText("Allocate characteristic points")).toBeNull();
  const strength = screen.getByRole("textbox", { name: "Strength points" });
  await user.clear(strength);
  await user.type(strength, "21");
  expectActionsBelowTitle(
    "Generate Characteristics",
    "Allocate characteristic points",
  );
  expect(
    screen.getByText(
      "Allocate an integer from 0 to 20 to this characteristic.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /remaining/ })).toBeNull();
  await user.clear(strength);
  await user.type(strength, "20");
  expect(screen.queryByText("Allocate characteristic points")).toBeNull();
});
import { assignDraftResult } from "./test/forgeTestHelpers";
