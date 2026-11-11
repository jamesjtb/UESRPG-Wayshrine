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
Core choice object. Racial skills through `ChoiceGroupField` render it. At or above the limit,
only unselected options are disabled. Selected answers, including externally
supplied over-limit answers, remain removable unless the whole field is disabled.
This convenience guard does not replace Core validation.

`ChoiceGroupField.tsx` retains the bold “Choose N” wording, scoped loading, visible
feedback, and optional retry. `steps/race/RacialSkillChoices.tsx` adapts Core race
choices, loads, labels, and commands. Favored characteristics instead use the
generation draft table's star toggles, described below.

`components/AssignmentMenu.tsx` is domain-free and feature-local. It accepts a
trigger element, simple `{ value, label }` options, and `onSelect(value)`. It owns
only Mantine menu presentation: tile-anchored positioning with viewport adjustment,
scrolling when needed, touch-sized items, keyboard navigation, dismissal, and focus
return. It renders labels only, not totals, checks, validation, or dice details.
Custom triggers must forward their ref and button props to the focusable element.
The table's characteristic and Luck menus are independent rather than extending this
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

Its `rerollCharacteristics(ids, rollDice, rerollLuck = false)` host adapter acquires one identified
replacement per selected pool target and optionally one Luck replacement, then submits
all acquired dice to Core's atomic command. It returns
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
“Unlimited Rerolls” switch live inside a feature-local Mantine “Options” accordion,
after the active rolled or point-buy controls and initial Luck acquisition when needed.
Options starts collapsed; its accessible disclosure retains expansion during
generation updates and method changes while the step stays mounted. It reuses
`ToContinue.module.css`'s borderless neutral frame, hover background and boxed
chevron, retaining Mantine's keyboard-focus outline without adding a shadow.
Closing the wizard also preserves expansion because the editor stays mounted. Leaving the step
resets only the accordion's expansion, not Core answers. The panel contains only
the two switches; validation and command feedback remain outside it. Luck rerolling
is in its table cell. Rolled and point-buy drafts remain
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

`steps/characteristics/CharacteristicDraftPreview.tsx` appears beside rolled controls
and contains point-buy editing. Its eight characteristic rows show Baseline, Rolled (Points for point buy), Total,
and Favored columns, without a visible caption or Bonus column. The hook's existing detached Core preview supplies racial baselines
directly, including Luck's 30; baselines are never inferred by subtracting generated
values from scores. The preview's usable race also controls suppression during pending
or failed race changes. The draft table does not fetch content or retain creator state.

This editor-local draft preview is presentation-only: valid individual assigned
rolls or allocations appear immediately, even when the full assignment map or point
budget is incomplete. Core's structured field/characteristic issues exclude invalid
supplied values, displayed as “Invalid”; missing contributions display an em dash
in informational cells or a down chevron in menu triggers, distinct from an explicit
point-buy zero. An invalid roll pool supplies no draft dice.
Totals use only available numeric contributions with Core's
`calculateCharacteristicScore`. Neither this table nor its partial arithmetic changes
Core validation, completeness, navigation guards, or the persistent sheet's atomic
generation-group projection.

The Favored column has seven accessible pressed-state star buttons and no Luck control.
At two selections only unselected stars are disabled; selected stars remain removable.
Each toggle submits characteristic keys through Core's existing favored command,
independent of assignments, rerolls, and generation method.

In rolled generation only, the seven non-Luck Rolled cells are menu buttons.
Empty menu triggers show a decorative down chevron instead of an em dash;
triggers displaying a value show only the value, without a chevron, including Luck.
Noninteractive cells retain ordinary values or em dashes, without chevrons.
Full accessible trigger names and Mantine's expanded/menu semantics are unchanged;
the icons are hidden from assistive technology.
`steps/characteristics/RolledContributionMenu.tsx` lists only unassigned accepted pool results
with only `(die1 + die2) total` visible. Accessible labels additionally include
the result's original pool ordinal and “Unassigned” status. Occupied trigger
descriptions identify their assigned result. Equal totals therefore remain
distinguishable without visible extra labels or exposing internal IDs.
Selecting an unassigned result for an empty cell submits the whole replacement
map through `setCharacteristicAssignments`. Both the list and selection boundary
exclude assigned roll IDs, never totals. An occupied cell offers only “Unassign”;
replacement always requires explicitly clearing the destination first. Clearing
removes only that characteristic's key. Assigned ordinary results disappear from
the dice panel and all assignment pickers. Reusing an assigned result requires
unassigning its source first; that restores it to available pickers and returns
its tile in original pool order. These are whole-map presentation edits, not
validation or Core policy.

