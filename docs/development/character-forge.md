# Character Sheet engineering notes

Character Sheet presents Core's headless race and characteristic-generation
workflow. See the [Core contract](../../core/README.md#character-creation) for rules,
content validation, answer retention, and preview semantics. React presents Core's
snapshots rather than implementing a second rules or progression model.

The canonical tool URL is `/character-sheet` (a hash route in the browser).
`/character-forge` redirects with history replacement. Internal Forge feature,
session, and page names remain in place to avoid an unrelated directory migration.
The application shell retains its `alt` sidebar layout on desktop and uses Mantine's
default layout on small screens, keeping the navigation toggle above the open
mobile sidebar rather than behind it.

## Ownership and lifetime

- `creation-kit/src/main.tsx` owns the retryable catalog loader. The shared
  `ContentCatalogProvider` exposes initialization state independently of Forge
  sessions, so leaving the Forge does not discard the application catalog.
- `useCharacterCreator.ts` creates a fresh Core `CharacterCreator` in its effect
  and disposes it during cleanup. StrictMode effect replay creates a new creator
  rather than reusing a disposed instance. Its interface exposes detached snapshots,
  preview data, error presentation state, and named commands. The creator, liveness
  flag, request identities, and point-buy initialization flag stay private. Core owns
  reroll policy; the hook publishes it only through the detached generation snapshot.
  Commands capture their originating session; retained callbacks and pending
  completions cannot affect a replacement session after catalog changes or unmount.
- `CharacterForge.tsx` keeps the creator session and primary sheet outside the
  creation modal. It selects `RaceStep` or `CharacteristicsStep` solely from Core's
  `currentStep`. Core supplies registered breadcrumb steps and navigation guards;
  the characteristics breadcrumb is labeled “Generate Characteristics”.
- The creation wizard is an initially closed Mantine `Modal`, large on desktop
  and fullscreen below 48em. The “Create Character” button always retains its
  label. Session-owned visibility and ever-opened flags show “In progress” and
  “Resume: <current step label>” only after the first opening, while closed—even
  without answers. These flags do not infer completeness. The modal contains the
  step indicator, current editor, and `StepNavigation.tsx`, which delegates
  Back/Next to Core. Name editing stays on the persistent sheet.
- Close control, Escape, and backdrop dismissal hide the wizard without disposing
  the creator, changing Core's current step, canceling commands, or resetting
  answers. Editors mount on first opening and remain mounted while hidden, retaining
  presentation drafts and race-index loading/acknowledgment state. The wizard uses
  Mantine's `keepMountedMode="display-none"`, not React Activity hiding: pending
  race-index effects and their portaled error dialog must stay live while closed.
  Pending creator commands continue updating the sheet, and failures can still open
  the error modal.
  A feature-local Mantine `Modal.Stack` coordinates the wizard and existing creator
  and race-index errors; `ErrorModal` accepts an optional stack ID. This does not
  establish application-wide layering or message infrastructure.
  Error exit transitions return focus to the launcher when the wizard is closed;
  when open, Mantine restores the wizard's focus trap. `ErrorModal` exposes the
  optional exit callback without owning Forge session or visibility state.
- `hooks/useContentSummaries.ts` owns summary-list loading, failure acknowledgment,
  retry, and request liveness. Catalog adapters retain caching and deduplication.
  `steps/race/RaceStep.tsx` browses summaries rather than loading all definitions,
  and presents its independent loading, empty, retry, and error states.

Feature paths in these notes are relative to
`creation-kit/src/features/character-forge/`; the provider lives in
`creation-kit/src/app/`.

## Shared presentation components

`components/ToContinue.tsx` presents only supplied outstanding tasks, immediately
below each step title. `userActions.ts` maps Core's race pending choices, content
loads, and generation issue fields into ordered tasks; it does not validate answers
or control Next. Race browsing failures/loading are supplied by the existing index
hook. Characteristics also uses Core's race-step completeness to retain an earlier-step
blocker even when generation is complete. Inline field feedback remains independent.
The feature-local Mantine Accordion retains expansion during answer updates; changing
steps unmounts the editor and resets expansion. Closing the wizard does not reset it.
Pending tasks use the shared `LoadingIndicator` with accessible loading labels.
The borderless presentation uses neutral colors except for its orange warning icon;
the right-hand chevron stays centered within its rotating disclosure affordance.

`components/LimitedCheckboxGroup.tsx` is a controlled presentation component: it
accepts labels, options, selections, a limit, disabled state, and a callback, not a
Core choice object. Both racial skills through `ChoiceGroupField` and favored
characteristics through `CharacteristicsStep` render it. At or above the limit,
only unselected options are disabled. Selected answers, including externally
supplied over-limit answers, remain removable unless the whole field is disabled.
This convenience guard does not replace Core validation.

`ChoiceGroupField.tsx` retains the bold “Choose N” wording, scoped loading, visible
feedback, and optional retry. `steps/race/RacialSkillChoices.tsx` adapts Core race
choices, loads, labels, and commands. Favored characteristics use the seven non-Luck
options with the static description “Choose two”.

`components/AssignmentMenu.tsx` is domain-free and feature-local. It accepts a
trigger element, simple `{ value, label }` options, and `onSelect(value)`. It owns
only Mantine menu presentation: tile-anchored positioning with viewport adjustment,
scrolling when needed, touch-sized items, keyboard navigation, dismissal, and focus
return. It renders labels only, not totals, checks, validation, or dice details.
Custom triggers must forward their ref and button props to the focusable element.
The richer roll-specific action menu is independent rather than extending this
flat option interface. Assignment menus use Mantine's exit-transition callback to restore focus to the
trigger after dismissal, including when the modal's focus trap has reclaimed focus.

## Generation commands and drafts

The hook delegates synchronous generation commands with public Core types:

- `setFavoredCharacteristics`
- `setCharacteristicGenerationMethod`
- `submitCharacteristicRolls`
- `setCharacteristicAssignments`
- `setCharacteristicAllocations`
- `submitLuckRoll`
- `setUnlimitedCharacteristicRerolls`

Its `rerollCharacteristics(ids, rollDice)` host adapter acquires one identified
replacement per selected target and submits the pairs to Core's command. It returns
Core's structured command result, or no result if its originating session is stale
or acquisition throws. There is no host-side pool reconstruction, rule validation,
assignment filtering, batch accounting, or rollback.

Ordinary live field commands delegate to Core, refresh the snapshot and preview, and return
the Core command result. Pool submission is initial-only after its first successful
submission; subsequent replacements go through the session's selective reroll command.
Stale callbacks do nothing. A successful field command is
not evidence that the whole character is valid; use Core's generation completeness
and wizard availability. Ordinary validation does not open the error modal.

Each new Creation Kit session selects rolled generation through Core's method
command before publishing its first snapshot; Core's own defaults and rules remain
unchanged. The “Use Optional Point Buy Rules” Mantine switch is off for rolled
generation, whose controls appear immediately, and on for point buy. There is no
separate generation-method heading or radio group. Both this switch and the adjacent
“Unlimited Rerolls” switch follow the active rolled or point-buy controls and precede
the shared Luck section. Rolled and point-buy drafts remain
separate in Core, while favored selections and Luck are shared. Switching methods,
Back/Next, and race changes retain these answers. Assignment and allocation edits
submit whole replacement maps, including partial maps and explicit clears.

On the first explicit point-buy method selection in a session, the hook supplies
seven zero allocations only if the stored allocation map is empty. A prepopulated
inactive draft is preserved. The private session flag prevents later method
selections or editor remounts from refilling a partial or deliberately cleared
`{}` map. This is a browser default submitted through Core commands, not a Core rule
or a render effect. The method command still returns its own result; initialization
does not make generation complete.

### Browser dice and roll assignments

`steps/characteristics/dice.ts` supplies the small browser acquisition seam.
`createCharacteristicRoller(random)` creates identified 2d10 rolls from an injectable
random-number source, defaulting to `Math.random`. Forge accepts an injected roller,
so tests exercise acquisition deterministically without mocking Core rules. Core
never generates randomness.

The initial “Roll” action obtains seven rolls and submits the complete pool. It is
then replaced by “Reroll (X of 3)”, disabled with no selection. The initial action is
shown until Core reports an accepted pool, so invalid initial drafts remain repairable.
Each result's
integrated bottom action opens a menu to select up to three results for **one batch**.
Using fewer than three forfeits the remainder. New results replace the selected
results even when lower; there is no best-of comparison, undo, or roll history.
The menu's “Reroll” item only selects a result: it never rolls dice, assigns, or
unassigns a result. Only the batch button executes the reroll. Its normal-mode
label includes the current selection count; unlimited mode labels it simply
“Reroll”. There are no selection instructions or standalone counts. Selected
tiles retain their highlighted border and background and accessible selected
description. Once the normal batch is spent, the disabled button reads “Reroll
Used” instead of showing separate feedback text. Unlimited mode still reads
“Reroll” and permits further batches regardless of the spent marker.
Focus moves to the first acquired/replaced tile when
an action removes or disables the active button. There is no whole-pool reroll
button after the initial roll.

“Unlimited Rerolls” defaults off. When enabled it permits repeated batches with up
to all seven results selected. Turning it off after **any** successful batch,
including an unlimited batch, leaves the normal batch spent. Merely toggling it
without using a batch does not spend the allowance. The flag and spent marker
belong to Core's creator session, not the hook or editor: method switches, race
changes, Back/Next, and modal dismissal retain them. A new session resets them.
Selection itself is an editor-local presentation draft. The menu's “Reroll”
item is disabled at the cap or when the batch is spent; “Don't reroll”
remains available, including if switching the option off makes the
current selection exceed three. The batch button is disabled while over the cap.

Controls derive initialization, unlimited/spent labels, availability, and selection
caps from `characteristicGeneration.rerolls`. React owns only the selected-ID draft,
captions, focus, and command-feedback presentation. The hook passes all acquired
replacement pairs to Core; Core alone checks current rules, commits the replacements,
clears selected assignments, and spends the allowance. Retained live callbacks still
reach current Core policy rather than captured render flags. Liveness checks before
and after acquisition prevent stale callbacks or a roller that disposes its session
from publishing results into a replacement session.

Core rejections are displayed inline without clearing selection or changing accepted
results; retry remains possible. These transient command issues do not become Core
answer-validation issues. Acquisition exceptions are logged and open the existing
technical-error modal only for the still-live originating session; partial acquisition
is never submitted. Untouched rolls retain their IDs, faces, positions, and assignments;
rerolled results become unassigned through Core's atomic command.

Luck is excluded from reroll selections and allowances. Its independent
“Roll”/“Reroll” action remains unchanged and replaces only the Luck answer.

Pool tiles integrate a total on top with a bottom menu trigger. The trigger shows
“Rerolling” while selected, otherwise its assigned characteristic, otherwise an
ellipsis icon. Selection takes visual priority but does not clear the assignment
until the batch executes; removing the selection restores the assigned caption.
The total and trigger are sibling buttons inside one rounded border, never nested
interactive controls. The pool total reuses `RollTile`'s tooltip but no longer
renders an assignment caption itself. IDs stay internal; equal totals remain
distinct by ID and ordinal group/total name. Bottom triggers use the exact
accessible label “Actions for result: <total>” (for example “Actions for result:
13”), with assignment and selection exposed as an accessible description. Equal
totals intentionally share that trigger name. Tooltips expose the faces and total, for
example `2d10: 6 + 7 = 13`, with hover, focus, and touch events enabled. Pool tiles
are informational: clicking or pressing a total never changes assignments or opens
an action menu. Luck tile activation still toggles an inline
breakdown and exposes its expanded state.

`RollAssignmentMenu.tsx` owns each integrated tile. The horizontal
Mantine group wraps whole tiles together on narrow screens. The bottom action
opens a feature-local Mantine menu by keyboard, mouse, or touch. It contains the
reroll selection toggle, “Unassign” only for an assigned roll, then a divider and
“Assign To” section listing unoccupied characteristics. All occupied targets,
including this roll's current target, are omitted. Choosing an available target
directly moves the roll's existing assignment in one whole-map command. Replacing
another roll at an occupied destination still requires explicitly unassigning that
destination first. The menu has no dice header. Its viewport adjustment, scrolling,
44px items, dismissal, and exit-transition focus return mirror the flat shared menu
without changing that component or its other usages. Focus returns to the bottom trigger after
menu dismissal or selection; dismissal does not change answers. An open trigger
also handles Escape before focus enters the dropdown: its Mantine propagation
marker prevents the wizard's capture-phase Escape handler from closing the wizard,
and its own handler closes only the menu. Closed triggers do not intercept Escape.
Pool replacement
discards open action menus.

### Point-buy controls

`PointBuyCharacteristics.tsx` renders bounded, wrapping cards and a single points
remaining indicator. `AllocationCard.tsx` places a linked full characteristic label
above an icon-only minus button, editable number, and icon-only plus button. Both
buttons retain 44px hit targets, accessible names, keyboard focus, and disabled
states. Local input text preserves lexical edits such as `1.`; Core owns the numeric
draft.

The UI does not submit negative allocations: typed minus signs are ignored, so
typing `-5` enters `5`; a negative numeric paste resets the allocation to zero.
The change boundary also normalizes negative numeric values to zero. Decrement is
disabled at zero, and increment is disabled at 20 or when fewer than one point
remains. Steppers operate only on integer, in-range drafts; invalid typed values
must be corrected by direct entry. Native number-input arrow stepping is disabled
so it cannot bypass these controls.

Direct entry above 20 or of a fraction is not clamped or reverted: the edit stays
visible with targeted Core feedback. Clearing an input removes its key from the
replacement allocation map. Remaining points are presentation arithmetic over the
entered values, not another validator. Core still enforces all seven allocations,
integer/range constraints, and the exact budget, including for hook commands that
the controls cannot emit.

## Asynchronous behavior and feedback

The hook refreshes when a content selection starts and settles. Session liveness
and request identities prevent obsolete completions from refreshing the UI,
logging failures, or opening a modal. A new race intent invalidates outstanding
bonus operations; different bonus groups can resolve independently.

A pending or failed race change disables bonus editing and suppresses the old
race effects and all generation contributions, including favored flags and Luck's
rolled contribution. Luck's baseline remains 30. Cancel restores the committed
race and retained generation effects; a successful change recalculates against the
new racial baselines without clearing generation drafts. Retained unresolved bonus
selections require resubmission, while resolved groups stay editable. An individual
bonus failure does not suppress unrelated valid groups. Core owns these decisions.

Shared accessible spinners are scoped to catalog initialization, race browsing,
race selection, or the individual skill group. Content failures are logged and
shown through the generic “Something went wrong!” modal, not technical inline
messages. Selection logs contain detached Core issues rather than the adapter's
original error or cause. OK acknowledges a failure without clearing Core's failed
state; retry and cancel remain available, and a failed retry can reopen the modal.

Ordinary validation stays inline, with restrained incomplete-state feedback. Display
filters use `field`, `code`, `characteristic`, and `rollId`, never parsed message
text. They do not remove Core issues or relax navigation/completeness guards:

- Favored-count feedback is omitted in favor of the static instruction, and the
  method-required message is omitted.
- Routine `invalid-assignment` messages are omitted. `roll-count` is hidden only for
  an empty pool; count/dice errors for a supplied invalid pool remain visible.
- Luck identity/dice errors are hidden only when no roll exists. Invalid supplied
  Luck rolls still show their Core errors.
- Point-budget and generic/missing-allocation messages are omitted; supplied invalid
  numeric values retain their characteristic-targeted feedback.

Superseded results are not operational failures. Failed race content still blocks
completion even after its error modal is acknowledged.

## Primary sheet and navigation

The sheet is independent of the selected editor. Its controlled name input writes
each change through Core's `setName` command, preserving exact input including empty
strings and whitespace. “Unnamed Character” is a placeholder only. Name edits do
not fetch content or affect validation and remain available during content failures.

`components/CharacterSheet.tsx` renders Race, Characteristics, Traits, and Skills
from the detached Core preview, without a competing preview view. The resume
indicator belongs to the session's wizard launcher rather than the sheet itself.
The responsive characteristic table always shows all eight PC characteristics as
columns, including before race selection or generation, with Total and Bonus
body rows. Core's `calculateCharacteristicScore` calculates Total as only
`baseline + rolled` and Bonus as the tens digit of that total (`floor(total / 10) % 10`).
The helper is scoped to the unmodified creation score, not a final modified score:
neither favored flags nor modifiers affect it. Generated is Core's `rolled` field
for either generation method. Calculated results remain separate from stored inputs.
Favored characteristics show a read-only star beside their column heading, labeled
“Favored” for assistive technology; non-favored headings have no star.
Only Total score cells trigger a Mantine tooltip showing
`baseline + generated = total`. These cells are keyboard focusable and carry the
same persistent accessible description; tooltips support hover, focus, and touch.
Column headings (including favored stars) and Bonus cells do not trigger tooltips
and are not additional keyboard tab stops.
The native, keyboard-focusable scroll container preserves horizontal scrolling on
narrow screens. The table does not require explanatory product prose.
Traits retain keys/parameters and skills retain resolved ranks; unresolved
labels fall back to readable keys and placeholder descriptions are omitted.

Core registers only `race` then `characteristics`. Valid race answers enable Next;
Back preserves answers. Invalidating an earlier step blocks Core finish eligibility
without automatically moving the current step. Forge does not call `finish()`,
offer a Finish action, or claim complete character creation.

## Testing strategy

Integration tests use real Core creators, injectable catalogs, browser dice sources,
and explicitly settled deferred reads, not timer sleeps or mocked rules.
`test/testCatalog.ts` supplies content fixtures; `test/forgeTestHelpers.tsx` supplies
rendering, column/cell assertions, and controlled reads. Tests verify actual preview cells
as well as detached drafts and command results.

Coverage spans both generation methods, equal-total identity, whole-map edits,
snapshot-driven selection controls, deterministic selective replacements and unaffected
assignment retention, option rendering and retention, rejected-command selection/retry,
acquisition exceptions and stale commands,
Luck isolation, method/navigation retention including cleared allocations,
independent valid-group projection, race suppression/cancel/recalculation, and
generation session isolation across route exit or catalog replacement. Hook tests
cover invalid inputs that the UI prevents and all-step finish guards from either
step. Component tests cover keyboard/touch interaction, tooltip/menu composition,
focus return, controlled limits, and useful invalid numeric feedback. Core tests
remain responsible for exhaustive reroll rules, policy validation, and calculations.
Wizard tests cover initially closed presentation, unanswered first-opening resume,
both steps and all three dismissal mechanisms, retained generation drafts and
assignments, sheet updates while closed, and pending content success/failure.
Recovery tests use real portals/transitions where hidden-editor effects and error
focus return matter (Mantine test mode renders portals inline). They cover closed
race-index failures, explicit retries and repeated failures, closed skill recovery,
canceling resumed pending race changes, and nested Select/assignment-menu Escape
isolation. DOM checks do not establish visual stacking or small-screen reachability;
those require a real browser.

`scripts/content-pipeline.test.ts` compiles YAML to temporary files under
`/tmp/opencode`, then reads those files through the real browser catalog and creator.
Its file-backed fetch seam models a static host's single URL-decoding pass. Script
checks include DOM and Vite types; Node types stay outside the browser config.

Run `pnpm --filter @wayshrine/creation-kit test` for frontend and content compiler
tests, and `pnpm --filter @wayshrine/core test` for shared type and rule checks.

## Limitations and extension boundaries

Only race and characteristic generation are implemented, not the remaining
character-creation or advancement rules. There is no Foundry runtime integration.
For Core state/projection boundaries, see
[generation engineering notes](characteristic-generation.md).

New editors should replace only the modal's current editor and continue using Core
snapshots and guards. Keep shared UI feature-local until another tool needs it;
do not introduce a second wizard or rules calculator. The application catalog
outlives Forge sessions and represents a pinned revision. Content updates require
a fresh runtime/catalog and creator rather than swapping definitions inside a
session; see the [static content maintenance instructions](../../README.md#creation-kit-static-content).
