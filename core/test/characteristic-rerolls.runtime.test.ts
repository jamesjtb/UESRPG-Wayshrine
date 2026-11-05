import { describe, expect, it } from "vitest";
import {
  CharacterCreator,
  Characteristic,
  calculateCharacteristicGeneration,
  validateCharacteristicGeneration,
} from "../src/index";
import type {
  CharacteristicGenerationCommandResult,
  CharacteristicRerollReplacement,
} from "../src/index";
import { creationCatalogs, deferred } from "./support/ContentCatalog";

const keys = Object.values(Characteristic);

function pool() {
  return keys.map((key) => ({ id: key, dice: [10, 10] }));
}

function assignments() {
  return Object.fromEntries(keys.map((key) => [key, key]));
}

function batch(count = 1, prefix = "new"): CharacteristicRerollReplacement[] {
  return keys.slice(0, count).map((key) => ({
    targetRollId: key,
    replacement: { id: `${prefix}-${key}`, dice: [1, 1] },
  }));
}

function setup(initialized = true) {
  const { catalog } = creationCatalogs();
  const creator = new CharacterCreator(catalog);
  creator.setCharacteristicGenerationMethod("rolled");
  creator.setFavoredCharacteristics([Characteristic.Str, Characteristic.Int]);
  creator.submitLuckRoll({ id: "luck", dice: [6, 8] });
  if (initialized) {
    creator.submitCharacteristicRolls(pool());
    creator.setCharacteristicAssignments(assignments());
  }
  return { creator, catalog };
}

function expectIssue(
  result: CharacteristicGenerationCommandResult,
  code: string,
) {
  expect(result).toMatchObject({
    ok: false,
    issues: expect.arrayContaining([
      expect.objectContaining({ code, message: expect.any(String) }),
    ]),
  });
}

function expectUnchanged(
  creator: CharacterCreator,
  command: () => CharacteristicGenerationCommandResult,
  code: string,
) {
  const snapshot = creator.getSnapshot();
  const preview = creator.getCharacterPreview();
  expectIssue(command(), code);
  expect(creator.getSnapshot()).toEqual(snapshot);
  expect(creator.getCharacterPreview()).toEqual(preview);
}

