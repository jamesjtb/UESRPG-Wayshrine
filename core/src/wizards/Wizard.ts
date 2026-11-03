import type {
    WizardIssue,
    WizardResult,
    WizardSnapshot,
    WizardStep,
    WizardStepSnapshot,
} from "../../interface/common/Wizard";

export default class Wizard<TStep extends string, TChoice, TResult> {
    private readonly steps: readonly WizardStep<TStep, TChoice>[];
    private index = 0;

    constructor(
        steps: readonly WizardStep<TStep, TChoice>[],
        private readonly result: () => TResult,
    ) {
        if (
            steps.length === 0 ||
            new Set(steps.map((step) => step.id)).size !== steps.length
        ) {
            throw new Error(
                "A wizard requires a non-empty list of uniquely identified steps.",
            );
        }
        this.steps = steps.map((step) => ({ ...step }));
    }

    getSnapshot(): WizardSnapshot<TStep, TChoice> {
        const steps = this.steps.map((step): WizardStepSnapshot<TStep, TChoice> => {
            const evaluation = step.evaluate();
            return {
                ...evaluation,
                id: step.id,
                complete:
                    evaluation.issues.length === 0 &&
                    evaluation.pendingChoices.length === 0,
            };
        });
        const current = steps[this.index]!;
        return {
            currentStep: current.id,
            steps,
            pendingChoices: current.pendingChoices,
            issues: current.issues,
            canGoNext:
                this.index < steps.length - 1 &&
                steps.slice(0, this.index + 1).every((step) => step.complete),
            canGoPrevious: this.index > 0,
            canFinish: steps.every((step) => step.complete),
        };
    }

    next(): WizardResult {
        const snapshot = this.getSnapshot();
        const issues = this.blockers(snapshot.steps.slice(0, this.index + 1));
        if (issues.length > 0) return { ok: false, issues };
        if (this.index === this.steps.length - 1) {
            return {
                ok: false,
                issues: [
                    {
                        code: "last-step",
                        message: "Already at the last step; finish the wizard instead.",
                    },
                ],
            };
        }
        this.index += 1;
        return { ok: true, value: undefined };
    }

    previous(): WizardResult {
        if (this.index === 0) {
            return {
                ok: false,
                issues: [{ code: "first-step", message: "Already at the first step." }],
            };
        }
        this.index -= 1;
        return { ok: true, value: undefined };
    }

    finish(): WizardResult<TResult> {
        const issues = this.blockers(this.getSnapshot().steps);
        return issues.length > 0
            ? { ok: false, issues }
            : { ok: true, value: this.result() };
    }

    private blockers(
        steps: readonly WizardStepSnapshot<TStep, TChoice>[],
    ): WizardIssue[] {
        return steps.flatMap((step) => {
            if (step.complete) return [];
            return step.issues.length > 0
                ? [...step.issues]
                : [
                    {
                        code: "unresolved-choices",
                        message: `Resolve the pending choices in ${step.id}.`,
                    },
                ];
        });
    }
}
