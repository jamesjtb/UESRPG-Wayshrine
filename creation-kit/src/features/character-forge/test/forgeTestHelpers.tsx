import { StrictMode } from "react";
import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
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

export function renderForge(catalog = fixtureCatalog()) {
  return render(
    <StrictMode>
      <MantineProvider env="test">
        <ContentCatalogProvider loadCatalog={async () => catalog}>
          <ContentCatalogStatus />
          <CharacterForge />
        </ContentCatalogProvider>
      </MantineProvider>
    </StrictMode>,
  );
}

export async function selectRace(label: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("combobox", { name: "Race" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

export function sheet() {
  return within(screen.getByRole("region", { name: "Character sheet" }));
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
