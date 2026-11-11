import type {
  Birthsign,
  BirthsignBonus,
} from "../../interface/character/Birthsign";
import type {
  BirthsignOriginalResult,
  BirthsignRoll,
  BirthsignSelection,
  BirthsignSelectionIssue,
  BirthsignSelectionResult,
  BirthsignSelectionSnapshot,
} from "../../interface/character/BirthsignSelection";
import type { Trait } from "../../interface/character/Trait";
import type {
  BirthsignQuote,
  BirthsignQuoteResult,
} from "../../interface/character/BirthsignQuote";
import { BIRTHSIGN_CHARGE_TABLES } from "../content/birthsignChargeTables";
import { ContentError } from "../content/ContentError";
import { ContentReader } from "../content/ContentReader";
import { birthsignSchema } from "../content/schemas";
import { validateBirthsignContent } from "../content/validateBirthsignContent";
import type { ChoiceAnswer } from "../../interface/common/Choice";
import {
  getBirthsignChoices,
  validateBirthsignChoices,
} from "./birthsignPackage";

function reject(
  code: BirthsignSelectionIssue["code"],
  message: string,
): Extract<BirthsignSelectionResult, { ok: false }> {
  return { ok: false, issues: [{ code, message }] };
}

function same(a: BirthsignSelection | undefined, b: BirthsignSelection) {
  return a?.signKey === b.signKey && a.variant === b.variant;
}

function validSequence(dice: readonly number[]): boolean {
  if (!Array.isArray(dice) || dice.length === 0) return false;
  for (let index = 0; index < dice.length; index++) {
    const face = dice[index];
    if (!Number.isInteger(face)) return false;
    if (index === dice.length - 1) return face! >= 1 && face! <= 4;
    if (face !== 5) return false;
  }
  return false;
}

function collectReferences(
  bonus: BirthsignBonus,
  traitKeys: Set<string>,
  powerKeys: Set<string>,
): void {
  if (bonus.bonusType === "choice") {
    for (const option of bonus.choiceGroup.options)
      collectEffectReferences(option.effects, traitKeys, powerKeys);
    return;
  }
  if (bonus.bonusType === "trait") traitKeys.add(bonus.bonusTargetKey);
  if (bonus.bonusType === "power") powerKeys.add(bonus.bonusTargetKey);
}

function collectEffectReferences(
  bonuses: readonly BirthsignBonus[],
  traitKeys: Set<string>,
  powerKeys: Set<string>,
): void {
  for (const bonus of bonuses) collectReferences(bonus, traitKeys, powerKeys);
}

/** Feature-owned state; contextual affordability is supplied by the creator. */
export class BirthsignSelectionSession {
  private original: BirthsignOriginalResult | undefined;
  private selected: BirthsignSelection | undefined;
  private definition: Birthsign | undefined;
  private freeChoice = false;
  private load: BirthsignSelectionSnapshot["load"];
  private request = 0;
  private disposed = false;
  private readonly answers = new Map<string, ChoiceAnswer<string>>();

  constructor(
    private readonly content: ContentReader,
    private readonly contextIssues: (
      snapshot: BirthsignSelectionSnapshot,
    ) => readonly BirthsignSelectionIssue[],
  ) {}

  chooseBonus(
    id: string,
    selections: readonly string[],
  ): BirthsignSelectionResult {
    if (this.disposed) return reject("disposed", "This creator is disposed.");
    const snapshot = this.snapshot();
    if (this.load)
      return reject(
        "birthsign-pending",
        "Resolve or cancel the birthsign change first.",
      );
    const choice = snapshot.choices.find(
      (choice) =>
        choice.choiceGroup.id === id && choice.lifecycle.selection === "once",
    );
    if (!choice)
      return reject("unknown-choice", "Unknown one-time birthsign choice.");
    this.answers.set(id, { choiceId: id, selections: [...selections] });
    const issues = this.snapshot().issues;
    return issues.length
      ? { ok: false, issues }
      : { ok: true, value: undefined };
  }

  async submitRoll(input: BirthsignRoll): Promise<BirthsignSelectionResult> {
    if (this.disposed) return reject("disposed", "This creator is disposed.");
    if (this.original)
      return reject("roll-locked", "The original roll is already accepted.");
    const table = BIRTHSIGN_CHARGE_TABLES.find(
      (entry) => entry.guardian === input.charge,
    );
    const dice = input.dice;
    if (
      !table ||
      typeof input.id !== "string" ||
      input.id.trim() === "" ||
      !validSequence(dice)
    )
      return reject(
        "invalid-roll",
        "Submit an identified charge roll with only fives before a final face 1–4.",
      );

    const final = dice[dice.length - 1]!;
    const selection: BirthsignSelection = {
      signKey: table.entries[final - 1]!,
      variant: dice.length > 1 ? "starCursed" : "normal",
    };
    // Lock before I/O: retries restore this result, never acquire another sequence.
    this.original = {
      roll: { id: input.id, charge: input.charge, dice: [...dice] },
      selection,
    };
    return this.choose(this.selected ?? selection);
  }

