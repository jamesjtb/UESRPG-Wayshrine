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

### Creation Kit integration

Character Sheet selects its race and generation editors from Core's `currentStep`.
The session and primary sheet stay outside the dismissible creation modal;
Back/Next controls live inside the modal above the individual editors' lifetimes.
`useCharacterCreator` exposes `setFavoredCharacteristics`,
`setCharacteristicGenerationMethod`, `submitCharacteristicRolls`,
`setCharacteristicAssignments`, `setCharacteristicAllocations`, and `submitLuckRoll`.
They use public Core types, refresh detached snapshots and previews, and are bound
to the originating session. Catalog replacement or route exit disposes that session;
retained callbacks and obsolete content completions cannot affect its replacement.

Browser randomness lives in the feature-local `createCharacteristicRoller(random)`
seam, injectable through Forge. Pool and Luck controls say “Roll” or “Reroll” and
acquire dice only on activation. A pool reroll submits seven identified rolls and
clears assignments through Core; Luck replacement remains independent.

Roll tiles show totals and assigned characteristic captions, retaining IDs
internally and distinguishing equal totals with ordinal accessible names.
Tooltips expose die math on hover/focus, with touch
events enabled. An unassigned tile opens a tile-anchored, label-only menu of
available characteristics; an assigned tile directly unassigns on click, tap, or
keyboard activation. Moving therefore requires unassigning before choosing a new
target. The shared `AssignmentMenu` knows only its trigger, options, and selection
callback. Luck tile activation instead toggles an inline breakdown. Pool menus do
not contain dice details or validation. See [Character Sheet engineering notes](character-forge.md)
for interaction ownership and focus handling.

The browser does not choose a method automatically. Its first explicit point-buy
selection supplies seven zeros only if the stored allocation map is empty; a
private per-session flag preserves prepopulated drafts and later partial/cleared
maps. This is a host default via commands, not a Core default. Compact point-buy
cards use linked labels and inline icon-only minus/input/plus controls with 44px
button targets. UI entry cannot submit negative values; typed minus signs are
ignored and negative numeric pastes normalize to zero. Direct values above 20 or
fractions remain invalid Core drafts with inline feedback. Clearing a field removes
its key. Budget display and stepper guards are presentation conveniences, not
substitutes for Core validation. Favored and racial choices share the controlled
`LimitedCheckboxGroup`, without inventing another domain choice object.

Forge filters routine incomplete-state messages by structured issue targets/codes,
without changing Core issues or guards. Missing method/favored-count, routine
assignment, empty-pool count, absent-Luck, and routine allocation/budget feedback
are restrained; actual supplied invalid dice and numeric edits retain actionable
feedback. Invalid groups still lose their contributions independently. Pending or
failed race changes suppress all generation effects except Luck's baseline; cancel
restores them, and a successful change reapplies retained drafts to new baselines.

The preview always shows all eight characteristic columns, with Total and Bonus
body rows. Core's `calculateCharacteristicScore` computes the unmodified
creation total (`baseline + rolled`) and its tens-digit bonus; neither favored
flags nor modifiers change those values. Generated is `rolled` for both methods.
Mantine tooltips only on Total score cells disclose the baseline, generated
contribution, and total through hover, keyboard focus, and touch. Those cells carry
the persistent calculation description and are the table's only cell tab stops;
column headings, favored stars, and Bonus cells do not trigger tooltips.
Favored characteristics have a read-only star beside their column heading, labeled
“Favored” for assistive technology; non-favored headings have no star.
Luck's default baseline remains visible even before race selection. The
table scrolls horizontally on narrow screens. No explanatory totals prose is
required in the product UI.

Only race and characteristic generation are implemented, not full character
creation. Forge has no Finish action and no Foundry runtime integration; see
[Forge limitations](character-forge.md#limitations-and-extension-boundaries).

Core tests separate numeric/identity rules, creator retention/isolation and
projection, and package-entry-point host flows. The public host test compares
submission issues, full active validation, step completeness, strict calculation,
and finished data while correcting invalid submissions. Consumer tests exercise
both registered steps and the default Luck baseline, independently valid preview
groups, draft retention, race-change suppression/restoration, and session isolation.
