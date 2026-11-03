# Characteristic generation engineering notes

For host setup and command examples, use the
[Core usage contract](../../core/README.md#characteristic-generation).

## Boundaries

- `core/interface/character/CharacteristicGeneration.ts` groups answer, draft,
  snapshot, issue-target, and contribution types. Keys come from the shared
  `Characteristic` definition; PC-specific Luck stays outside assignments,
  allocations, and favored selections. Public host imports use `@wayshrine/core`.
- `core/src/character/characteristicGeneration.ts` owns pure rules and calculations.
  Numeric checks reject non-integers, non-finite values, and out-of-range faces or
  allocations without coercion. Roll identity is distinct from total: equal totals
  are valid, duplicate pool IDs are not.
- `CharacterCreator` stores common favored/Luck answers and separate rolled and
  point-buy drafts. It derives the active answer rather than maintaining a second
  mutable copy. Commands replace their submitted fields, retain invalid edits, and
  report only field-relevant issues from the same pure validator.
- Snapshot construction independently detaches both drafts and the active answer,
  including nested dice. Validation produces fresh issue objects. Disposal clears
  drafts and rejects later commands before mutation; race operations never reset
  generation state.

## Validation, projection, and navigation

The strict public calculator and internal preview projection share contribution
calculation. Preview projection uses validation issue fields to gate three groups:
favored, active non-Luck generation, and Luck. All issues for method, rolls,
assignments, or allocations block the entire non-Luck group. Invalid groups emit
zero/false contributions, so reconstruction cannot leave stale effects behind.
Inactive drafts do not participate in active validation or projection.

Race baselines remain separate from generated `rolled` contributions, including
point buy. Luck starts with baseline 30; its generated contribution is only the
separately supplied dice total. Favored selections currently project flags, not a
calculated final characteristic score.

The creator applies generation after its race usability guard. Missing races,
pending/failed race changes, disposal, and invalid global race references suppress
all generation effects while leaving the default Luck baseline intact. Individual
racial choice failures do not suppress generation or unrelated valid grants.

`CharacterCreationStep` identifies `race` then `characteristics`. The generic
`Wizard` remains responsible for navigation and all-step finish guards; there is no
second progression model. The characteristics evaluator reports generation issues
with no generic pending choices. Dedicated generation snapshots carry field
details, even when the current wizard step is race. Invalidating race while on
characteristics blocks finish but does not automatically navigate backward.

## Host integration and extension seams

The host owns dice acquisition, roll IDs, and any reroll policy. Core does no
randomness or GM permission checks. A reroll replaces the complete shared pool and
clears assignments, even when IDs are reused; hosts must explicitly reassign it.
Replacing Luck has no shared-pool side effects. Do not turn map replacements into
merges or make inactive-draft edits switch methods.

Only race and characteristic generation are implemented, not full character
creation. The browser still renders its race editor unconditionally; see
[Forge limitations](character-forge.md#limitations-and-extension-boundaries).
Frontend followup must expose generation commands and route editors by Core's
current step, without duplicating validation or generating dice inside Core.

Core tests separate numeric/identity rules, creator retention/isolation and
projection, and package-entry-point host flows. The public host test compares
submission issues, full active validation, step completeness, strict calculation,
and finished data while correcting invalid submissions. Consumer tests must model
the two registered steps and the default Luck baseline rather than assuming a
race-only creator or an entirely zero-characteristic preview.
