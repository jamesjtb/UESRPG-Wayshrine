import type { Race } from "../../interface/character/Race";
import type { Trait } from "../../interface/character/Trait";
import type { WizardIssue } from "../../interface/common/Wizard";
import { validateChoiceDefinition } from "../wizards/validateChoice";

/** Pure reference checks; callers supply indexes/definitions from any content source. */
export function validateRaceContent(
  race: Race,
  skillKeys: ReadonlySet<string>,
  traits: ReadonlyMap<string, Trait>,
): WizardIssue[] {
  const issues: WizardIssue[] = [];
  const groups = (race.racialBonuses ?? []).flatMap(
    (bonus) => bonus.choiceGroups,
  );
  for (const group of groups) {
    issues.push(...validateChoiceDefinition(group));
    if (groups.filter((candidate) => candidate.id === group.id).length !== 1) {
      issues.push({
        code: "invalid-choice-definition",
        choiceId: group.id,
        message: "Choice IDs must be unique within a race.",
      });
    }
    if (group.options.some((key) => !skillKeys.has(key))) {
      issues.push({
        code: "invalid-choice-definition",
        choiceId: group.id,
        message: "A racial option references an unknown skill.",
      });
    }
  }

  for (const applied of race.racialTraits) {
    const trait = traits.get(applied.traitKey);
    if (!trait) {
      issues.push({
        code: "invalid-race-definition",
        message: `Unknown racial trait: ${applied.traitKey}.`,
      });
      continue;
    }
    const required = trait.params ?? [];
    const supplied = Object.keys(applied.params ?? {});
    if (
      required.some((name) => !supplied.includes(name)) ||
      supplied.some((name) => !required.includes(name))
    ) {
      issues.push({
        code: "invalid-race-definition",
        message: `Incorrect parameters for racial trait: ${applied.traitKey}.`,
      });
    }
  }
  return issues;
}
