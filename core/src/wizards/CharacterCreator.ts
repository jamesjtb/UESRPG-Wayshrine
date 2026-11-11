import type {
  CharacterContentLoad,
  CharacterContentOperation,
  CharacterCreationSnapshot,
  CharacterCreationStep,
} from "../../interface/character/CharacterCreation";
import type {
  CharacteristicAllocations,
  CharacteristicAssignments,
  CharacteristicGenerationAnswer,
  CharacteristicGenerationCommandResult,
  CharacteristicGenerationDrafts,
  CharacteristicGenerationField,
  CharacteristicGenerationMethod,
  CharacteristicGenerationIssue,
  CharacteristicGenerationSnapshot,
  CharacteristicRerollReplacement,
  CharacteristicRerollSnapshot,
  CharacteristicRoll,
} from "../../interface/character/CharacteristicGeneration";
import type { Race } from "../../interface/character/Race";
import type {
  BirthsignRoll,
  BirthsignSelection,
  BirthsignSelectionSnapshot,
  BirthsignSelectionIssue,
} from "../../interface/character/BirthsignSelection";
import { BirthsignSelectionSession } from "../character/birthsignSelection";
import { calculateBirthsignPackage } from "../character/birthsignPackage";
import { calculateCharacteristicScore } from "../character/characteristicScore";
import type Skill from "../../interface/character/Skill";
import type { Trait } from "../../interface/character/Trait";
import type { ChoiceAnswer, ChoiceState } from "../../interface/common/Choice";
import type {
  ContentCatalog,
  ContentSummary,
} from "../../interface/common/ContentCatalog";
import type {
  StepEvaluation,
  WizardIssue,
  WizardResult,
} from "../../interface/common/Wizard";
import { ContentError } from "../content/ContentError";
import {
  projectCharacteristicGeneration,
  validateCharacteristicGeneration,
  validateRoll,
} from "../character/characteristicGeneration";
import { ContentReader } from "../content/ContentReader";
import { raceSchema, skillSchema } from "../content/schemas";
import { validateRaceContent } from "../content/validateRaceContent";
import PcCharacterData from "../data/CharacterData";
import { Characteristic, PcCharacteristic } from "../enum/Characteristic";
import { SkillRank } from "../enum/SkillRank";
import Wizard from "./Wizard";
import { validateChoice } from "./validateChoice";

function choiceId(raceKey: string, groupId: string): string {
  return `${encodeURIComponent(raceKey)}/${encodeURIComponent(groupId)}`;
}

function rejected(code: string, message: string): WizardResult {
  return { ok: false, issues: [{ code, message }] };
}

function emptyGenerationDrafts(): CharacteristicGenerationDrafts {
  return {
    method: undefined,
    favored: [],
    luck: undefined,
    rolled: { rolls: [], assignments: {} },
    pointBuy: { allocations: {} },
  };
}

function copyRoll(roll: CharacteristicRoll): CharacteristicRoll {
  return { ...roll, dice: [...roll.dice] };
}

function copyGenerationDrafts(
  drafts: CharacteristicGenerationDrafts,
): CharacteristicGenerationDrafts {
  return {
    method: drafts.method,
    favored: [...drafts.favored],
    luck: drafts.luck === undefined ? undefined : copyRoll(drafts.luck),
    rolled: {
      rolls: drafts.rolled.rolls.map(copyRoll),
      assignments: { ...drafts.rolled.assignments },
    },
    pointBuy: { allocations: { ...drafts.pointBuy.allocations } },
  };
}

/** Shared character rules. Loading commands prepare data; evaluation never does I/O. */
export default class CharacterCreator {
  private readonly content: ContentReader;
  private readonly birthsigns: BirthsignSelectionSession;
  private name = "";
  private generation = emptyGenerationDrafts();
  private characteristicPoolInitialized = false;
  private characteristicRerollBatchSpent = false;
  private unlimitedCharacteristicRerolls = false;
  private raceKey: string | undefined;
  private race: Race | undefined;
  private skillOptions: readonly ContentSummary[] = [];
  private referenceIssues: readonly WizardIssue[] = [];
  private readonly answers = new Map<string, ChoiceAnswer<string>>();
  private readonly bonusSkills = new Map<string, readonly Skill[]>();
  private readonly loads = new Map<string, CharacterContentLoad>();
  private disposed = false;
  private readonly wizard: Wizard<
    CharacterCreationStep,
    ChoiceState<string>,
    PcCharacterData
  >;