describe("Core characteristic reroll commands", () => {
  it("requires rolled generation without activating a method or changing a valid inactive pool", () => {
    const { catalog } = creationCatalogs();
    const creator = new CharacterCreator(catalog);
    creator.submitCharacteristicRolls(pool());
    expectUnchanged(
      creator,
      () => creator.rerollCharacteristics(batch()),
      "generation-method",
    );
    creator.setCharacteristicGenerationMethod("rolled");
    expect(creator.rerollCharacteristics(batch()).ok).toBe(true);
  });

  it.each([1, 2, 3])(
    "spends the whole normal allowance on a batch of %i",
    async (count) => {
      const { creator, catalog } = setup();
      await creator.chooseRace("argonian");
      const before = creator.getSnapshot().characteristicGeneration;
      expect(before.rerolls).toEqual({
        unlimited: false,
        batchSpent: false,
        initialized: true,
        available: true,
        maxBatchSize: 3,
      });
      const replacements = batch(count);
      expect(creator.rerollCharacteristics(replacements).ok).toBe(true);
      const after = creator.getSnapshot().characteristicGeneration;
      expect(after.rerolls).toEqual({
        unlimited: false,
        batchSpent: true,
        initialized: true,
        available: false,
        maxBatchSize: 0,
      });
      expect(after.drafts.rolled.rolls).toEqual([
        ...replacements.map((pair) => pair.replacement),
        ...pool().slice(count),
      ]);
      const retained = assignments();
      for (const key of keys.slice(0, count)) delete retained[key];
      expect(after.drafts.rolled.assignments).toEqual(retained);
      expect(after.drafts.luck).toEqual(before.drafts.luck);
      expect(after.drafts.favored).toEqual(before.drafts.favored);
      expect(after.drafts.pointBuy).toEqual(before.drafts.pointBuy);
      expectUnchanged(
        creator,
        () => creator.rerollCharacteristics(batch(1, "again")),
        "reroll-unavailable",
      );
      creator.setCharacteristicAssignments({
        ...retained,
        ...Object.fromEntries(
          replacements.map((pair, index) => [keys[index], pair.replacement.id]),
        ),
      });
      expect(creator.getSnapshot().characteristicGeneration.complete).toBe(
        true,
      );
      expect(creator.getCharacterPreview().characteristics.str.rolled).toBe(2);
      expect(creator.finish().ok).toBe(true);
      expect(
        validateCharacteristicGeneration(
          creator.getSnapshot().characteristicGeneration.answer,
        ),
      ).toEqual([]);
      const calculated = calculateCharacteristicGeneration(
        creator.getSnapshot().characteristicGeneration.answer,
      );
      expect(calculated.ok).toBe(true);
      expect(
        creator.getSnapshot().characteristicGeneration.answer,
      ).not.toHaveProperty("rerolls");
      expect(creator.getCharacterPreview()).not.toHaveProperty("rerolls");
      expect(catalog.getCalls).toEqual([
        { kind: "race", key: "argonian" },
        { kind: "trait", key: "amphibious" },
      ]);
    },
  );

  it.each([0, 4, 7])(
    "rejects a normal batch of %i without spending it",
    (count) => {
      const { creator } = setup();
      expectUnchanged(
        creator,
        () => creator.rerollCharacteristics(batch(count)),
        "reroll-count",
      );
      expect(creator.rerollCharacteristics(batch()).ok).toBe(true);
    },
  );

  it("allows repeated unlimited batches of seven and spends the normal allowance even in unlimited mode", () => {
    const { creator } = setup();
    expect(creator.setUnlimitedCharacteristicRerolls(true).ok).toBe(true);
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ maxBatchSize: 7, batchSpent: false });
    expectUnchanged(
      creator,
      () =>
        creator.rerollCharacteristics([
          ...batch(7),
          { targetRollId: "str", replacement: { id: "eighth", dice: [1, 2] } },
        ]),
      "reroll-count",
    );
    expect(creator.rerollCharacteristics(batch(7)).ok).toBe(true);
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ batchSpent: true, available: true, maxBatchSize: 7 });
    const second = batch(7, "second").map((pair) => ({
      ...pair,
      targetRollId: `new-${pair.targetRollId}`,
    }));
    expect(creator.rerollCharacteristics(second).ok).toBe(true);
    creator.setUnlimitedCharacteristicRerolls(false);
    expectUnchanged(
      creator,
      () => creator.rerollCharacteristics(batch()),
      "reroll-unavailable",
    );
    creator.setUnlimitedCharacteristicRerolls(true);
    expect(
      creator.rerollCharacteristics([
        {
          targetRollId: "second-str",
          replacement: { id: "third", dice: [2, 2] },
        },
      ]).ok,
    ).toBe(true);
    creator.setUnlimitedCharacteristicRerolls(false);
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ batchSpent: true, available: false });
  });

  it("does not spend or restore the allowance merely by toggling unlimited", () => {
    const { creator } = setup();
    creator.setUnlimitedCharacteristicRerolls(true);
    creator.setUnlimitedCharacteristicRerolls(false);
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ batchSpent: false, available: true, maxBatchSize: 3 });
    creator.rerollCharacteristics(batch());
    creator.setUnlimitedCharacteristicRerolls(true);
    expect(
      creator.rerollCharacteristics([
        { targetRollId: "end", replacement: { id: "more", dice: [1, 1] } },
      ]).ok,
    ).toBe(true);
    creator.setUnlimitedCharacteristicRerolls(false);
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls.batchSpent,
    ).toBe(true);
  });

  it("keeps invalid initial drafts editable and locks only a valid pool, independently of method or other answers", () => {
    const { creator } = setup(false);
    creator.setCharacteristicGenerationMethod("point-buy");
    expectIssue(
      creator.submitCharacteristicRolls(pool().slice(1)),
      "roll-count",
    );
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.rolls,
    ).toHaveLength(6);
    const invalid = pool();
    invalid[0]!.dice = [0, 11];
    expectIssue(creator.submitCharacteristicRolls(invalid), "invalid-dice");
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ initialized: false, batchSpent: false });
    creator.setCharacteristicGenerationMethod("rolled");
    expectUnchanged(
      creator,
      () => creator.rerollCharacteristics(batch()),
      "pool-uninitialized",
    );
    creator.setCharacteristicAssignments({ str: "str" });
    creator.setFavoredCharacteristics([]);
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(creator.submitCharacteristicRolls(pool()).ok).toBe(true);
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({});
    expect(
      creator.getSnapshot().characteristicGeneration.rerolls,
    ).toMatchObject({ initialized: true, available: false, maxBatchSize: 0 });
    for (const replacement of [[], pool(), invalid]) {
      expectUnchanged(
        creator,
        () => creator.submitCharacteristicRolls(replacement),
        "pool-initialized",
      );
    }
    creator.setUnlimitedCharacteristicRerolls(true);
    expectUnchanged(
      creator,
      () => creator.submitCharacteristicRolls(pool()),
      "pool-initialized",
    );
    expectUnchanged(
      creator,
      () => creator.rerollCharacteristics(batch()),
      "generation-method",
    );
    creator.setCharacteristicGenerationMethod("rolled");
    expect(creator.rerollCharacteristics(batch()).ok).toBe(true);
  });

  const rejected: {
    name: string;
    replacements: CharacteristicRerollReplacement[];
    code: string;
  }[] = [
    {
      name: "unknown target",
      replacements: [
        { targetRollId: "missing", replacement: { id: "new", dice: [1, 2] } },
      ],
      code: "reroll-target",
    },
    {
      name: "Luck target",
      replacements: [
        { targetRollId: "luck", replacement: { id: "new", dice: [1, 2] } },
      ],
      code: "reroll-target",
    },
    {
      name: "duplicate target",
      replacements: [
        batch()[0]!,
        { targetRollId: "str", replacement: { id: "other", dice: [1, 2] } },
      ],
      code: "reroll-target",
    },
    {
      name: "duplicate new ID",
      replacements: [
        batch()[0]!,
        { targetRollId: "end", replacement: { id: "new-str", dice: [1, 2] } },
      ],
      code: "roll-identity",
    },
    {
      name: "target ID reused",
      replacements: [
        { targetRollId: "str", replacement: { id: "str", dice: [1, 2] } },
      ],
      code: "roll-identity",
    },
    {
      name: "untouched ID reused",
      replacements: [
        { targetRollId: "str", replacement: { id: "end", dice: [1, 2] } },
      ],
      code: "roll-identity",
    },
    {
      name: "another selected ID reused",
      replacements: [
        batch()[0]!,
        { targetRollId: "end", replacement: { id: "str", dice: [1, 2] } },
      ],
      code: "roll-identity",
    },
    {
      name: "empty ID",
      replacements: [
        { targetRollId: "str", replacement: { id: "  ", dice: [1, 2] } },
      ],
      code: "roll-identity",
    },
  ];
  for (const dice of [
    [0, 10],
    [1, 11],
    [1.5, 2],
    [NaN, 2],
    [Infinity, 1],
    [1],
    [1, 2, 3],
  ]) {
    rejected.push({
      name: `invalid faces ${dice}`,
      replacements: [{ targetRollId: "str", replacement: { id: "new", dice } }],
      code: "invalid-dice",
    });
  }
  it.each(rejected)(
    "rejects $name atomically, leaving valid answers valid",
    async ({ replacements, code }) => {
      const { creator } = setup();
      await creator.chooseRace("argonian");
      expectUnchanged(
        creator,
        () => creator.rerollCharacteristics(replacements),
        code,
      );
      expect(creator.getSnapshot().canFinish).toBe(true);
      expect(creator.getSnapshot().characteristicGeneration.issues).toEqual([]);
      expect(creator.rerollCharacteristics(batch()).ok).toBe(true);
    },
  );

  it("validates every pair before mutation, preserves pool ordering and sheds only targeted assignments", () => {
    const { creator } = setup();
    const outOfOrder = [batch(3)[2]!, batch()[0]!];
    expect(creator.rerollCharacteristics(outOfOrder).ok).toBe(true);
    expect(
      creator
        .getSnapshot()
        .characteristicGeneration.drafts.rolled.rolls.map((roll) => roll.id),
    ).toEqual(["new-str", "end", "new-ag", "int", "wp", "prc", "prs"]);
    expect(
      creator.getSnapshot().characteristicGeneration.drafts.rolled.assignments,
    ).toEqual({ end: "end", int: "int", wp: "wp", prc: "prc", prs: "prs" });
    const { creator: another } = setup();
    expectUnchanged(
      another,
      () =>
        another.rerollCharacteristics([
          batch()[0]!,
          { targetRollId: "end", replacement: { id: "bad", dice: [0, 0] } },
        ]),
      "invalid-dice",
    );
    expect(another.rerollCharacteristics(batch()).ok).toBe(true);
  });

  it("detaches replacement pairs, dice, snapshot policy and both snapshot pool copies", () => {
    const { creator } = setup();
    const replacements = batch();
    creator.rerollCharacteristics(replacements);
    const before = creator.getSnapshot().characteristicGeneration;
    replacements[0]!.targetRollId = "end";
    replacements[0]!.replacement.id = "changed";
    Object.defineProperty(replacements[0]!.replacement.dice, "0", {
      value: 10,
    });
    replacements.length = 0;
    const snapshot = creator.getSnapshot().characteristicGeneration;
    snapshot.rerolls.batchSpent = false;
    snapshot.rerolls.unlimited = true;
    snapshot.rerolls.initialized = false;
    snapshot.rerolls.available = true;
    snapshot.rerolls.maxBatchSize = 100;
    Object.defineProperty(snapshot.drafts.rolled.rolls[0]!.dice, "0", {
      value: 10,
    });
    if (snapshot.answer.method !== "rolled")
      throw new Error("Expected rolled answer");
    expect(snapshot.answer.rolls![0]!.dice).toEqual([1, 1]);
    Object.defineProperty(snapshot.answer.rolls![0], "id", {
      value: "changed",
    });
    expect(creator.getSnapshot().characteristicGeneration).toEqual(before);
    expectUnchanged(
      creator,
      () => creator.rerollCharacteristics(batch()),
      "reroll-unavailable",
    );
  });

  it("retains session policy through method, race and navigation changes; fresh creators and disposal are isolated", async () => {
    const { creator, catalog } = setup();
    await creator.chooseRace("argonian");
    creator.next();
    creator.rerollCharacteristics(batch());
    creator.setUnlimitedCharacteristicRerolls(true);
    const policy = creator.getSnapshot().characteristicGeneration.rerolls;
    creator.previous();
    creator.next();
    creator.setCharacteristicGenerationMethod("point-buy");
    expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual({
      ...policy,
      available: false,
      maxBatchSize: 0,
    });
    creator.setCharacteristicGenerationMethod("rolled");
    const gate = deferred();
    catalog.beforeGet = async () => gate.promise;
    const pending = creator.chooseRace("altmer");
    expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual(
      policy,
    );
    gate.reject(new Error("offline"));
    await pending;
    creator.cancelRaceSelection();
    catalog.beforeGet = undefined;
    await creator.chooseRace("altmer");
    expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual(
      policy,
    );
    creator.submitLuckRoll({ id: "new-luck", dice: [1, 2] });
    expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual(
      policy,
    );
    const fresh = new CharacterCreator(catalog);
    expect(fresh.getSnapshot().characteristicGeneration.rerolls).toEqual({
      unlimited: false,
      initialized: false,
      batchSpent: false,
      available: false,
      maxBatchSize: 0,
    });
    creator.dispose();
    for (const command of [
      () => creator.setUnlimitedCharacteristicRerolls(false),
      () => creator.rerollCharacteristics(batch()),
      () => creator.submitCharacteristicRolls(pool()),
    ]) {
      expectUnchanged(creator, command, "disposed");
    }
    expect(creator.getSnapshot().characteristicGeneration.rerolls).toEqual(
      fresh.getSnapshot().characteristicGeneration.rerolls,
    );
  });
});
