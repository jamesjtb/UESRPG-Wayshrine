# Working conventions

- For phased work, agree on the plan, then delegate one authorized phase at
  a time. Report changes, files, checks, and deviations; stop for user review.
- Handle feedback in a separate subagent pass, preferably reusing its session.
  The user commits. Never commit or start the next phase without authorization.
- Prefer explicit code and named helpers. Allow if-in-loop or loop-in-if;
  extract deeper nesting. Avoid nested ternaries and dense callback chains.
- Keep README files for usage/setup. Put durable engineering notes in
  docs/development/; keep progress reports and test counts in conversation.
- Report checks actually run and distinguish pre-existing failures.
  Leave unrelated changes untouched.

## Scope and verification

- Keep feedback passes scoped to the requested change. Report unrelated
  discoveries and wait for approval before fixing them.
- Match verification to the change:
  - Copy, icons, or cosmetic changes: affected tests and formatting checks.
  - Layout changes: affected tests and targeted browser checks.
  - Behavior changes: relevant integration tests and typechecks.
  - Phase completion: full relevant suites and consolidated browser checks.
- Repeat full suites or browser matrices during feedback only when regression
  risk or shared behavior warrants it; otherwise defer them to phase completion.
- Document durable behavior and architecture, rather than wording, spacing,
  or icon adjustments.
- Report checks run and checks deferred; keep reporting within the authorized
  scope rather than expanding work for report completeness.
