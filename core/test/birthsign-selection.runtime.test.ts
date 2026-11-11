import { describe, expect, it } from "vitest";
import {
  BIRTHSIGN_CHARGE_TABLES,
  CharacterCreator,
  ContentError,
  type Birthsign,
  type BirthsignRoll,
  type BirthsignSelection,
} from "../src/index";
import {
  creationCatalogs,
  deferred,
  TestContentCatalog,
} from "./support/ContentCatalog";

function setup() {
  const signs: Record<string, Birthsign> = {};
  for (const table of BIRTHSIGN_CHARGE_TABLES) {
    for (const key of table.entries) {
      signs[key] = {
        label: key,
        description: "Lore",
        bonuses: [],
        starCursed: { overwriteBaseBonuses: false, bonuses: [] },
      };
    }
  }
  signs.theThief!.starCursed.eligibility = {
    requiresNaturallyRolledSign: true,
    canSelectBySpendingLuck: false,
  };
  const catalog = new TestContentCatalog({
    ...creationCatalogs().catalog.definitions,
    birthsign: signs,
  });
  const creator = new CharacterCreator(catalog);
  return {
    creator,
    catalog,
    signs,
    snapshot: () => creator.getSnapshot().birthsignSelection,
  };
}

const normal: BirthsignSelection = { signKey: "theWarrior", variant: "normal" };
const star: BirthsignSelection = {
  signKey: "theWarrior",
  variant: "starCursed",
};
const thief: BirthsignSelection = {
  signKey: "theThief",
  variant: "starCursed",
};
const roll: BirthsignRoll = { id: "original", charge: "warrior", dice: [1] };