  constructor(catalog: ContentCatalog) {
    this.content = new ContentReader(catalog);
    this.birthsigns = new BirthsignSelectionSession(this.content, (snapshot) =>
      this.birthsignContextIssues(snapshot),
    );
    this.wizard = new Wizard(
      [
        { id: "race", evaluate: () => this.evaluateRace() },
        {
          id: "characteristics",
          evaluate: () => this.evaluateCharacteristics(),
        },
        { id: "birthsign", evaluate: () => this.evaluateBirthsign() },
      ],
      () => this.getCharacterPreview(),
    );
  }

  setName(name: string): WizardResult {
    if (this.disposed) return this.disposedResult();
    this.name = name;
    return { ok: true, value: undefined };
  }

  submitBirthsignRoll(roll: BirthsignRoll) {
    return this.birthsigns.submitRoll(roll);
  }

  chooseBirthsign(selection: BirthsignSelection) {
    return this.birthsigns.choose(selection);
  }

  chooseBirthsignBonus(id: string, selections: readonly string[]) {
    return this.birthsigns.chooseBonus(id, selections);
  }

  restoreOriginalBirthsign() {
    return this.birthsigns.restoreOriginal();
  }

  setFreeBirthsignChoice(enabled: boolean) {
    return this.birthsigns.setFreeChoice(enabled);
  }

  cancelBirthsignSelection(): void {
    this.birthsigns.cancel();
  }

  setFavoredCharacteristics(
    selections: readonly Characteristic[],
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    this.generation.favored = [...selections];
    return this.generationSubmissionResult("favored");
  }

  setCharacteristicGenerationMethod(
    method: CharacteristicGenerationMethod,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    this.generation.method = method;
    return this.generationSubmissionResult("method");
  }

  /** Invalid initial drafts remain editable until a valid seven-result pool is accepted. */
  submitCharacteristicRolls(
    rolls: readonly CharacteristicRoll[],
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    if (this.characteristicPoolInitialized)
      return this.rerollRejection(
        "pool-initialized",
        "The initial pool is accepted. Use selective rerolls to replace results.",
      );
    this.generation.rolled.rolls = rolls.map(copyRoll);
    this.generation.rolled.assignments = {};
    const result = this.generationSubmissionResult("rolls", "rolled");
    if (result.ok) this.characteristicPoolInitialized = true;
    return result;
  }

  setUnlimitedCharacteristicRerolls(
    enabled: boolean,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    this.unlimitedCharacteristicRerolls = enabled;
    return { ok: true, value: undefined };
  }

  /** Validate the entire batch before replacing results or spending the allowance. */
  rerollCharacteristics(
    replacements: readonly CharacteristicRerollReplacement[],
    luckReplacement?: CharacteristicRoll,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    if (luckReplacement) {
      const issues = this.luckReplacementIssues(luckReplacement);
      if (issues.length > 0) return { ok: false, issues };
    }
    if (replacements.length === 0 && luckReplacement) {
      this.generation.luck = copyRoll(luckReplacement);
      return { ok: true, value: undefined };
    }
    if (this.generation.method !== "rolled")
      return this.rerollRejection(
        "generation-method",
        "Select rolled generation before rerolling characteristics.",
      );
    if (!this.characteristicPoolInitialized)
      return this.rerollRejection(
        "pool-uninitialized",
        "Submit a valid initial pool before rerolling characteristics.",
      );
    const policy = this.characteristicRerollSnapshot();
    if (!policy.available)
      return this.rerollRejection(
        "reroll-unavailable",
        "The normal characteristic reroll batch has already been spent.",
      );
    if (replacements.length < 1 || replacements.length > policy.maxBatchSize)
      return this.rerollRejection(
        "reroll-count",
        `Submit one to ${policy.maxBatchSize} replacements in a single batch.`,
      );

    const issues = this.characteristicReplacementIssues(replacements);
    if (issues.length > 0) return { ok: false, issues };

    const byTarget = new Map(
      replacements.map(({ targetRollId, replacement }) => [
        targetRollId,
        replacement,
      ]),
    );
    const rolls = this.generation.rolled.rolls.map((roll) =>
      copyRoll(byTarget.get(roll.id) ?? roll),
    );
    const assignments = { ...this.generation.rolled.assignments };
    for (const key of Object.keys(assignments) as Characteristic[]) {
      if (byTarget.has(assignments[key]!)) delete assignments[key];
    }
    this.generation.rolled = { rolls, assignments };
    if (luckReplacement) this.generation.luck = copyRoll(luckReplacement);
    this.characteristicRerollBatchSpent = true;
    return { ok: true, value: undefined };
  }

