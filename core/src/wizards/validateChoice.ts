import type {
  ChoiceAnswer,
  ChoiceGroup,
  ChoiceIssue,
} from "../../interface/common/Choice";

/** Options and selections use stable primitive keys, not object identity. */
export function validateChoice<T extends string | number>(
  group: ChoiceGroup<T>,
  answer?: ChoiceAnswer<T>,
): ChoiceIssue[] {
  const issues: ChoiceIssue[] = [];
  const add = (code: ChoiceIssue["code"], message: string) => {
    issues.push({ choiceId: group.id, code, message });
  };
  issues.push(...validateChoiceDefinition(group));
  const selections = answer?.selections ?? [];
  if (answer && answer.choiceId !== group.id) {
    add("invalid-option", "Answer belongs to a different choice.");
  }
  if (selections.length !== group.choose) {
    add("selection-count", `Choose exactly ${group.choose} options.`);
  }
  if (new Set(selections).size !== selections.length) {
    add("duplicate-selection", "Selections must be distinct.");
  }
  if (selections.some((selection) => !group.options.includes(selection))) {
    add("invalid-option", "A selection is not an available option.");
  }
  return issues;
}

/** Definition checks are shared by authoring validation and answer evaluation. */
export function validateChoiceDefinition<T>(
  group: ChoiceGroup<T>,
): ChoiceIssue[] {
  if (
    Number.isInteger(group.choose) &&
    group.choose >= 0 &&
    new Set(group.options).size === group.options.length &&
    group.choose <= group.options.length
  ) {
    return [];
  }
  return [
    {
      code: "invalid-choice-definition",
      choiceId: group.id,
      message:
        "Choice must offer enough distinct options for a non-negative integer choose requirement.",
    },
  ];
}
