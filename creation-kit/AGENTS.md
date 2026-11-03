# Creation Kit

- Core owns rules, validation, effects, and navigation guards; React presents
  its snapshots and results.
- Use Mantine directly. Keep reusable UI feature-local until another tool
  needs it.
- Before changing Forge behavior, read core/README.md and
  docs/development/character-forge.md (paths relative to repository root).
- Keep the creator session and character preview outside individual steps.
  Keep mutable session internals private.
- Reuse LoadingIndicator and ErrorModal. Log technical failures; keep ordinary
  validation inline. Hide development-status messages from product UI.
- Test Forge behavior with real Core creators, injectable catalogs, and
  explicitly settled deferred reads—not sleeps or mocked rules.