  private luckReplacementIssues(
    roll: CharacteristicRoll,
  ): CharacteristicGenerationIssue[] {
    if (!this.unlimitedCharacteristicRerolls) {
      return [
        {
          code: "reroll-unavailable",
          field: "luck",
          message: "Enable Unlimited Rerolls to reroll Luck.",
        },
      ];
    }
    if (!this.generation.luck) {
      return [
        {
          code: "reroll-target",
          field: "luck",
          message: "Roll Luck before selecting it for reroll.",
        },
      ];
    }
    return validateRoll(roll, "luck");
  }

  private characteristicReplacementIssues(
    replacements: readonly CharacteristicRerollReplacement[],
  ): CharacteristicGenerationIssue[] {
    const issues: CharacteristicGenerationIssue[] = [];
    const poolIds = new Set(
      this.generation.rolled.rolls.map((roll) => roll.id),
    );
    const targets = new Set<string>();
    const replacementIds = new Set<string>();
    for (const { targetRollId, replacement } of replacements) {
      if (!poolIds.has(targetRollId) || targets.has(targetRollId)) {
        issues.push({
          code: "reroll-target",
          field: "rolls",
          rollId: targetRollId,
          message:
            "Reroll targets must be distinct IDs from the current shared pool.",
        });
      }
      targets.add(targetRollId);
      issues.push(...validateRoll(replacement, "rolls"));
      if (poolIds.has(replacement.id) || replacementIds.has(replacement.id)) {
        issues.push({
          code: "roll-identity",
          field: "rolls",
          rollId: replacement.id,
          message:
            "Replacement IDs must be distinct and not reuse any current pool ID.",
        });
      }
      replacementIds.add(replacement.id);
    }
    return issues;
  }

  private rerollRejection(
    code: CharacteristicGenerationIssue["code"],
    message: string,
  ): CharacteristicGenerationCommandResult {
    return {
      ok: false,
      issues: [
        {
          code,
          field: code === "generation-method" ? "method" : "rolls",
          message,
        },
      ],
    };
  }

  private characteristicRerollSnapshot(): CharacteristicRerollSnapshot {
    const available =
      !this.disposed &&
      this.generation.method === "rolled" &&
      this.characteristicPoolInitialized &&
      (!this.characteristicRerollBatchSpent ||
        this.unlimitedCharacteristicRerolls);
    let maxBatchSize = 0;
    if (available) maxBatchSize = this.unlimitedCharacteristicRerolls ? 7 : 3;
    return {
      unlimited: this.unlimitedCharacteristicRerolls,
      batchSpent: this.characteristicRerollBatchSpent,
      initialized: this.characteristicPoolInitialized,
      available,
      maxBatchSize,
    };
  }

  /** Replace the entire rolled draft map; an empty map clears it. */
  setCharacteristicAssignments(
    assignments: CharacteristicAssignments,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    this.generation.rolled.assignments = { ...assignments };
    return this.generationSubmissionResult("assignments", "rolled");
  }

  /** Replace the entire point-buy draft map without changing the active method. */
  setCharacteristicAllocations(
    allocations: CharacteristicAllocations,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    this.generation.pointBuy.allocations = { ...allocations };
    return this.generationSubmissionResult("allocations", "point-buy");
  }

  submitLuckRoll(
    roll: CharacteristicRoll,
  ): CharacteristicGenerationCommandResult {
    if (this.disposed) return this.generationDisposedResult();
    if (
      this.generation.luck &&
      validateRoll(this.generation.luck, "luck").length === 0 &&
      !this.unlimitedCharacteristicRerolls
    ) {
      return {
        ok: false,
        issues: [
          {
            code: "reroll-unavailable",
            field: "luck",
            message: "Enable Unlimited Rerolls to reroll Luck.",
          },
        ],
      };
    }
    this.generation.luck = copyRoll(roll);
    return this.generationSubmissionResult("luck");
  }

