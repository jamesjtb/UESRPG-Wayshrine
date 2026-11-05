import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, vi } from "vitest";
import type { ContentCatalog, ContentKind } from "@wayshrine/core";
import {
  ContentCatalogProvider,
  ContentCatalogStatus,
} from "../../../app/ContentCatalogProvider";
import { deferred } from "../../../test/content";
import { CharacterForge } from "../CharacterForge";
import { fixtureCatalog } from "./testCatalog";
import { rollCharacteristicDice } from "../steps/characteristics/dice";
import type { CharacteristicRoller } from "../steps/characteristics/dice";

export function renderForge(
  catalog = fixtureCatalog(),
  rollDice: CharacteristicRoller = rollCharacteristicDice,
  env: "test" | "default" = "test",
) {
  return render(
    <StrictMode>
      <MantineProvider env={env}>
        <ContentCatalogProvider loadCatalog={async () => catalog}>
          <ContentCatalogStatus />
          <CharacterForge rollDice={rollDice} />
        </ContentCatalogProvider>
      </MantineProvider>
    </StrictMode>,
  );
}

export async function selectRace(label: string) {
  const user = userEvent.setup();
  if (!screen.queryByRole("dialog", { name: "Create Character" })) {
    await openWizard();
  }
  await user.click(await screen.findByRole("combobox", { name: "Race" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

export async function openWizard() {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Create Character" }),
  );
  return screen.findByRole("dialog", { name: "Create Character" });
}

export async function closeWizard() {
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Close character creation" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("dialog", { name: "Create Character" }),
    ).toBeNull(),
  );
}

export function sheet() {
  return within(screen.getByRole("region", { name: "Character sheet" }));
}

export function characteristicCell(label: string, row: string) {
  const headers = sheet().getAllByRole("columnheader");
  const index = headers.findIndex((header) => header.textContent === label) - 1;
  expect(index).toBeGreaterThanOrEqual(0);
  const rowHeader = sheet().getByRole("rowheader", { name: row });
  return within(rowHeader.closest("tr")!).getAllByRole("cell")[index]!;
}

export function expectCharacteristicBaseline(label: string, baseline: number) {
  expect(
    characteristicCell(label, "Total").getAttribute("aria-description"),
  ).toContain(`${label}: ${baseline} + `);
}

export function expectCharacteristic(
  label: string,
  expected: {
    baseline: number;
    generated: number;
    favored: boolean;
    total: number;
  },
) {
  const header = sheet().getByRole("columnheader", {
    name: new RegExp(`^${label}(, Favored)?$`),
  });
  expect(
    characteristicCell(label, "Total").getAttribute("aria-description"),
  ).toBe(
    `${label}: ${expected.baseline} + ${expected.generated} = ${expected.total} (baseline + generated)`,
  );
  if (expected.favored)
    expect(within(header).getByRole("img", { name: "Favored" })).toBeTruthy();
  else {
    expect(within(header).queryByRole("img", { name: "Favored" })).toBeNull();
  }
  expect(characteristicCell(label, "Total")).toHaveProperty(
    "textContent",
    String(expected.total),
  );
  expect(characteristicCell(label, "Bonus")).toHaveProperty(
    "textContent",
    String(Math.floor(expected.total / 10) % 10),
  );
}

export async function expandOptions(user: ReturnType<typeof userEvent.setup>) {
  const options = screen.getByRole("button", { name: "Options" });
  if (options.getAttribute("aria-expanded") !== "true")
    await user.click(options);
  await screen.findByRole("switch", { name: "Unlimited Rerolls" });
}

export async function fillPointBuy(user: ReturnType<typeof userEvent.setup>) {
  await expandOptions(user);
  await user.click(
    screen.getByRole("switch", { name: "Use Optional Point Buy Rules" }),
  );
  const amounts = {
    Strength: 20,
    Endurance: 20,
    Agility: 20,
    Intelligence: 10,
    Willpower: 10,
    Perception: 0,
    Personality: 0,
  };
  for (const [label, amount] of Object.entries(amounts)) {
    const input = screen.getByRole("textbox", { name: `${label} points` });
    await user.clear(input);
    await user.type(input, String(amount));
  }
  await user.click(screen.getByRole("button", { name: "Favor Strength" }));
  await user.click(screen.getByRole("button", { name: "Favor Endurance" }));
  const luck = screen.queryByRole("group", { name: "Luck roll" });
  const initialRoll =
    luck && within(luck).queryByRole("button", { name: "Roll" });
  if (initialRoll) await user.click(initialRoll);
}

/** Each gate holds exactly one matching read; tests explicitly settle every gate. */
export function controlledReads(catalog: ContentCatalog) {
  const gates = new Map<string, ReturnType<typeof deferred<void>>[]>();
  const original = catalog.get.bind(catalog);
  const get = vi.spyOn(catalog, "get").mockImplementation(async (kind, key) => {
    const gate = gates.get(`${kind}/${key}`)?.shift();
    if (gate) await gate.promise;
    return original(kind, key);
  });

  function hold(kind: ContentKind, key: string) {
    const gate = deferred<void>();
    const id = `${kind}/${key}`;
    gates.set(id, [...(gates.get(id) ?? []), gate]);
    return gate;
  }

  return { get, hold };
}

export async function assignDraftResult(
  user: ReturnType<typeof userEvent.setup>,
  characteristic: string,
  index: number,
) {
  await user.click(
    screen.getByRole("button", { name: `Rolled result for ${characteristic}` }),
  );
  await user.click(
    screen.getByRole("menuitem", { name: new RegExp(`^Result ${index + 1}:`) }),
  );
}

export function expectNavigationBlocked() {
  const navigation = within(
    screen.getByRole("navigation", { name: "Character creation navigation" }),
  );
  expect(navigation.getByRole("button", { name: "Back" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(navigation.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    true,
  );
}

export function expectRaceCanAdvance() {
  const navigation = within(
    screen.getByRole("navigation", { name: "Character creation navigation" }),
  );
  expect(navigation.getByRole("button", { name: "Back" })).toHaveProperty(
    "disabled",
    true,
  );
  expect(navigation.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    false,
  );
}
