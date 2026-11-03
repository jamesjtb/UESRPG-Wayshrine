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