describe("headless birthsign selection", () => {
  it("rejects invalid variants and restoring before a roll without content I/O", async () => {
    const { creator, catalog, snapshot } = setup();
    expect(await creator.restoreOriginalBirthsign()).toMatchObject({
      ok: false,
      issues: [{ code: "original-required" }],
    });
    expect(
      await creator.chooseBirthsign({
        ...normal,
        variant: "invalid" as BirthsignSelection["variant"],
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-selection" }] });
    expect(
      await creator.chooseBirthsign({ ...normal, signKey: " " }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-selection" }] });
    expect(snapshot().selected).toBeUndefined();
    expect(catalog.getCalls).toEqual([]);
  });

  it("locks even while original content is pending and retains history on cancellation", async () => {
    const { creator, catalog, snapshot } = setup();
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.submitBirthsignRoll(roll);
    expect(snapshot()).toMatchObject({
      original: { roll },
      load: { status: "loading" },
    });
    expect(
      await creator.submitBirthsignRoll({
        ...roll,
        id: "retry",
        charge: "mage",
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "roll-locked" }] });
    creator.cancelBirthsignSelection();
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(snapshot()).toMatchObject({
      original: { roll },
      selected: undefined,
      load: undefined,
    });
    catalog.beforeGet = undefined;
    await creator.restoreOriginalBirthsign();
    expect(snapshot().selected).toEqual(normal);
  });

  it("detaches failed command results and pending/failed snapshot issues", async () => {
    const { creator, catalog, snapshot } = setup();
    catalog.beforeGet = async () => {
      throw new Error("offline");
    };
    const result = await creator.chooseBirthsign(normal);
    if (!result.ok) result.issues[0]!.message = "Result mutation";
    const state = snapshot();
    expect(state.load!.issues[0]!.message).not.toBe("Result mutation");
    state.load!.selection.signKey = "changed";
    state.load!.issues[0]!.message = "Snapshot mutation";
    expect(snapshot().load).toMatchObject({ selection: normal });
    expect(snapshot().load!.issues[0]!.message).not.toBe("Snapshot mutation");
  });

  it("supersedes reference-stage success/failure without publishing stale definitions", async () => {
    for (const fails of [true, false]) {
      const { creator, catalog, signs, snapshot } = setup();
      await creator.submitBirthsignRoll(roll);
      signs.theMage!.bonuses = [
        { bonusType: "trait", bonusTargetKey: "amphibious" },
      ];
      const started = deferred();
      const gate = deferred();
      catalog.beforeGet = async (kind) => {
        if (kind !== "trait") return;
        started.resolve();
        await gate.promise;
      };
      const pending = creator.chooseBirthsign({
        signKey: "theMage",
        variant: "normal",
      });
      await started.promise;
      await creator.chooseBirthsign(star);
      if (fails) gate.reject(new Error("stale reference"));
      else gate.resolve();
      expect(await pending).toMatchObject({
        ok: false,
        issues: [{ code: "superseded" }],
      });
      expect(snapshot()).toMatchObject({
        selected: star,
        definition: { label: "theWarrior" },
        load: undefined,
      });
    }
  });

  for (const table of BIRTHSIGN_CHARGE_TABLES) {
    for (let face = 1; face <= 4; face++) {
      for (const fives of [0, 1, 2, 1000]) {
        it(`resolves ${table.guardian} face ${face} after ${fives} fives`, async () => {
          const { creator, snapshot } = setup();
          const input = {
            id: "roll",
            charge: table.guardian,
            dice: [...Array<number>(fives).fill(5), face],
          };
          expect((await creator.submitBirthsignRoll(input)).ok).toBe(true);
          const expected = {
            signKey: table.entries[face - 1],
            variant: fives ? "starCursed" : "normal",
          };
          expect(snapshot()).toMatchObject({
            original: { roll: input, selection: expected },
            selected: expected,
            acquisitionMethod: "original",
            purchaseCost: 0,
          });
        });
      }
    }
  }

  it.each(
    [
      [],
      [5],
      [5, 5],
      [0],
      [6],
      [-1],
      [1.5],
      [NaN],
      [Infinity],
      [1, 2],
      [5, 1, 2],
      [2, 5, 1],
      [5, 0],
      Array<number>(2),
    ].map((dice) => ({ dice })),
  )(
    "rejects incomplete/invalid/trailing sequences atomically: $dice",
    async ({ dice }) => {
      const { creator, snapshot, catalog } = setup();
      const before = snapshot();
      expect(
        await creator.submitBirthsignRoll({ ...roll, dice }),
      ).toMatchObject({ ok: false, issues: [{ code: "invalid-roll" }] });
      expect(snapshot()).toEqual(before);
      expect(catalog.getCalls).toEqual([]);
      expect((await creator.submitBirthsignRoll(roll)).ok).toBe(true);
    },
  );

  it("requires identity and a declared table, and locks every later submission", async () => {
    const { creator, snapshot } = setup();
    for (const input of [
      { ...roll, id: " " },
      { ...roll, charge: "other" as BirthsignRoll["charge"] },
    ]) {
      expect(await creator.submitBirthsignRoll(input)).toMatchObject({
        ok: false,
        issues: [{ code: "invalid-roll" }],
      });
    }
    await creator.submitBirthsignRoll(roll);
    const before = snapshot();
    for (const input of [
      roll,
      { ...roll, dice: [] },
      { id: "new", charge: "mage" as const, dice: [4] },
    ]) {
      expect(await creator.submitBirthsignRoll(input)).toMatchObject({
        ok: false,
        issues: [{ code: "roll-locked" }],
      });
      expect(snapshot()).toEqual(before);
    }
  });

  it("supports pre-roll purchases, retaining explicit selection and rederiving acquisition method", async () => {
    const { creator, snapshot } = setup();
    await creator.chooseBirthsign(star);
    expect(snapshot()).toMatchObject({
      original: undefined,
      purchaseCost: 10,
      acquisitionMethod: "purchase",
    });
    await creator.submitBirthsignRoll(roll);
    expect(snapshot()).toMatchObject({
      selected: star,
      purchaseCost: 5,
      acquisitionMethod: "upgrade",
    });
    await creator.chooseBirthsign(normal);
    expect(snapshot()).toMatchObject({
      selected: normal,
      purchaseCost: 0,
      acquisitionMethod: "original",
    });
    await creator.chooseBirthsign({ signKey: "theMage", variant: "normal" });
    expect(snapshot().purchaseCost).toBe(5);
    await creator.chooseBirthsign({
      signKey: "theMage",
      variant: "starCursed",
    });
    expect(snapshot().purchaseCost).toBe(10);
    expect((await creator.restoreOriginalBirthsign()).ok).toBe(true);
    expect(snapshot()).toMatchObject({
      selected: normal,
      original: { roll },
      purchaseCost: 0,
    });
  });

  it("returns a naturally Star-Cursed original for zero, normal same-sign purchase costs five", async () => {
    const { creator, snapshot } = setup();
    await creator.submitBirthsignRoll({ ...roll, dice: [5, 5, 1] });
    await creator.chooseBirthsign(normal);
    expect(snapshot()).toMatchObject({
      purchaseCost: 5,
      acquisitionMethod: "purchase",
    });
    await creator.restoreOriginalBirthsign();
    expect(snapshot()).toMatchObject({
      selected: star,
      purchaseCost: 0,
      acquisitionMethod: "original",
    });
  });

  it("allows the explicit paid normal Thief upgrade but not a Star-Thief purchase", async () => {
    const { creator, snapshot } = setup();
    expect(await creator.chooseBirthsign(thief)).toMatchObject({
      ok: false,
      issues: [{ code: "ineligible-selection" }],
    });
    await creator.submitBirthsignRoll({ ...roll, charge: "thief" });
    expect((await creator.chooseBirthsign(thief)).ok).toBe(true);
    expect(snapshot()).toMatchObject({
      selected: thief,
      purchaseCost: 5,
      acquisitionMethod: "upgrade",
    });
    await creator.restoreOriginalBirthsign();
    expect(snapshot()).toMatchObject({
      selected: { ...thief, variant: "normal" },
      purchaseCost: 0,
    });
    const other = setup();
    await other.creator.submitBirthsignRoll(roll);
    const before = other.snapshot();
    expect((await other.creator.chooseBirthsign(thief)).ok).toBe(false);
    expect(other.snapshot()).toEqual(before);
    const natural = setup();
    await natural.creator.submitBirthsignRoll({
      ...roll,
      charge: "thief",
      dice: [5, 1],
    });
    await natural.creator.chooseBirthsign(normal);
    await natural.creator.restoreOriginalBirthsign();
    expect(natural.snapshot()).toMatchObject({
      selected: thief,
      purchaseCost: 0,
      acquisitionMethod: "original",
    });
  });

  it("free choice covers every variant, preserving and revalidating answers on return", async () => {
    const { creator, snapshot } = setup();
    await creator.submitBirthsignRoll(roll);
    creator.setFreeBirthsignChoice(true);
    for (const table of BIRTHSIGN_CHARGE_TABLES) {
      for (const signKey of table.entries) {
        for (const variant of ["normal", "starCursed"] as const) {
          expect((await creator.chooseBirthsign({ signKey, variant })).ok).toBe(
            true,
          );
          expect(snapshot().purchaseCost).toBe(0);
        }
      }
    }
    await creator.chooseBirthsign(thief);
    expect(creator.setFreeBirthsignChoice(false)).toMatchObject({
      ok: false,
      issues: [{ code: "ineligible-selection" }],
    });
    expect(snapshot()).toMatchObject({
      selected: thief,
      original: { roll },
      purchaseCost: undefined,
      eligibilityIssues: [{ code: "ineligible-selection" }],
    });
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign(star);
    creator.setFreeBirthsignChoice(false);
    expect(snapshot()).toMatchObject({
      selected: star,
      purchaseCost: 5,
      acquisitionMethod: "upgrade",
    });
    await creator.restoreOriginalBirthsign();
    expect(snapshot().purchaseCost).toBe(0);
    expect((await creator.submitBirthsignRoll(roll)).ok).toBe(false);
  });

  it("never applies or repeatedly deducts costs, touches navigation, or mutates via browsing", async () => {
    const { creator, catalog, snapshot } = setup();
    await creator.chooseRace("argonian");
    const preview = creator.getCharacterPreview();
    const steps = creator.getSnapshot().steps;
    await creator.submitBirthsignRoll(roll);
    for (let count = 0; count < 3; count++) await creator.chooseBirthsign(star);
    await catalog.get("birthsign", "theMage");
    creator.next();
    creator.previous();
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(snapshot().purchaseCost).toBe(5);
    expect(creator.getCharacterPreview()).toEqual(preview);
    expect(creator.getSnapshot().steps.map((step) => step.id)).toEqual(
      steps.map((step) => step.id),
    );
    expect(
      (await creator.submitBirthsignRoll({ ...roll, charge: "mage" })).ok,
    ).toBe(false);
  });

  it("detaches inputs, content, snapshots, history and issues", async () => {
    const { creator, signs, snapshot } = setup();
    const dice = [5, 1];
    await creator.submitBirthsignRoll({ ...roll, dice });
    dice[0] = 1;
    signs.theWarrior!.label = "Adapter mutation";
    const state = snapshot();
    state.original!.selection.signKey = "changed";
    state.original!.roll = roll;
    state.selected!.variant = "normal";
    state.definition!.label = "Snapshot mutation";
    expect(snapshot()).toMatchObject({
      original: { roll: { dice: [5, 1] }, selection: star },
      selected: star,
      definition: { label: "theWarrior" },
    });
    creator.setFreeBirthsignChoice(true);
    await creator.chooseBirthsign(thief);
    const result = creator.setFreeBirthsignChoice(false);
    if (!result.ok) result.issues[0]!.message = "changed";
    expect(snapshot().eligibilityIssues[0]!.message).not.toBe("changed");
  });

  it("locks history before failed content reads and retries without duplicate dice", async () => {
    const { creator, catalog, snapshot } = setup();
    catalog.beforeGet = async () => {
      throw new Error("offline");
    };
    expect(await creator.submitBirthsignRoll(roll)).toMatchObject({
      ok: false,
      issues: [{ code: "content-unavailable" }],
    });
    expect(snapshot()).toMatchObject({
      original: { roll },
      selected: undefined,
      load: { status: "failed" },
    });
    expect(await creator.submitBirthsignRoll(roll)).toMatchObject({
      ok: false,
      issues: [{ code: "roll-locked" }],
    });
    catalog.beforeGet = undefined;
    expect((await creator.restoreOriginalBirthsign()).ok).toBe(true);
    expect(snapshot()).toMatchObject({
      original: { roll },
      selected: normal,
      load: undefined,
    });
  });

  it("preserves committed state on absent/malformed content, access denial and revision failures", async () => {
    const { creator, catalog, signs, snapshot } = setup();
    await creator.submitBirthsignRoll(roll);
    const before = snapshot();
    expect(
      await creator.chooseBirthsign({ signKey: "absent", variant: "normal" }),
    ).toMatchObject({ ok: false, issues: [{ code: "unknown-birthsign" }] });
    expect(snapshot()).toEqual(before);
    signs.theMage!.label = 42 as unknown as string;
    expect(
      await creator.chooseBirthsign({ signKey: "theMage", variant: "normal" }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-content" }] });
    expect(snapshot().selected).toEqual(normal);
    creator.cancelBirthsignSelection();
    expect(snapshot()).toEqual(before);
    catalog.beforeGet = async () => {
      throw new ContentError("content-access-denied", "Denied");
    };
    expect(await creator.chooseBirthsign(star)).toMatchObject({
      ok: false,
      issues: [{ code: "content-access-denied" }],
    });
    catalog.beforeGet = undefined;
    catalog.version.revision = "updated";
    expect(await creator.chooseBirthsign(star)).toMatchObject({
      ok: false,
      issues: [{ code: "content-version-mismatch" }],
    });
    expect(snapshot().original).toEqual(before.original);
  });

  it("validates references in both variants and unselected choice branches", async () => {
    const { creator, signs, catalog, snapshot } = setup();
    signs.theMage!.starCursed.bonuses = [
      {
        bonusType: "choice",
        lifecycle: { selection: "once" },
        choiceGroup: {
          id: "power",
          choose: 1,
          options: [
            {
              id: "missing",
              effects: [{ bonusType: "power", bonusTargetKey: "missing" }],
            },
          ],
        },
      },
    ];
    expect(
      await creator.chooseBirthsign({ signKey: "theMage", variant: "normal" }),
    ).toMatchObject({ ok: false, issues: [{ code: "invalid-content" }] });
    expect(snapshot().selected).toBeUndefined();
    expect(catalog.getCalls).toContainEqual({ kind: "power", key: "missing" });
    signs.theMage!.starCursed.bonuses = [
      { bonusType: "trait", bonusTargetKey: "weakness", bonusParams: { X: 2 } },
    ];
    expect(
      (await creator.chooseBirthsign({ signKey: "theMage", variant: "normal" }))
        .ok,
    ).toBe(false);
    signs.theMage!.starCursed.bonuses = [
      {
        bonusType: "trait",
        bonusTargetKey: "weakness",
        bonusParams: { X: 2, type: "magic" },
      },
    ];
    expect(
      (await creator.chooseBirthsign({ signKey: "theMage", variant: "normal" }))
        .ok,
    ).toBe(true);
    expect(catalog.listCalls).toEqual([]);
  });

  it("latest selection wins and stale failures cannot replace committed answers or errors", async () => {
    const { creator, catalog, snapshot } = setup();
    await creator.submitBirthsignRoll(roll);
    const gate = deferred();
    catalog.beforeGet = async (_kind, key) => {
      if (key === "theMage") await gate.promise;
    };
    const old = creator.chooseBirthsign({
      signKey: "theMage",
      variant: "normal",
    });
    expect(snapshot().load?.status).toBe("loading");
    await creator.chooseBirthsign(star);
    gate.reject(new Error("stale"));
    expect(await old).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(snapshot()).toMatchObject({
      selected: star,
      load: undefined,
      original: { roll },
    });
  });

  it("cancel/reselect committed answer invalidates pending success and failure", async () => {
    for (const cancel of [true, false]) {
      const { creator, catalog, snapshot } = setup();
      await creator.submitBirthsignRoll(roll);
      const gate = deferred();
      catalog.beforeGet = async () => gate.promise;
      const pending = creator.chooseBirthsign(star);
      if (cancel) creator.cancelBirthsignSelection();
      else await creator.chooseBirthsign(normal);
      gate.resolve();
      expect(await pending).toMatchObject({
        ok: false,
        issues: [{ code: "superseded" }],
      });
      expect(snapshot()).toMatchObject({
        selected: normal,
        load: undefined,
        purchaseCost: 0,
      });
    }
  });

  it("checks current mode at async commit, not captured free-choice permission", async () => {
    const { creator, catalog, snapshot } = setup();
    creator.setFreeBirthsignChoice(true);
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseBirthsign(thief);
    creator.setFreeBirthsignChoice(false);
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "ineligible-selection" }],
    });
    expect(snapshot().selected).toBeUndefined();
  });

  it("detects revision changes during reads and disposal invalidates commands and clears data", async () => {
    const { creator, catalog, snapshot } = setup();
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.submitBirthsignRoll(roll);
    catalog.version.revision = "changed";
    gate.resolve();
    expect(await pending).toMatchObject({
      ok: false,
      issues: [{ code: "content-version-mismatch" }],
    });
    creator.cancelBirthsignSelection();
    catalog.version.revision = "test-revision";
    const nextGate = deferred();
    catalog.beforeGet = async () => nextGate.promise;
    const next = creator.restoreOriginalBirthsign();
    creator.dispose();
    nextGate.resolve();
    expect(await next).toMatchObject({
      ok: false,
      issues: [{ code: "superseded" }],
    });
    expect(snapshot()).toMatchObject({
      selected: undefined,
      original: undefined,
      definition: undefined,
      load: undefined,
    });
    for (const result of [
      await creator.chooseBirthsign(normal),
      await creator.restoreOriginalBirthsign(),
      await creator.submitBirthsignRoll(roll),
      creator.setFreeBirthsignChoice(true),
    ]) {
      expect(result).toMatchObject({
        ok: false,
        issues: [{ code: "disposed" }],
      });
    }
  });
});
