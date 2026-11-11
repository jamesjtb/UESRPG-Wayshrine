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
  mutable copy. Draft commands replace their submitted fields, retain invalid edits,
  and report field-relevant issues from the same pure validator. Initial pool drafts
  are editable only until the first valid seven-result pool is accepted.
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

`CharacterCreationStep` identifies `race`, `characteristics`, then `birthsign`. The generic
`Wizard` remains responsible for navigation and all-step finish guards; there is no
second progression model. The characteristics evaluator reports generation issues
with no generic pending choices. Dedicated generation snapshots carry field
details, even when the current wizard step is race. Invalidating race while on
characteristics blocks finish but does not automatically navigate backward.

## Host integration and extension seams

The host owns dice acquisition and roll IDs. Core owns reroll policy and session
state, without randomness or GM permission checks. `submitCharacteristicRolls`
accepts initial drafts until a valid pool is committed, then rejects all later
whole-pool submissions. `rerollCharacteristics` accepts explicit
`{ targetRollId, replacement }` pairs. It validates the entire batch before mutation:
live session, rolled method, initialized pool, policy allowance, batch size, unique
known targets, valid faces, and distinct replacement IDs absent from the current
pool. It then replaces selected results in place, removes only their assignments,
and spends the batch when shared results are replaced. There is no submit/restore path. Assigned rolls remain eligible.

Normal mode permits one batch of one to three, forfeiting unused slots. Unlimited
defaults off and permits repeated batches up to seven; every successful pool batch still
spends the normal allowance. Disabling unlimited never restores it. Rejected commands
return structured issues but do not change drafts, preview, allowance, or persistent
validation. Luck remains outside the shared pool and cannot be a shared-pool target ID.
`rerollCharacteristics(replacements, luckReplacement?)` optionally includes selected
Luck in the same atomic command. Luck requires unlimited mode and an existing Luck
answer, with valid replacement dice. Core validates both groups before committing
either; one invalid group rejects the whole command. The seven-result batch cap
counts only pool replacements. A Luck-only command works in either method without
an initialized pool and never spends the normal allowance. Mixed batches retain the
usual rolled-method, initialization and shared-pool rules and spend that allowance.
`submitLuckRoll` accepts an initial valid Luck roll in either method, then requires
unlimited mode for replacements. It rejects locked replacements atomically with a
Luck-targeted `reroll-unavailable` issue, including invalid attempted replacements.
Invalid initial drafts remain correctable. Luck commands never spend the normal
characteristic batch; pool-only batches never replace Luck. The shared
answer and unlimited policy survive method changes.

The creator stores only initialization, unlimited status, and spent status, outside
generation answers. Its detached `characteristicGeneration.rerolls` snapshot derives
`available` and `maxBatchSize` (zero when unavailable) from those facts, active method,
and disposal. Policy survives method, race, and navigation changes. Disposal clears
it and rejects later commands; each new creator starts fresh. Pure answer validation
and calculation remain independent of this workflow policy. Do not turn map
replacements into merges or make inactive-draft edits switch methods.

Creation Kit delegates selective rerolls and unlimited options to this contract.
It retains only dice acquisition and transient selection/feedback presentation; see
the [Forge reroll integration notes](character-forge.md#browser-dice-and-roll-assignments).

### Creation Kit integration

Character Sheet selects its race and generation editors from Core's `currentStep`.
The session and primary sheet stay outside the dismissible creation modal;
Back/Next controls live inside the modal above the individual editors' lifetimes.
`useCharacterCreator` exposes `setFavoredCharacteristics`,
`setCharacteristicGenerationMethod`, `submitCharacteristicRolls`,
`setCharacteristicAssignments`, `setCharacteristicAllocations`, `submitLuckRoll`,
`setUnlimitedCharacteristicRerolls`, and the dice-acquiring `rerollCharacteristics` adapter.
They use public Core types, refresh detached snapshots and previews, and are bound
to the originating session. Catalog replacement or route exit disposes that session;
retained callbacks and obsolete content completions cannot affect its replacement.

Browser randomness lives in the feature-local `createCharacteristicRoller(random)`
seam, injectable through Forge. Initial rolled generation acquires seven identified
pool rolls and Luck, omitting Luck acquisition when a shared answer already exists;
point-buy's initial Roll acquires only Luck without editing allocations.
selective rerolls acquire one replacement per selected pool target and optionally
selected Luck, then submit one atomic Core batch. Luck keeps its independent policy.
The host adapter returns Core's
structured result; rejection leaves accepted answers and the editor's selection intact.

The browser selects rolled generation when creating each session. Its first explicit
point-buy selection supplies seven zeros only if the stored allocation map is empty;
a private per-session flag preserves prepopulated drafts and later partial/cleared
maps. These are host defaults submitted through commands, not Core defaults or rules.

Pool tiles have separate informational totals and integrated action-menu triggers,
whether assigned or not. The menu toggles reroll selection, offers explicit unassignment,
and can move a roll directly to an unoccupied characteristic. Occupied destinations
must first be unassigned. Selection is presentation-only until Core accepts the batch.
Detailed captions, accessible names, limits, button labels, keyboard/touch behavior,
and focus handling belong in the
[Forge dice and assignment notes](character-forge.md#browser-dice-and-roll-assignments).

Point-buy controls and restrained incomplete-state feedback are presentation conveniences,
not substitutes for Core validation. See [point-buy controls](character-forge.md#point-buy-controls)
and [feedback ownership](character-forge.md#asynchronous-behavior-and-feedback).
The primary sheet uses Core's `calculateCharacteristicScore` for effective
`baseline + rolled + modifiers - purchase cost` totals and tens-digit bonuses;
favored flags add no implicit numeric adjustment. The generation-only draft table
passes just baseline and draft rolled values to exclude package effects and costs.
See [sheet presentation](character-forge.md#primary-sheet-and-navigation)
for table semantics and calculation disclosure.

Only race and characteristic generation are implemented, not full character
creation. Forge has no Finish action and no Foundry runtime integration; see
[Forge limitations](character-forge.md#limitations-and-extension-boundaries).

Core tests separate numeric/identity rules, creator retention/isolation and
projection, and package-entry-point host flows. The public host test imports only
`@wayshrine/core` and the test runner, runs in Node with a local content catalog and
explicit dice, and compares submission issues, full active validation, step completeness, strict calculation,
and finished data while correcting invalid submissions. Its reroll flow covers
selective final replacements, rejected repeat and whole-pool submissions, unlimited
batches, switch-off, and snapshot detachment. Exact answer/contribution/statistic
shapes and standalone validation demonstrate that workflow policy does not enter
final answers, calculated contributions, or finished characteristic data.
Consumer tests exercise both registered steps and the default Luck baseline, independently valid preview
groups, draft retention, race-change suppression/restoration, and session isolation.