  async chooseRace(raceKey: string): Promise<WizardResult> {
    if (this.disposed) return this.disposedResult();
    if (this.raceKey === raceKey) {
      this.cancelRaceSelection();
      return { ok: true, value: undefined };
    }

    // A new race intent supersedes all outstanding selections, not stored answers.
    this.loads.clear();
    const request = this.beginLoad("race", { kind: "race", raceKey });
    try {
      const race = await this.content.get("race", raceKey);
      if (!this.isCurrent("race", request)) return this.supersededResult();
      if (!race) {
        this.loads.delete("race");
        return rejected("unknown-race", "Unknown race.");
      }

      const resolved = await this.resolveRaceContent(race, request);
      if (!resolved || !this.isCurrent("race", request))
        return this.supersededResult();
      this.raceKey = raceKey;
      this.race = race;
      this.skillOptions = resolved.options;
      this.referenceIssues = resolved.issues.map((issue) => ({
        ...issue,
        ...(issue.choiceId === undefined
          ? {}
          : { choiceId: choiceId(raceKey, issue.choiceId) }),
      }));
      this.answers.clear();
      this.bonusSkills.clear();
      this.loads.delete("race");
      return this.referenceIssues.length > 0
        ? {
            ok: false,
            issues: this.referenceIssues.map((issue) => ({ ...issue })),
          }
        : { ok: true, value: undefined };
    } catch (error) {
      return this.failLoad("race", request, error);
    }
  }

  /** Keep the last committed race and answers after canceling a pending/failed change. */
  cancelRaceSelection(): void {
    this.loads.delete("race");
  }

  /** Invalid answers stay editable but never grant effects. Retry by resubmitting. */
  async chooseRacialBonus(
    id: string,
    selections: readonly string[],
  ): Promise<WizardResult> {
    if (this.disposed) return this.disposedResult();
    if (this.loads.has("race")) {
      return rejected(
        "race-selection-pending",
        "Resolve or cancel the race change first.",
      );
    }
    const group = this.racialChoices().find((candidate) => candidate.id === id);
    if (!group)
      return rejected("unknown-choice", "Unknown racial bonus choice.");

    const loadKey = `bonus/${id}`;
    this.loads.delete(loadKey);
    this.bonusSkills.delete(id);
    const answer = { choiceId: id, selections: [...selections] };
    this.answers.set(id, answer);
    const issues = this.answerIssues(group);
    if (issues.length > 0) return { ok: false, issues };

    const request = this.beginLoad(loadKey, {
      kind: "racial-bonus",
      choiceId: id,
    });
    try {
      const skills: Skill[] = [];
      // Sequential loads bound working memory/concurrency even for large groups.
      for (const key of answer.selections) {
        const skill = await this.content.get("skill", key);
        if (!this.isCurrent(loadKey, request)) return this.supersededResult();
        if (!skill) {
          throw new ContentError(
            "invalid-content",
            `Selected skill is missing: ${key}.`,
          );
        }
        skills.push(skill);
      }
      this.bonusSkills.set(id, skills);
      this.loads.delete(loadKey);
      return { ok: true, value: undefined };
    } catch (error) {
      return this.failLoad(loadKey, request, error);
    }
  }

  getSnapshot(): CharacterCreationSnapshot {
    return {
      ...this.wizard.getSnapshot(),
      answers: {
        name: this.name,
        raceKey: this.raceKey,
        racialBonuses: [...this.answers.values()].map((answer) => ({
          ...answer,
          selections: [...answer.selections],
        })),
      },
      characteristicGeneration: this.generationSnapshot(),
      birthsignSelection: this.birthsigns.snapshot(),
      racialBonusChoices: this.racialChoices(),
      racialSkillOptions: this.skillOptions.map((option) => ({ ...option })),
      contentVersion: { ...this.content.version },
      contentLoads: [...this.loads.values()].map((load) => ({
        ...load,
        operation: { ...load.operation },
        issues: load.issues.map((issue) => ({ ...issue })),
      })),
    };
  }

  next() {
    return this.wizard.next();
  }

