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
import { BIRTHSIGN_CHARGE_TABLES } from "../content/birthsignChargeTables";
import { ContentError } from "../content/ContentError";
import { ContentReader } from "../content/ContentReader";
import { birthsignSchema } from "../content/schemas";
import { validateBirthsignContent } from "../content/validateBirthsignContent";

function reject(
  code: BirthsignSelectionIssue["code"],
  message: string,
): BirthsignSelectionResult {
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

/** Feature-owned session state. No randomness, effects, navigation, or catalog cache. */
export class BirthsignSelectionSession {
  private original: BirthsignOriginalResult | undefined;
  private selected: BirthsignSelection | undefined;
  private definition: Birthsign | undefined;
  private freeChoice = false;
  private load: BirthsignSelectionSnapshot["load"];
  private request = 0;
  private disposed = false;

  constructor(private readonly content: ContentReader) {}

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
  }

  snapshot(): BirthsignSelectionSnapshot {
    const issues =
      this.selected && this.definition
        ? this.eligibility(this.selected, this.definition)
        : [];
    let provenance: BirthsignSelectionSnapshot["provenance"];
    let purchaseCost: BirthsignSelectionSnapshot["purchaseCost"];
    if (this.selected && issues.length === 0) {
      if (same(this.original?.selection, this.selected)) {
        provenance = "original";
        purchaseCost = 0;
      } else if (this.freeChoice) {
        provenance = "freeChoice";
        purchaseCost = 0;
      } else if (this.isUpgrade(this.selected)) {
        provenance = "upgrade";
        purchaseCost = 5;
      } else {
        provenance = "purchase";
        purchaseCost = this.selected.variant === "normal" ? 5 : 10;
      }
    }
    return {
      freeChoice: this.freeChoice,
      original: this.original && {
        roll: { ...this.original.roll, dice: [...this.original.roll.dice] },
        selection: { ...this.original.selection },
      },
      selected: this.selected && { ...this.selected },
      definition: this.definition && birthsignSchema.parse(this.definition),
      provenance,
      purchaseCost,
      eligibilityIssues: issues,
      load: this.load && {
        ...this.load,
        selection: { ...this.load.selection },
        issues: this.load.issues.map((issue) => ({ ...issue })),
      },
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
    const issues =
      this.selected && this.definition
        ? this.eligibility(this.selected, this.definition)
        : [];
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