  setFreeChoice(enabled: boolean): BirthsignSelectionResult {
    if (this.disposed) return reject("disposed", "This creator is disposed.");
    this.freeChoice = enabled;
    // Pending commands evaluate against the current mode at commit, not their captured mode.
    return this.selectionResult();
  }

  restoreOriginal(): Promise<BirthsignSelectionResult> {
    if (this.disposed)
      return Promise.resolve(reject("disposed", "This creator is disposed."));
    if (!this.original)
      return Promise.resolve(
        reject("original-required", "No original roll has been accepted."),
      );
    return this.choose(this.original.selection);
  }

  async choose(input: BirthsignSelection): Promise<BirthsignSelectionResult> {
    if (this.disposed) return reject("disposed", "This creator is disposed.");
    const selection = { ...input };
    const request = ++this.request;
    this.load = undefined;
    if (
      typeof selection.signKey !== "string" ||
      selection.signKey.trim() === "" ||
      !["normal", "starCursed"].includes(selection.variant)
    )
      return reject("invalid-selection", "Choose a sign and a valid variant.");
    if (same(this.selected, selection)) return this.selectionResult();
    this.load = { selection, status: "loading", issues: [] };
    try {
      const definition = await this.content.get("birthsign", selection.signKey);
      if (!this.isCurrent(request)) return this.superseded();
      if (!definition) {
        this.load = undefined;
        return reject("unknown-birthsign", "Unknown birthsign.");
      }
      await this.validateReferences(definition);
      if (!this.isCurrent(request)) return this.superseded();
      const issues = this.eligibility(selection, definition);
      this.load = undefined;
      if (issues.length) return { ok: false, issues };
      const candidate = this.snapshotFor(selection, definition);
      const affordability = this.contextIssues(candidate).filter(
        (issue) => issue.code === "unaffordable-selection",
      );
      if (affordability.length) return { ok: false, issues: affordability };
      this.selected = selection;
      this.definition = definition;
      return { ok: true, value: undefined };
    } catch (error) {
      if (!this.isCurrent(request)) return this.superseded();
      const failure =
        error instanceof ContentError
          ? error
          : new ContentError(
              "content-unavailable",
              "Unable to load birthsign content.",
            );
      const result = reject(failure.code, failure.message);
      if (!result.ok)
        this.load = {
          selection,
          status: "failed",
          issues: result.issues.map((issue) => ({ ...issue })),
        };
      return result;
    }
  }

  /** Independent reads: quotes neither supersede commands nor each other. */
  async quote(
    input: BirthsignSelection,
    provisionalAnswers: readonly ChoiceAnswer<string>[],
    evaluate: (snapshot: BirthsignSelectionSnapshot) => BirthsignQuote,
  ): Promise<BirthsignQuoteResult> {
    if (this.disposed) return reject("disposed", "This creator is disposed.");
    const selection = { ...input };
    const answers = provisionalAnswers.map((answer) => ({
      ...answer,
      selections: [...answer.selections],
    }));
    if (
      typeof selection.signKey !== "string" ||
      selection.signKey.trim() === "" ||
      !["normal", "starCursed"].includes(selection.variant)
    )
      return reject("invalid-selection", "Choose a sign and a valid variant.");
    try {
      const definition = await this.content.get("birthsign", selection.signKey);
      if (this.disposed) return reject("disposed", "This creator is disposed.");
      if (!definition) return reject("unknown-birthsign", "Unknown birthsign.");
      await this.validateReferences(definition);
      if (this.disposed) return reject("disposed", "This creator is disposed.");
      // Pricing and contextual calculation observe one synchronous completion point.
      return {
        ok: true,
        value: evaluate(
          this.snapshotFor(selection, definition, answers, false),
        ),
      };
    } catch (error) {
      if (this.disposed) return reject("disposed", "This creator is disposed.");
      const failure =
        error instanceof ContentError
          ? error
          : new ContentError(
              "content-unavailable",
              "Unable to load birthsign content.",
            );
      return reject(failure.code, failure.message);
    }
  }

  cancel(): void {
    ++this.request;
    this.load = undefined;
  }

  dispose(): void {
    this.cancel();
    this.disposed = true;
    this.original = undefined;
    this.selected = undefined;
    this.definition = undefined;
    this.freeChoice = false;
    this.answers.clear();
  }

  snapshot(): BirthsignSelectionSnapshot {
    const snapshot = this.snapshotFor(this.selected, this.definition);
    const issues = [...snapshot.issues, ...this.contextIssues(snapshot)];
    return { ...snapshot, issues, complete: issues.length === 0 };
  }

