import type {
  CharacterContentLoad,
  CharacterContentOperation,
  CharacterCreationSnapshot,
} from "../../interface/character/CharacterCreation";
import type { Race } from "../../interface/character/Race";
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
import { ContentReader } from "../content/ContentReader";
import { raceSchema, skillSchema } from "../content/schemas";
import { validateRaceContent } from "../content/validateRaceContent";
import PcCharacterData from "../data/CharacterData";
import { Characteristic } from "../enum/Characteristic";
import { SkillRank } from "../enum/SkillRank";
import Wizard from "./Wizard";
import { validateChoice } from "./validateChoice";

function choiceId(raceKey: string, groupId: string): string {
  return `${encodeURIComponent(raceKey)}/${encodeURIComponent(groupId)}`;
}

function rejected(code: string, message: string): WizardResult {
  return { ok: false, issues: [{ code, message }] };
}

/** Shared character rules. Loading commands prepare data; evaluation never does I/O. */
export default class CharacterCreator {
  private readonly content: ContentReader;
  private raceKey: string | undefined;
  private race: Race | undefined;
  private skillOptions: readonly ContentSummary[] = [];
  private referenceIssues: readonly WizardIssue[] = [];
  private readonly answers = new Map<string, ChoiceAnswer<string>>();
  private readonly bonusSkills = new Map<string, readonly Skill[]>();
  private readonly loads = new Map<string, CharacterContentLoad>();
  private disposed = false;
  private readonly wizard: Wizard<"race", ChoiceState<string>, PcCharacterData>;

  constructor(catalog: ContentCatalog) {
    this.content = new ContentReader(catalog);
    this.wizard = new Wizard(
      [{ id: "race", evaluate: () => this.evaluateRace() }],
      () => this.getCharacterPreview(),
    );
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
        raceKey: this.raceKey,
        racialBonuses: [...this.answers.values()].map((answer) => ({
          ...answer,
          selections: [...answer.selections],
        })),
      },
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
    return character;
  }

  /** Invalidates outstanding commands and releases session-owned definitions/answers. */
  dispose(): void {
    this.disposed = true;
    this.loads.clear();
    this.answers.clear();
    this.bonusSkills.clear();
    this.race = undefined;
    this.raceKey = undefined;
    this.skillOptions = [];
    this.referenceIssues = [];
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
