import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../test/content";
import { fixtureCatalog } from "./test/testCatalog";
import {
  controlledReads,
  expectNavigationBlocked,
  renderForge,
  selectRace,
  sheet,
} from "./test/forgeTestHelpers";

describe("Character Forge asynchronous selections", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it.each(["success", "failure"])(
    "keeps race B after superseded race A settles with %s",
    async (outcome) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const old = reads.hold("race", "altmer");
      const list = vi.spyOn(catalog, "list");
      renderForge(catalog);
      await selectRace("Altmer");
      expect(screen.getByRole("status", { name: "Loading race" })).toBeTruthy();
      expectNavigationBlocked();
      await selectRace("Argonian");
      await sheet().findByText("Argonian");
      await act(async () => {
        if (outcome === "success") old.resolve();
        else old.reject(new Error("obsolete race"));
      });
      expect(sheet().getByText("Argonian")).toBeTruthy();
      expect(screen.getByRole("combobox", { name: "Race" })).toHaveProperty(
        "value",
        "Argonian",
      );
      expect(screen.queryByRole("status", { name: "Loading race" })).toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(list).not.toHaveBeenCalledWith("skill");
      expect(reads.get).not.toHaveBeenCalledWith("trait", "magicWeakness");
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
      expectNavigationBlocked();
    },
  );

  it("stops trait follow-up reads when a superseded race's skill index resolves", async () => {
    const catalog = fixtureCatalog();
    const originalList = catalog.list.bind(catalog);
    const index = deferred<void>();
    const list = vi.spyOn(catalog, "list").mockImplementation(async (kind) => {
      if (kind === "skill") await index.promise;
      return originalList(kind);
    });
    const get = vi.spyOn(catalog, "get");
    renderForge(catalog);
    await selectRace("Altmer");
    await waitFor(() => expect(list).toHaveBeenCalledWith("skill"));
    await selectRace("Argonian");
    await sheet().findByText("Argonian");
    await act(async () => index.resolve());
    expect(get).not.toHaveBeenCalledWith("trait", "magicWeakness");
    expect(sheet().getByText("Argonian")).toBeTruthy();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "retains the newest valid same-group answer after an older %s",
    async (outcome) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const old = reads.hold("skill", "alchemy");
      const latest = reads.hold("skill", "alteration");
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Altmer");
      await user.click(
        await screen.findByRole("checkbox", { name: "Alchemy" }),
      );
      await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
      await user.click(screen.getByRole("checkbox", { name: "Alteration" }));
      await act(async () => latest.resolve());
      await sheet().findByText("Alteration (Novice)");
      await act(async () => {
        if (outcome === "success") old.resolve();
        else old.reject(new Error("obsolete skill"));
      });
      expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
        "checked",
        false,
      );
      expect(
        screen.getByRole("checkbox", { name: "Alteration" }),
      ).toHaveProperty("checked", true);
      expect(sheet().getByText("Alteration (Novice)")).toBeTruthy();
      expect(sheet().queryByText("Alchemy (Novice)")).toBeNull();
      expect(
        screen.queryByRole("status", { name: "Loading skills" }),
      ).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it("keeps a newer under-count answer editable after an older successful read", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const old = reads.hold("skill", "alchemy");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
    await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
    expectNavigationBlocked();
    await act(async () => old.resolve());
    expect(screen.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      false,
    );
    expect(screen.getByRole("checkbox", { name: "Alteration" })).toHaveProperty(
      "checked",
      false,
    );
    expect(sheet().getByText("No skills.")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading skills" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox", { name: "Alchemy" }));
    await sheet().findByText("Alchemy (Novice)");
    expectNavigationBlocked();
  });

  it("blocks excess selections during loading without superseding the pending answer", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pending = reads.hold("skill", "alchemy");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Altmer");
    await user.click(await screen.findByRole("checkbox", { name: "Alchemy" }));
    const selected = screen.getByRole("checkbox", { name: "Alchemy" });
    const unselected = screen.getByRole("checkbox", { name: "Alteration" });
    expect(selected).toHaveProperty("disabled", false);
    expect(unselected).toHaveProperty("disabled", true);
    await user.click(unselected);
    expect(unselected).toHaveProperty("checked", false);
    expect(reads.get).not.toHaveBeenCalledWith("skill", "alteration");
    await act(async () => pending.resolve());
    await sheet().findByText("Alchemy (Novice)");
    expect(selected).toHaveProperty("checked", true);
    expect(unselected).toHaveProperty("disabled", true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["success", "failure"])(
    "keeps independent resolved grants editable while another group has a %s",
    async (outcome) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const pairRead = reads.hold("skill", "alchemy");
      const overlapRead = reads.hold("skill", "alchemy");
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Many choices");
      const pair = within(
        await screen.findByRole("group", { name: "Choose 2" }),
      );
      const overlap = within(screen.getByRole("group", { name: "Choose 1" }));
      await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
      await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
      await user.click(overlap.getByRole("checkbox", { name: "Alchemy" }));
      expect(
        screen.getAllByRole("status", { name: "Loading skills" }),
      ).toHaveLength(2);
      await act(async () => overlapRead.resolve());
      await sheet().findByText("Alchemy (Novice)");
      expect(
        screen.getAllByRole("status", { name: "Loading skills" }),
      ).toHaveLength(1);
      expect(overlap.getByRole("checkbox")).toHaveProperty("disabled", false);
      await user.click(overlap.getByRole("checkbox"));
      expect(sheet().getByText("No skills.")).toBeTruthy();
      await user.click(overlap.getByRole("checkbox"));
      await sheet().findByText("Alchemy (Novice)");
      await act(async () => {
        if (outcome === "success") pairRead.resolve();
        else pairRead.reject(new Error("pair unavailable"));
      });
      if (outcome === "failure") {
        await screen.findByRole("dialog", { name: "Something went wrong!" });
        expect(sheet().queryByText("Alteration (Novice)")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        await user.click(screen.getByRole("button", { name: "OK" }));
        await user.click(
          screen.getByRole("button", { name: "Retry skill selection" }),
        );
      }
      await sheet().findByText("Alteration (Novice)");
      expect(sheet().getAllByText("Alchemy (Novice)")).toHaveLength(1);
      expect(
        screen.queryByRole("status", { name: "Loading skills" }),
      ).toBeNull();
      expectNavigationBlocked();
    },
  );

  it("shows a group's failure without clearing another group's pending load", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pairRead = reads.hold("skill", "alchemy");
    const overlapRead = reads.hold("skill", "alchemy");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Many choices");
    const pair = within(await screen.findByRole("group", { name: "Choose 2" }));
    const overlap = within(screen.getByRole("group", { name: "Choose 1" }));
    await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
    await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
    await user.click(overlap.getByRole("checkbox"));
    await act(async () => overlapRead.reject(new Error("overlap failed")));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(
      screen.getAllByRole("status", { name: "Loading skills" }),
    ).toHaveLength(1);
    expect(sheet().getByText("No skills.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(pair.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "disabled",
      false,
    );
    await act(async () => pairRead.resolve());
    await sheet().findByText("Alteration (Novice)");
    expect(sheet().getAllByText("Alchemy (Novice)")).toHaveLength(1);
    expect(screen.queryByRole("status", { name: "Loading skills" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Retry skill selection" }),
    ).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it.each(["success", "failure"])(
    "ignores pending bonuses after changing race, including late %s",
    async (outcome) => {
      const catalog = fixtureCatalog();
      const reads = controlledReads(catalog);
      const bonus = reads.hold("skill", "alchemy");
      const user = userEvent.setup();
      renderForge(catalog);
      await selectRace("Altmer");
      await user.click(
        await screen.findByRole("checkbox", { name: "Alchemy" }),
      );
      await selectRace("Argonian");
      await sheet().findByText("Argonian");
      await act(async () => {
        if (outcome === "success") bonus.resolve();
        else bonus.reject(new Error("old bonus"));
      });
      expect(sheet().getByText("No skills.")).toBeTruthy();
      expect(screen.queryByRole("checkbox")).toBeNull();
      expect(
        screen.queryByRole("status", { name: "Loading skills" }),
      ).toBeNull();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(console.error).not.toHaveBeenCalled();
    },
  );

  it("restores resolved groups after cancel but requires retained unresolved selections to be resubmitted", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const pairRead = reads.hold("skill", "alchemy");
    const raceRead = reads.hold("race", "argonian");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Many choices");
    const pair = within(await screen.findByRole("group", { name: "Choose 2" }));
    const overlap = within(screen.getByRole("group", { name: "Choose 1" }));
    await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
    await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
    await user.click(overlap.getByRole("checkbox"));
    await sheet().findByText("Alchemy (Novice)");
    await selectRace("Argonian");
    expect(sheet().queryByText("Alchemy (Novice)")).toBeNull();
    expect(sheet().queryByText("Int: 30")).toBeNull();
    expect(pair.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      true,
    );
    expect(overlap.getByRole("checkbox")).toHaveProperty("disabled", true);
    await user.click(
      screen.getByRole("button", { name: "Cancel race selection" }),
    );
    expect(sheet().getByText("Alchemy (Novice)")).toBeTruthy();
    expect(sheet().queryByText("Alteration (Novice)")).toBeNull();
    expect(screen.getByText("Retry this skill selection.")).toBeTruthy();
    expect(pair.getByRole("checkbox", { name: "Alteration" })).toHaveProperty(
      "checked",
      true,
    );
    expect(overlap.getByRole("checkbox")).toHaveProperty("disabled", false);
    await act(async () => {
      pairRead.resolve();
      raceRead.reject(new Error("canceled race"));
    });
    expect(reads.get).not.toHaveBeenCalledWith("skill", "alteration");
    expect(sheet().queryByText("Alteration (Novice)")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Retry skill selection" }),
    );
    await sheet().findByText("Alteration (Novice)");
    expect(sheet().getAllByText("Alchemy (Novice)")).toHaveLength(1);
    expect(screen.queryByText("Retry this skill selection.")).toBeNull();
  });

  it("retains a failed choose-two answer with no partial grants, acknowledges once, and reopens on a failed retry", async () => {
    const catalog = fixtureCatalog();
    const reads = controlledReads(catalog);
    const fail = reads.hold("skill", "alteration");
    const retry = reads.hold("skill", "alteration");
    const user = userEvent.setup();
    renderForge(catalog);
    await selectRace("Many choices");
    const pair = within(await screen.findByRole("group", { name: "Choose 2" }));
    const overlap = within(screen.getByRole("group", { name: "Choose 1" }));
    await user.click(pair.getByRole("checkbox", { name: "Alchemy" }));
    await user.click(pair.getByRole("checkbox", { name: "Alteration" }));
    await waitFor(() =>
      expect(reads.get).toHaveBeenCalledWith("skill", "alteration"),
    );
    await act(async () => fail.reject(new Error("first attempt")));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(sheet().getByText("No skills.")).toBeTruthy();
    expect(pair.getByRole("checkbox", { name: "Alchemy" })).toHaveProperty(
      "checked",
      true,
    );
    expect(pair.getByRole("checkbox", { name: "Alteration" })).toHaveProperty(
      "checked",
      true,
    );
    expect(console.error).toHaveBeenCalledWith(
      "Character content selection failed.",
      expect.arrayContaining([
        expect.objectContaining({
          code: "content-unavailable",
          choiceId: "manyChoices/pair",
        }),
      ]),
    );
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.click(overlap.getByRole("checkbox"));
    await sheet().findByText("Alchemy (Novice)");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
    expectNavigationBlocked();
    await user.click(
      screen.getByRole("button", { name: "Retry skill selection" }),
    );
    await waitFor(() =>
      expect(
        reads.get.mock.calls.filter(
          ([kind, key]) => kind === "skill" && key === "alteration",
        ),
      ).toHaveLength(2),
    );
    await act(async () => retry.reject(new Error("retry failed")));
    await screen.findByRole("dialog", { name: "Something went wrong!" });
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(sheet().queryByText("Alteration (Novice)")).toBeNull();
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.click(
      screen.getByRole("button", { name: "Retry skill selection" }),
    );
    await sheet().findByText("Alteration (Novice)");
    expect(sheet().getAllByText("Alchemy (Novice)")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Retry skill selection" }),
    ).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