  previous() {
    return this.wizard.previous();
  }

  finish() {
    return this.wizard.finish();
  }

  /** Reconstruct effects from valid, resolved answers; never fetch or roll dice. */
  getCharacterPreview(): PcCharacterData {
    const character = new PcCharacterData();
    character.name = this.name;
    if (
      !this.race ||
      this.disposed ||
      this.loads.has("race") ||
      this.referenceIssues.some((issue) => issue.choiceId === undefined)
    )
      return character;

    character.race = raceSchema.parse(this.race);
    for (const key of Object.values(Characteristic)) {
      character.updateCharacteristic(key, {
        baseline: this.race.baselineCharacteristics[key],
      });
    }
    const contributions = projectCharacteristicGeneration(
      this.generationAnswer(),
    );
    for (const key of Object.values(PcCharacteristic)) {
      character.updateCharacteristic(key, contributions[key]);
    }
    character.traits = character.race.racialTraits.map((trait) => ({
      ...trait,
      origin: "race",
    }));
    const granted = new Set<string>();
    for (const group of this.racialChoices()) {
      if (this.evaluateRacialChoice(group).length > 0) continue;
      for (const skill of this.bonusSkills.get(group.id) ?? []) {
        if (granted.has(skill.skillKey)) continue;
        character.skills.push({
          skill: skillSchema.parse(skill),
          skillRank: SkillRank.Novice,
        });
        granted.add(skill.skillKey);
      }
    }
    this.projectBirthsign(character);
    return character;
  }

  private projectBirthsign(character: PcCharacterData): void {
    const snapshot = this.birthsigns.snapshot();
    if (
      !snapshot.complete ||
      !snapshot.selected ||
      !snapshot.definition ||
      snapshot.purchaseCost === undefined
    )
      return;
    const result = calculateBirthsignPackage({
      selection: snapshot.selected,
      definition: snapshot.definition,
      answers: snapshot.answers,
    });
    if (!result.ok) return;
    const value = result.value;
    character.birthsign = { ...snapshot.selected };
    for (const key of Object.values(PcCharacteristic)) {
      character.characteristics[key].modifiers.push(
        ...(value.characteristicModifiers[key] ?? []),
      );
      const rolled = value.rolledReplacements[key];
      if (rolled !== undefined) character.characteristics[key].rolled = rolled;
    }
    if (snapshot.purchaseCost > 0) {
      character.characteristics.lck.purchaseCost = {
        sourceId: `birthsign/${encodeURIComponent(snapshot.selected.signKey)}/purchase`,
        sourceText: "Birthsign purchase",
        value: snapshot.purchaseCost,
      };
    }
    character.traits.push(...value.traits);
    character.powers = value.powers;
    character.birthsignAdjustments = {
      spMaximum: value.spMaximum,
      speed: value.speed,
      naturalHealingMultiplier: value.naturalHealingMultiplier,
      extraLuckyNumbers: value.extraLuckyNumbers,
    };
  }

  private birthsignContextIssues(
    snapshot: BirthsignSelectionSnapshot,
  ): BirthsignSelectionIssue[] {
    if (
      !snapshot.selected ||
      !snapshot.definition ||
      snapshot.purchaseCost === undefined
    )
      return [];
    // Free and original selections are not purchases; inherent effects still apply.
    if (snapshot.purchaseCost === 0) return [];
    const result = calculateBirthsignPackage({
      selection: snapshot.selected,
      definition: snapshot.definition,
      answers: snapshot.answers,
    });
    if (!result.ok) return [];
    if (
      !this.usableRace() ||
      !this.generation.luck ||
      validateRoll(this.generation.luck, "luck").length
    ) {
      return [
        {
          code: "affordability-pending",
          message:
            "Resolve race and Luck generation to check the birthsign purchase.",
        },
      ];
    }
    const luck = projectCharacteristicGeneration(this.generationAnswer()).lck;
    const rolled = result.value.rolledReplacements.lck ?? luck.rolled;
    const score = calculateCharacteristicScore({
      baseline: 30,
      rolled,
      modifiers: result.value.characteristicModifiers.lck ?? [],
      purchaseCost: {
        sourceId: "birthsign/purchase",
        sourceText: "Birthsign purchase",
        value: snapshot.purchaseCost,
      },
    });
    if (score.total < 0)
      return [
        {
          code: "unaffordable-selection",
          message: "A birthsign purchase cannot leave final Luck below zero.",
        },
      ];
    return [];
  }

