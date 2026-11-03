export interface WizardIssue {
  code: string;
  message: string;
  choiceId?: string;
}

export interface StepEvaluation<TChoice> {
  pendingChoices: readonly TChoice[];
  issues: readonly WizardIssue[];
}

export interface WizardStep<TStep extends string, TChoice> {
  id: TStep;
  evaluate: () => StepEvaluation<TChoice>;
}

export interface WizardStepSnapshot<
  TStep extends string,
  TChoice,
> extends StepEvaluation<TChoice> {
  id: TStep;
  complete: boolean;
}

export interface WizardSnapshot<TStep extends string, TChoice> {
  currentStep: TStep;
  steps: readonly WizardStepSnapshot<TStep, TChoice>[];
  pendingChoices: readonly TChoice[];
  issues: readonly WizardIssue[];
  canGoNext: boolean;
  canGoPrevious: boolean;
  canFinish: boolean;
}

export type WizardResult<T = void> =
  { ok: true; value: T } | { ok: false; issues: readonly WizardIssue[] };
