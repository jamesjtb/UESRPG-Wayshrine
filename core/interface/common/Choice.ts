/** A reusable requirement to choose distinct options. IDs are stable within a source. */
export interface ChoiceGroup<TOption> {
  id: string;
  choose: number;
  options: readonly TOption[];
}

/** Answers are stored separately from their definitions. */
export interface ChoiceAnswer<TSelection> {
  choiceId: string;
  selections: readonly TSelection[];
}

export interface ChoiceIssue {
  choiceId: string;
  code:
    | "invalid-choice-definition"
    | "selection-count"
    | "duplicate-selection"
    | "invalid-option";
  message: string;
}

/** A choice and its current selections, whether resolved or still pending. */
export interface ChoiceState<TOption> extends ChoiceGroup<TOption> {
  selections: readonly TOption[];
}