Empty pools show “Make characteristic roll first”; invalid initial pools are not selectable.
Menus use viewport-adjusted Mantine positioning, scrolling, 44px items, keyboard
navigation and focus return to the cell. Escape closes an open cell menu without
closing the wizard. Pool replacement remounts cell menus so obsolete options do
not survive a reroll. Luck is never assignable; its independent table action is
described below. Favored-star behavior is independent of generation method.
Assigning or clearing a result updates
the partial draft arithmetic immediately without changing Core's atomic main-sheet
projection.

The preview uses one transposed table at every screen size: eight Str–Lck rows with
Characteristic, Base, Rolled, Total, and Favored column headings when its own
named inline-size container is at least 26rem wide. Below that width, only the first
and last headings shorten to Char. and Fav. CSS switches text spans, not tables;
the full accessible column names remain constant and both visual variants are
hidden from assistive technology. The wide first column receives 26% of table width
to fit its full label; narrow columns retain equal widths. This depends on the
preview's actual available width, including the 65% rolled-panel split, not the
viewport. Baseline's visible Base label and the Rolled/Total headings do not change.
Points names the generation contribution in point buy, including Luck's independent roll.
Point buy gives its editable contribution column extra width, retaining compact first/last headings
below the same container threshold. The five-column table uses Mantine's
`layout="fixed"` at full available width with no minimum-width scroll container.
Abbreviations and numeric cells do not wrap or clip. Full characteristic/statistic
names remain in accessible labels and abbreviation titles; star buttons retain full
characteristic labels. There are no alternative hidden tables, container-query
orientation switches, or JS viewport inference. JSDOM tests check the unique markup,
semantic names, draft values, and interactions. Real-browser checks should resize the
table's available width across the 26rem header threshold and down to 280px, and check narrow viewports separately, asserting
unwrapped headings, seven unique star controls, and no horizontal overflow.

