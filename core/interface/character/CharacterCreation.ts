import type { ChoiceAnswer, ChoiceState } from "../common/Choice";
import type { ContentSummary, ContentVersion } from "../common/ContentCatalog";
import type { WizardIssue, WizardSnapshot } from "../common/Wizard";

export type CharacterContentOperation =
  | { kind: "race"; raceKey: string }
  | { kind: "racial-bonus"; choiceId: string };

export interface CharacterContentLoad {
  operation: CharacterContentOperation;
  status: "loading" | "failed";
  issues: readonly WizardIssue[];
}

export interface CharacterCreationAnswers {
  raceKey: string | undefined;
  racialBonuses: readonly ChoiceAnswer<string>[];
}

export interface CharacterCreationSnapshot extends WizardSnapshot<
  "race",
  ChoiceState<string>
> {
  answers: CharacterCreationAnswers;
  /** Includes resolved groups so previous selections can be reviewed and edited. */
  racialBonusChoices: readonly ChoiceState<string>[];
  /** Only the current race's offered skills, not the complete skill index. */
  racialSkillOptions: readonly ContentSummary[];
  contentVersion: ContentVersion;
  contentLoads: readonly CharacterContentLoad[];
}