  private usableRace(): boolean {
    return (
      !!this.race &&
      !this.disposed &&
      !this.loads.has("race") &&
      !this.referenceIssues.some((issue) => issue.choiceId === undefined)
    );
  }

  private evaluateBirthsign(): StepEvaluation<ChoiceState<string>> {
    const snapshot = this.birthsigns.snapshot();
    const pendingChoices: ChoiceState<string>[] = [];
    for (const choice of snapshot.choices) {
      if (choice.lifecycle.selection !== "once") continue;
      if (
        !snapshot.issues.some(
          (issue) => issue.choiceId === choice.choiceGroup.id,
        )
      )
        continue;
      pendingChoices.push({
        ...choice.choiceGroup,
        options: choice.choiceGroup.options.map((option) => option.id),
        selections: [...choice.selections],
      });
    }
    const issues: WizardIssue[] = [...snapshot.issues];
    if (
      this.evaluateRace().issues.length ||
      this.evaluateCharacteristics().issues.length
    ) {
      issues.push({
        code: "previous-steps-incomplete",
        message:
          "Complete race and characteristic generation before finishing birthsign selection.",
      });
    }
    return { pendingChoices, issues };
  }

  /** Invalidates outstanding commands and releases session-owned definitions/answers. */
  dispose(): void {
    this.birthsigns.dispose();
    this.disposed = true;
    this.name = "";
    this.generation = emptyGenerationDrafts();
    this.characteristicPoolInitialized = false;
    this.characteristicRerollBatchSpent = false;
    this.unlimitedCharacteristicRerolls = false;
    this.loads.clear();
    this.answers.clear();
    this.bonusSkills.clear();
    this.race = undefined;
    this.raceKey = undefined;
    this.skillOptions = [];
    this.referenceIssues = [];
  }

  private generationAnswer(
    method = this.generation.method,
    drafts = this.generation,
  ): CharacteristicGenerationAnswer {
    const common = {
      favored: drafts.favored,
      ...(drafts.luck === undefined ? {} : { luck: drafts.luck }),
    };
    switch (method) {
      case "rolled":
        return { ...common, method, ...drafts.rolled };
      case "point-buy":
        return { ...common, method, ...drafts.pointBuy };
      default:
        return { ...common, method };
    }
  }

  private generationSnapshot(): CharacteristicGenerationSnapshot {
    const answer = this.generationAnswer(
      this.generation.method,
      copyGenerationDrafts(this.generation),
    );
    const issues = validateCharacteristicGeneration(answer);
    return {
      drafts: copyGenerationDrafts(this.generation),
      rerolls: this.characteristicRerollSnapshot(),
      answer,
      issues,
      complete: issues.length === 0,
    };
  }

  private generationSubmissionResult(
    field: CharacteristicGenerationField,
    method = this.generation.method,
  ): CharacteristicGenerationCommandResult {
    const issues = validateCharacteristicGeneration(
      this.generationAnswer(method),
    ).filter((issue) => issue.field === field);
    return issues.length > 0
      ? { ok: false, issues }
      : { ok: true, value: undefined };
  }

  private generationDisposedResult(): CharacteristicGenerationCommandResult {
    return {
      ok: false,
      issues: [{ code: "disposed", message: "This creator is closed." }],
    };
  }

  private async resolveRaceContent(race: Race, request: CharacterContentLoad) {
    const offeredKeys = new Set(
      (race.racialBonuses ?? []).flatMap((bonus) =>
        bonus.choiceGroups.flatMap((group) => group.options),
      ),
    );
    const index = offeredKeys.size > 0 ? await this.content.list("skill") : [];
    if (!this.isCurrent("race", request)) return undefined;
    const traits = new Map<string, Trait>();
    for (const key of new Set(
      race.racialTraits.map((trait) => trait.traitKey),
    )) {
      const trait = await this.content.get("trait", key);
      if (!this.isCurrent("race", request)) return undefined;
      if (trait) traits.set(key, trait);
    }
    return {
      options: index.filter((entry) => offeredKeys.has(entry.key)),
      issues: validateRaceContent(
        race,
        new Set(index.map((entry) => entry.key)),
        traits,
      ),
    };
  }

