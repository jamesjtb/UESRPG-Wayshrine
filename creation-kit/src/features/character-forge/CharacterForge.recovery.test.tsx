import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { deferred } from "../../test/content";
import {
  closeWizard,
  controlledReads,
  openWizard,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";
import { fixtureCatalog } from "./test/testCatalog";

it("dismisses race search and assignment menus with Escape before the wizard", async () => {
  const user = userEvent.setup();
  renderForge();
  const wizard = await openWizard();
  const race = await screen.findByRole("combobox", { name: "Race" });
  await user.click(race);
  await screen.findByRole("option", { name: "Argonian" });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Create Character" })).toBe(wizard);
  expect(document.activeElement).toBe(race);
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await user.click(screen.getByRole("button", { name: "Next" }));
  const pool = within(
    screen.getByRole("group", { name: "Rolled characteristics" }),
  );
  await user.click(pool.getByRole("button", { name: "Roll" }));
  const tile = pool.getByRole("button", { name: /^Roll 1, total/ });
  await user.click(tile);
  await user.keyboard("{ArrowDown}{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.getByRole("dialog", { name: "Create Character" })).toBe(wizard);
  await waitFor(() => expect(document.activeElement).toBe(tile));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("acknowledges a race-index failure while closed and retries only on request", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const catalog = fixtureCatalog();
  const original = catalog.list.bind(catalog);
  const pending = deferred<void>();
  const list = vi.spyOn(catalog, "list").mockImplementation(async (kind) => {
    await pending.promise;
    return original(kind);
  });
  const user = userEvent.setup();
  // Use real portals/transitions: test mode renders nested dialogs inline.
  renderForge(catalog, undefined, "default");
  await openWizard();
  await screen.findByRole("status", { name: "Loading races" });
  await closeWizard();
  await act(async () => pending.reject(new Error("offline")));
  const error = await screen.findByRole("dialog", {
    name: "Something went wrong!",
  });
  await user.click(within(error).getByRole("button", { name: "OK" }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Create Character" }),
    ),
  );
  const reads = list.mock.calls.length;
  await openWizard();
  expect(
    screen.queryByRole("dialog", { name: "Something went wrong!" }),
  ).toBeNull();
  expect(list.mock.calls.length).toBe(reads);
  list.mockImplementation(original);
  await user.click(screen.getByRole("button", { name: "Retry races" }));
  await screen.findByRole("combobox", { name: "Race" });
});

it("retries a closed skill failure, reopens a failed retry, and recovers without losing race", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const catalog = fixtureCatalog();
  const reads = controlledReads(catalog);
  const first = reads.hold("skill", "alchemy");
  const second = reads.hold("skill", "alchemy");
  const user = userEvent.setup();
  renderForge(catalog);
  await selectRace("Altmer");
  await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
  await closeWizard();
  await act(async () => first.reject(new Error("offline")));
  let error = await screen.findByRole("dialog", {
    name: "Something went wrong!",
  });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Create Character" }),
    ),
  );
  await openWizard();
  await user.click(screen.getByRole("button", { name: /Retry/ }));
  await closeWizard();
  await act(async () => second.reject(new Error("still offline")));
  error = await screen.findByRole("dialog", { name: "Something went wrong!" });
  await user.click(within(error).getByRole("button", { name: "OK" }));
  await openWizard();
  await user.click(screen.getByRole("button", { name: /Retry/ }));
  await sheet().findByText("Alchemy (Novice)");
  expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
    "value",
    "Altmer",
  );
  expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
    "checked",
    true,
  );
});

it("cancels a resumed pending race change and ignores its late failure while closed", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const catalog = fixtureCatalog();
  const reads = controlledReads(catalog);
  const pending = reads.hold("race", "altmer");
  const user = userEvent.setup();
  renderForge(catalog);
  await selectRace("Argonian");
  await sheet().findByText("Argonian");
  await selectRace("Altmer");
  await screen.findByRole("status", { name: "Loading race" });
  await closeWizard();
  await openWizard();
  await user.click(
    screen.getByRole("button", { name: "Cancel race selection" }),
  );
  expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
    "value",
    "Argonian",
  );
  expect(sheet().getByText("Argonian")).toBeTruthy();
  await closeWizard();
  await act(async () => pending.reject(new Error("obsolete failure")));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(log).not.toHaveBeenCalled();
  await openWizard();
  expect(
    screen.queryByRole("button", { name: "Retry race selection" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Next" })).toHaveProperty(
    "disabled",
    false,
  );
});