Native `disabled` still prevents interaction at the selection limit. The ActionIcon
class overrides only the disabled background to transparent with both `:disabled`
and `[data-disabled]`, following the documented
[disabled styling pattern](https://mantine.dev/core/action-icon/#customize-disabled-styles).
The [Table layout and spacing APIs](https://mantine.dev/core/table/) keep this
configuration independent of the persistent sheet's scrollable Total/Bonus table.

`steps/characteristics/dice.ts` supplies the small browser acquisition seam.
`createCharacteristicRoller(random)` creates identified 2d10 rolls from an injectable
random-number source, defaulting to `Math.random`. Forge accepts an injected roller,
so tests exercise acquisition deterministically without mocking Core rules. Core
never generates randomness.

The initial rolled “Make Characteristic Roll” button fills the dice panel's available
width, like Reroll, and obtains seven rolls and Luck. It submits the pool
and shared Luck answer through their Core commands. It obtains Luck only when no
shared answer exists, so switching from point buy cannot silently replace Luck.
Point buy's initial “Roll” obtains only Luck and never changes allocations. The
rolled pool action is
then replaced by “Reroll (X of 3)”, disabled with no selection. The initial action is
shown until Core reports an accepted pool, so invalid initial drafts remain repairable.
Each unassigned pool result's whole tile directly toggles selection for **one batch**
of up to three results. Click again to deselect; keyboard and touch work identically.
Using fewer than three forfeits the remainder. New results replace the selected
results even when lower; there is no best-of comparison, undo, or roll history.
Toggling a tile never rolls dice, assigns, or unassigns a result. Only the batch
button executes the reroll. Its normal-mode
label includes the current selection count; unlimited mode labels it simply
“Reroll”. There are no selection instructions or standalone counts. Selected
tiles use a filled blue background, white text, a highlighted border, a “Rerolling”
caption and `aria-pressed="true"`. Once the normal batch is spent, the disabled button reads “Reroll
Used” instead of showing separate feedback text. Unlimited mode still reads
“Reroll” and permits further batches regardless of the spent marker.
Focus moves to the first acquired/replaced tile when
an action removes or disables the active button. There is no whole-pool reroll
button after the initial roll.

“Unlimited Rerolls” defaults off. When enabled it permits repeated batches with up
to all seven shared results selected. Luck is rerolled separately from its table cell.
Turning it off after **any** successful shared-pool batch,
including an unlimited batch, leaves the normal batch spent. Merely toggling it
without using a batch does not spend the allowance. The flag and spent marker
belong to Core's creator session, not the hook or editor: method switches, race
changes, Back/Next, and modal dismissal retain them. A new session resets them.
Selection itself is an editor-local presentation draft. Assigning a selected roll
clears that roll's local selection when its tile disappears. It cannot remain a
hidden batch target or reappear selected after unassigning; no Core reroll policy
or allowance is changed by this presentation cleanup. Unselected tiles are disabled
at the cap or when Core makes rerolls unavailable. Selected tiles remain deselectable,
including when the allowance becomes unavailable or disabling unlimited makes the
selection exceed three. The batch button is disabled while over the cap. Tiles use
guarded `aria-disabled` activation rather than native disabled buttons: they remain
focusable for dice inspection and focus return after a spent batch, but unavailable
tiles cannot be selected by mouse, touch or keyboard. The batch button uses native
disabled behavior.

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

Initial pool acquisition (including missing Luck) and initial Luck-only acquisition
use the same session-guarded dice-failure reporter as selective rerolls. An acquisition
exception opens the existing technical-error modal, leaves the draft unsubmitted,
and permits retry. Retained reporters from replaced/disposed sessions do nothing.

Rolled generation uses a feature-local named inline-size container and two columns
sharing available width 65:35 after the gap: the draft table on
the left and a dice panel on the right, separated by a vertical border. Grid stretch
matches their heights; the Roll/Reroll button is first in the panel, aligned with the
table header. Unassigned ordinary results use a two-column grid with 6px gaps. Below 40rem of
available editor width, the panel stacks below the table with a horizontal border.
There is still only one table and one panel; CSS, not JavaScript viewport inference,
controls their layout. The result grid remains two columns on phones.

Neither result panel contains a Luck tile or Luck divider. Luck appears in the
draft table only. With an existing valid Luck roll and Core's unlimited flag on,
`LuckContributionMenu.tsx` makes its contribution cell a menu trigger in either method.
Its single “Reroll” action immediately calls the existing host adapter as
`rerollCharacteristics([], rollDice, true)`. It never selects Luck, joins an ordinary
batch, changes ordinary selected IDs or spends the normal batch allowance. Luck-only
rerolls also work in point buy without an initialized shared pool. With unlimited
off, accepted Luck is informational, with no reroll menu. Missing/invalid Luck has no reroll menu.
The trigger's accessible description retains the dice breakdown; menu focus and
Escape behavior match the assignment pickers.

`LuckRoll.tsx` owns initial acquisition and invalid-draft feedback. Point buy places
this control directly in the table's Luck contribution cell, with no duplicate action
outside the table. Its “Roll” button remains until valid Luck is accepted, then the
cell shows the result and the existing optional reroll menu. Acquisition failures use
the same session-guarded error reporter and leave the cell action available for retry.
Rolled mode still obtains missing Luck with “Make Characteristic Roll”; after
pool initialization a missing/invalid Luck draft can be repaired with the same
initial-acquisition control. Accepted Luck has no extra result display or batch
button. Invalid supplied Luck retains Core's inline field feedback.

Independent Luck command rejections appear in the step's “Luck reroll feedback”
group; accepted values, ordinary selection and allowance remain intact. Acquisition
exceptions go through the hook's existing technical-error seam and error modal.
Core remains responsible for replacement validation and policy; its mixed-batch API
is unchanged even though this editor no longer uses it.

`RerollTile.tsx` owns each ordinary result's single toggle button, reusing `RollTile`'s
hover/focus/touch dice tooltip. There are no result action menus, separate total
buttons, action strips or nested controls. Assigned results live only in the table
until explicitly unassigned. The old roll-assignment menu and unused unassign
callback/map-removal helper are removed; the right panel owns no assignment commands.

Equal totals remain distinct by internal roll ID and original pool ordinal. Toggle
names include both ordinal and total, for example “Roll 1, total 13”; a persistent
accessible description contains the dice breakdown and selection state, while
`aria-pressed` exposes the toggle state independently of its tooltip. Tooltips show
the faces and total, for example `2d10: 6 + 7 = 13`. `RolledCharacteristics` retains
the two-column grid, selected-ID cleanup and focus to the first acquired/replaced
tile, including after the normal allowance is spent. Assignment and independent
Luck menus remain in the table with their existing Escape isolation and focus return.

### Point-buy controls

`CharacteristicDraftPreview.tsx` renders a single points-remaining indicator beside
the table. Each non-Luck Points cell contains `AllocationInput.tsx`: an icon-only
minus button, editable number, icon-only plus button, and targeted inline Core
feedback. Full characteristic names remain in the row and control accessible labels.
Stepper buttons retain 44px touch targets even in the narrow table.
Local input text preserves lexical edits such as `1.`; Core owns the numeric draft.
Inputs continue to show editable stored drafts while unusable race content suppresses
their contribution to totals. There are no separate point-buy allocation tiles.

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
body rows. Core's `calculateCharacteristicScore` calculates Total as
`baseline + rolled + modifiers - purchase cost` and Bonus as the tens digit of that
total (`floor(total / 10) % 10`). Favored flags add no implicit numeric adjustment.
The generation-only draft table excludes explicit modifiers and purchase costs.
Generated is Core's `rolled` field
for either generation method. Calculated results remain separate from stored inputs.
Favored characteristics show a read-only star beside their column heading, labeled
“Favored” for assistive technology; non-favored headings have no star.
Only Total score cells trigger a Mantine tooltip showing
`baseline + generated`, explicit signed modifiers and purchase deduction, then the
effective total. These cells are keyboard focusable and carry the
same persistent accessible description; tooltips support hover, focus, and touch.
Column headings (including favored stars) and Bonus cells do not trigger tooltips
and are not additional keyboard tab stops.
The native, keyboard-focusable scroll container preserves horizontal scrolling on
narrow screens. The table does not require explanatory product prose.
Traits retain readable keys/raw parameters and skills retain resolved ranks.
Forge displays compiled labels and race descriptions directly as plain text;
it neither resolves nor hides authored `LOCALE` references. Readable-key fallback
is only for genuinely optional missing labels, not English fallback. The compiler
owns required display coverage and explicit per-leaf English fallback. Markdown
rendering, trait-definition display reads, and applied-template formatting are
not implemented. Literal player names and parameter values are not translated.

Core registers `race`, `characteristics`, then the headless `birthsign` step.
Creation Kit has no birthsign editor yet; this is an intermediate integration
checkpoint, not a complete browser wizard. The new step must not be silently skipped
or reinterpreted as characteristics. Valid race answers enable Next;
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
partial draft table values versus atomic main-sheet projection, missing versus explicit
zero contributions, invalid supplied values, equal-total picker identities and
accessible identities, assigned-ID omission with equal totals, explicit source and
destination clear-before-reuse behavior,
cell-menu keyboard/touch navigation and focus return, favored-star limits and key retention,
default-collapsed Options disclosure, mounted expansion retention and hidden-switch
answer retention across generation updates and wizard dismissal,
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

Layout checks also need a real browser: rolled generation must show equal-height
65:35 table/panel columns (after the gap), with the Roll/Reroll button aligned to the table header at or
above 40rem, then stack below that threshold with a horizontal divider. Assert one
button per unassigned pool result, two result columns and no overflow on phones.
Check hidden assigned tiles returning in pool order, concise visible picker labels,
and independent table Luck rerolls without losing an ordinary selection. For point buy,
check seven editable Points cells, stepper bounds, retained invalid numeric edits and
wrapped inline feedback, method-switch retention, and no duplicate allocation tiles.
Neither panel may contain a Luck tile or divider.
Size the editor container directly during threshold
probes: a modal scrollbar can otherwise reduce its available width. Test narrow
screens separately for reachability and horizontal overflow. JSDOM does not compute
container-query layout geometry.

`scripts/content-pipeline.test.ts` compiles YAML to temporary files under
`/tmp/opencode`, then reads those files through the real browser catalog and creator.
Its file-backed fetch seam models a static host's single URL-decoding pass. Script
tests also render Forge from actual English authoring and minimal test-only French
shards, exercising compiled labels/descriptions, racial skill options, staged race
exclusion, and navigation/dismissal retention with a real creator. Script checks
include JSX, DOM, Mantine collection, and Vite types for that integration; Node
types stay outside the browser config.

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
session. Changing content language has the same requirement: each catalog pins
one compiled language and fallback policy, with no UI picker or runtime fallback.
See the [static content maintenance instructions](../../README.md#creation-kit-static-content).