  private snapshotFor(
    selected: BirthsignSelection | undefined,
    definition: Birthsign | undefined,
    suppliedAnswers: readonly ChoiceAnswer<string>[] = [
      ...this.answers.values(),
    ],
    includeLoad = true,
  ): BirthsignSelectionSnapshot {
    const issues =
      selected && definition ? this.eligibility(selected, definition) : [];
    let acquisitionMethod: BirthsignSelectionSnapshot["acquisitionMethod"];
    let purchaseCost: BirthsignSelectionSnapshot["purchaseCost"];
    if (selected && issues.length === 0) {
      if (same(this.original?.selection, selected)) {
        acquisitionMethod = "original";
        purchaseCost = 0;
      } else if (this.freeChoice) {
        acquisitionMethod = "freeChoice";
        purchaseCost = 0;
      } else if (this.isUpgrade(selected)) {
        acquisitionMethod = "upgrade";
        purchaseCost = 5;
      } else {
        acquisitionMethod = "purchase";
        purchaseCost = selected.variant === "normal" ? 5 : 10;
      }
    }
    const answers = suppliedAnswers.map((answer) => ({
      ...answer,
      selections: [...answer.selections],
    }));
    const input =
      selected && definition
        ? { selection: selected, definition, answers }
        : undefined;
    const validation: BirthsignSelectionIssue[] = [...issues];
    if (this.disposed)
      validation.push({
        code: "disposed",
        message: "This creator is disposed.",
      });
    if (!selected)
      validation.push({
        code: "birthsign-required",
        message: "Choose a birthsign.",
      });
    if (input) validation.push(...validateBirthsignChoices(input));
    if (includeLoad && this.load?.status === "loading")
      validation.push({
        code: "birthsign-pending",
        message: "Birthsign content is loading.",
      });
    if (includeLoad && this.load?.status === "failed")
      validation.push(...this.load.issues.map((issue) => ({ ...issue })));
    return {
      freeChoice: this.freeChoice,
      original: this.original && {
        roll: { ...this.original.roll, dice: [...this.original.roll.dice] },
        selection: { ...this.original.selection },
      },
      selected: selected && { ...selected },
      definition: definition && birthsignSchema.parse(definition),
      acquisitionMethod,
      purchaseCost,
      eligibilityIssues: issues,
      answers,
      choices: input ? getBirthsignChoices(input) : [],
      issues: validation,
      complete: validation.length === 0,
      load:
        includeLoad && this.load
          ? {
              ...this.load,
              selection: { ...this.load.selection },
              issues: this.load.issues.map((issue) => ({ ...issue })),
            }
          : undefined,
    };
  }

  private isUpgrade(selection: BirthsignSelection): boolean {
    return (
      this.original?.selection.signKey === selection.signKey &&
      this.original.selection.variant === "normal" &&
      selection.variant === "starCursed"
    );
  }

  private eligibility(
    selection: BirthsignSelection,
    definition: Birthsign,
  ): BirthsignSelectionIssue[] {
    if (
      this.freeChoice ||
      same(this.original?.selection, selection) ||
      this.isUpgrade(selection)
    )
      return [];
    if (selection.variant === "starCursed" && definition.starCursed.eligibility)
      return [
        {
          code: "ineligible-selection",
          message:
            "This Star-Cursed variant requires its naturally rolled sign (a normal original may be upgraded for 5 Luck).",
        },
      ];
    return [];
  }

  private selectionResult(): BirthsignSelectionResult {
    // Mode changes retain unresolved answers; report eligibility/affordability, not missing choices.
    const issues = this.snapshot().issues.filter(
      (issue) =>
        issue.code === "ineligible-selection" ||
        issue.code === "unaffordable-selection",
    );
    return issues.length
      ? { ok: false, issues }
      : { ok: true, value: undefined };
  }

  private isCurrent(request: number) {
    return !this.disposed && request === this.request;
  }
  private superseded() {
    return reject("superseded", "A newer command superseded this selection.");
  }

  private async validateReferences(definition: Birthsign): Promise<void> {
    const traitKeys = new Set<string>();
    const powerKeys = new Set<string>();
    collectEffectReferences(definition.bonuses, traitKeys, powerKeys);
    collectEffectReferences(
      definition.starCursed.bonuses,
      traitKeys,
      powerKeys,
    );
    const traits = new Map<string, Trait>();
    const powers = new Set<string>();
    await Promise.all([
      ...[...traitKeys].map(async (key) => {
        const trait = await this.content.get("trait", key);
        if (trait) traits.set(key, trait);
      }),
      ...[...powerKeys].map(async (key) => {
        const power = await this.content.get("power", key);
        if (power) powers.add(key);
      }),
    ]);
    const issues = validateBirthsignContent(definition, traits, powers);
    if (issues.length)
      throw new ContentError("invalid-content", issues.join(" "));
  }
}
