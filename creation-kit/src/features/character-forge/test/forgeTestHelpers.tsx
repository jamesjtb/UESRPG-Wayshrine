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
) {
  return render(
    <StrictMode>
      <MantineProvider env="test">
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

export function characteristicRow(label: string) {
  const header = sheet().getByRole("rowheader", { name: label });
  return within(header.closest("tr")!);
}

export function expectCharacteristicBaseline(label: string, baseline: number) {
  expect(characteristicRow(label).getAllByRole("cell")[0]).toHaveProperty(
    "textContent",
    String(baseline),
  );
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
  const row = characteristicRow(label);
  const cells = row.getAllByRole("cell");
  expect(cells[0]).toHaveProperty("textContent", String(expected.baseline));
  expect(cells[1]).toHaveProperty("textContent", String(expected.generated));
  if (expected.favored)
    expect(row.getByRole("img", { name: "Favored" })).toBeTruthy();
  else {
    expect(cells[2]).toHaveProperty("textContent", "");
    expect(
      within(cells[2]!).queryByRole("img", { name: "Favored" }),
    ).toBeNull();
  }
  expect(cells[3]).toHaveProperty("textContent", String(expected.total));
}

export async function fillPointBuy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "Point buy" }));
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
  await user.click(screen.getByRole("checkbox", { name: "Strength" }));
  await user.click(screen.getByRole("checkbox", { name: "Endurance" }));
  const luck = within(screen.getByRole("group", { name: "Luck roll" }));
  await user.click(luck.getByRole("button", { name: "Roll" }));
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