  private racialChoices(): ChoiceState<string>[] {
    if (!this.race || this.raceKey === undefined) return [];
    const raceKey = this.raceKey;
    return (this.race.racialBonuses ?? []).flatMap((bonus) =>
      bonus.choiceGroups.map((group) => {
        const id = choiceId(raceKey, group.id);
        return {
          ...group,
          id,
          options: [...group.options],
          selections: [...(this.answers.get(id)?.selections ?? [])],
        };
      }),
    );
  }

  private answerIssues(group: ChoiceState<string>): WizardIssue[] {
    return [
      ...validateChoice(group, this.answers.get(group.id)),
      ...this.referenceIssues
        .filter((issue) => issue.choiceId === group.id)
        .map((issue) => ({ ...issue })),
    ];
  }

  private evaluateRacialChoice(group: ChoiceState<string>): WizardIssue[] {
    const issues = this.answerIssues(group);
    const load = this.loads.get(`bonus/${group.id}`);
    if (load) issues.push(...this.loadIssues(load));
    else if (
      group.choose > 0 &&
      issues.length === 0 &&
      !this.bonusSkills.has(group.id)
    ) {
      issues.push({
        code: "content-unresolved",
        choiceId: group.id,
        message: "Resubmit this selection to resolve its skill definitions.",
      });
    }
    return issues;
  }

  private evaluateCharacteristics(): StepEvaluation<ChoiceState<string>> {
    return {
      pendingChoices: [],
      issues: this.disposed
        ? [{ code: "disposed", message: "This creator is closed." }]
        : validateCharacteristicGeneration(this.generationAnswer()),
    };
  }

  private evaluateRace(): StepEvaluation<ChoiceState<string>> {
    const pendingChoices: ChoiceState<string>[] = [];
    const issues: WizardIssue[] = [];
    if (this.disposed)
      return {
        pendingChoices,
        issues: [{ code: "disposed", message: "This creator is closed." }],
      };
    const raceLoad = this.loads.get("race");
    if (raceLoad) issues.push(...this.loadIssues(raceLoad));
    if (!this.race)
      issues.push({ code: "race-required", message: "Choose a race." });
    issues.push(
      ...this.referenceIssues
        .filter((issue) => issue.choiceId === undefined)
        .map((issue) => ({ ...issue })),
    );
    for (const group of this.racialChoices()) {
      const errors = this.evaluateRacialChoice(group);
      if (errors.length > 0) {
        pendingChoices.push(group);
        issues.push(...errors);
      }
    }
    return { pendingChoices, issues };
  }

  private beginLoad(
    key: string,
    operation: CharacterContentOperation,
  ): CharacterContentLoad {
    const request: CharacterContentLoad = {
      operation,
      status: "loading",
      issues: [],
    };
    this.loads.set(key, request);
    return request;
  }

  private isCurrent(key: string, request: CharacterContentLoad): boolean {
    return this.loads.get(key) === request;
  }

  private failLoad(
    key: string,
    request: CharacterContentLoad,
    error: unknown,
  ): WizardResult {
    if (!this.isCurrent(key, request)) return this.supersededResult();
    const failure =
      error instanceof ContentError
        ? error
        : new ContentError(
            "content-unavailable",
            "Unable to load content. Retry the selection.",
          );
    request.status = "failed";
    request.issues = [
      {
        code: failure.code,
        message: failure.message,
        ...(request.operation.kind === "racial-bonus"
          ? { choiceId: request.operation.choiceId }
          : {}),
      },
    ];
    return { ok: false, issues: request.issues.map((issue) => ({ ...issue })) };
  }

  private loadIssues(load: CharacterContentLoad): WizardIssue[] {
    if (load.status === "failed")
      return load.issues.map((issue) => ({ ...issue }));
    return [
      {
        code: "content-loading",
        message: "Content is still loading.",
        ...(load.operation.kind === "racial-bonus"
          ? { choiceId: load.operation.choiceId }
          : {}),
      },
    ];
  }

  private supersededResult(): WizardResult {
    return rejected("superseded", "A newer selection replaced this request.");
  }

  private disposedResult(): WizardResult {
    return rejected("disposed", "This creator is closed.");
  }
}
