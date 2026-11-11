# Wayshrine Core

Core owns platform-independent rules and headless workflows. Creation Kit and
Foundry must use the same `CharacterCreator` and `Wizard`; their content adapters
and presentation live outside this package.

## Shared content access

`ContentCatalog` has two asynchronous operations:

- `list(kind)` returns lightweight `{ key, label }` entries.
- `get(kind, key)` returns one plain Core definition, or `undefined` for an absent
  key. Loading, access, malformed-content, and compatibility failures reject with
  `ContentError`.

Kinds currently supported are `race`, `skill`, `trait`, `birthsign`, and `power`. Keys are stable within
their kind. Host document IDs must never become Core content keys or rule inputs.

The host initializes one catalog instance per application runtime and supplies it
to its tools. Core does not initialize a global singleton or inspect host globals.
Catalog initialization failures should remain retryable. There are no production
adapters in Core.

Every catalog represents an immutable `{ schemaVersion, revision }`. The schema
version must match `CONTENT_SCHEMA_VERSION`. A creator pins the revision when it is
constructed and checks it before and after content reads. Adapters must also check
their response/pack revision; Core cannot detect a mismatched response if an adapter
silently reports the wrong metadata. Updating content means starting a new runtime
catalog and creator, not replacing definitions during an active session.

Adapters should deduplicate in-flight reads without retaining complete definition
catalogs. Browser HTTP caching and Foundry's own compendium retention belong to
their respective hosts; persistent browser storage is not required.

## Character creation

```ts
import { CharacterCreator } from "@wayshrine/core";
import type { ContentCatalog } from "@wayshrine/core";

function startCreator(catalog: ContentCatalog) {
  return new CharacterCreator(catalog);
}

async function selectAltmer(creator: CharacterCreator) {
  const race = await creator.chooseRace("altmer");
  if (!race.ok) return race;

  return creator.chooseRacialBonus("altmer/magical-training", ["alchemy"]);
}
```

`chooseRace()`, `chooseRacialBonus()`, and the asynchronous birthsign commands below
do content I/O. Name and characteristic-generation
commands, `getSnapshot()`, `getCharacterPreview()`, `next()`, `previous()`, and
`finish()` are synchronous and never fetch or roll dice.

The implemented Core steps are `race`, `characteristics`, then `birthsign`, identified by the public
`CharacterCreationStep` type. Next requires valid current and preceding steps; Back
retains answers. `finish()` requires all three steps valid even when called from race.
Invalidating a previous step blocks finish without changing the current step.
Finishing these steps is **not** full implementation of character creation.

Selecting a race loads its definition and, if needed, the lightweight skill index.
Every offered skill key must exist, including unselected options. Racial trait
definitions are loaded individually to validate references and parameters, then
released. The complete skill index is also released; the creator keeps only the
current race's offered summaries and reference-validation results.

Full skill definitions load only for submitted valid selections. The creator keeps
the selected race, selected skills, and its answers—not complete catalogs. Content
is detached from adapter-owned objects when read; snapshots, previews, results, and
issues are also detached from creator state.

### Editing and failures

- Choice groups each specify `choose`; `validateChoice` supplies shared mechanics.
- Racial skills grant only Novice training, deduplicating overlapping grants.
- Invalid or unresolved groups grant no effects. Invalid answers stay visible for
  correction. An invalid racial trait reference/parameter prevents all racial
  effects until the content is corrected in a new session.
- Selecting the same race preserves its answers without reloading. Changing race
  clears only race-owned answers. Generation drafts and the name survive race
  changes, retries, and cancellation.
- The latest command for a race or bonus group wins. Independent bonus groups can
  resolve concurrently. Obsolete completions return a `superseded` issue and cannot
  overwrite current answers or errors.
- `contentLoads` identifies pending or failed operations. Pending/failed required
  content blocks finishing. Resubmit the command to retry a loading failure.
- Unknown races and choices leave committed answers unchanged. Failed race loads
  also preserve the last committed answers, but suppress the preview while the
  requested change is unresolved. `cancelRaceSelection()` restores that committed
  preview. Reselecting the committed race also cancels the change.
- Starting a different race request invalidates pending bonus loads. If that race
  change is canceled, unresolved retained bonus answers need resubmission; resolved
  bonus answers remain usable.
- `dispose()` releases session-owned content and answers and invalidates pending
  commands. It does not dispose the host's shared catalog.

### Characteristic generation

The host obtains dice results (manual entry, a dice service, or host randomness).
Core enforces reroll policy but never generates randomness or requires a GM permission
gate. Supply identified rolls with their individual faces, not just totals. Each
2d10 submission needs a nonempty string ID and exactly two integer d10 faces
(1–10). Equal totals from distinct roll IDs are valid.

Both methods require exactly two distinct favored keys from `Characteristic`:
`str`, `end`, `ag`, `int`, `wp`, `prc`, `prs`. Luck is never favored or included in
the shared roll pool/point budget; submit its own 2d10 roll for either method.

#### Rolled flow

This example records results already supplied by the host. Assignments map each
characteristic to a **roll ID**, not a total or array position. Submit seven
distinct rolls and assign every roll exactly once.

```ts
import { CharacterCreator } from "@wayshrine/core";
import type { CharacteristicRoll } from "@wayshrine/core";

function submitRolled(creator: CharacterCreator) {
  const rolls: readonly CharacteristicRoll[] = [
    { id: "r1", dice: [4, 7] },
    { id: "r2", dice: [6, 5] },
    { id: "r3", dice: [10, 8] },
    { id: "r4", dice: [3, 9] },
    { id: "r5", dice: [7, 7] },
    { id: "r6", dice: [1, 6] },
    { id: "r7", dice: [8, 5] },
  ];
  creator.setFavoredCharacteristics(["str", "int"]);
  creator.setCharacteristicGenerationMethod("rolled");
  creator.submitCharacteristicRolls(rolls);
  creator.setCharacteristicAssignments({
    str: "r3",
    end: "r2",
    ag: "r1",
    int: "r5",
    wp: "r4",
    prc: "r7",
    prs: "r6",
  });
  creator.submitLuckRoll({ id: "luck-1", dice: [6, 8] });
  return creator.getSnapshot();
}
```

The first valid seven-result pool is accepted once. Invalid initial drafts remain
editable with `submitCharacteristicRolls`; after acceptance, that command rejects
every whole-pool resubmission without changing anything. Use selective rerolls:

```ts
import type { CharacterCreator } from "@wayshrine/core";

function rerollSelected(creator: CharacterCreator) {
  // The host acquires fresh dice and IDs; lower results are final too.
  const result = creator.rerollCharacteristics([
    { targetRollId: "r3", replacement: { id: "r8", dice: [1, 2] } },
    { targetRollId: "r5", replacement: { id: "r9", dice: [7, 7] } },
  ]);
  if (!result.ok) return result; // Structured issues; no state was changed.
  return creator.getSnapshot().characteristicGeneration;
}

function enableUnlimited(creator: CharacterCreator) {
  return creator.setUnlimitedCharacteristicRerolls(true);
}
```

Normally one batch of one to three results is allowed; unused slots are forfeited.
Unlimited defaults off and permits repeated batches of up to seven. **Every successful
pool batch spends the normal allowance**, even while unlimited is on; disabling unlimited
never restores it. Targets must be unique current shared-pool IDs, never Luck.
Replacement IDs must be distinct and cannot reuse any current pool ID, including
another selected target. Equal totals are allowed. Only selected results lose their
assignments; untouched results keep their order, IDs, dice, and assignments. Assigned
results may be rerolled. Rejections never change drafts, previews, or allowance.

`characteristicGeneration.rerolls` is a detached session-policy snapshot with
`unlimited`, `batchSpent`, `initialized`, `available`, and `maxBatchSize`. Availability
requires a live creator, rolled method, accepted initial pool, and an unspent batch
or unlimited mode. Maximum batch size is zero when unavailable, otherwise three or
seven. Policy survives method/race/navigation changes; a new creator starts fresh.
Luck replacement is independent and does not spend this allowance. After a valid
Luck roll is accepted, `submitLuckRoll` rejects replacements unless unlimited is
enabled, in either method. Rejection has `code: "reroll-unavailable"` and
`field: "luck"` and leaves the answer unchanged. Invalid initial Luck drafts remain
correctable without unlimited. Method changes retain the shared Luck answer.

To reroll selected pool results and Luck together, pass an optional Luck replacement
as `rerollCharacteristics(replacements, luckReplacement)`. Both groups are validated
before either changes; an invalid group rejects the whole command. Luck requires
unlimited and an existing Luck answer. The seven-result unlimited cap counts only
shared-pool replacements. `rerollCharacteristics([], luckReplacement)` rerolls only
Luck, works in either method without an initialized pool, and does not spend the
normal allowance. Omit the second argument to leave Luck unchanged.

#### Point-buy flow

Allocations map characteristic keys to **integer point amounts**, not roll IDs.
Explicitly allocate all seven keys, spending exactly 80 points with 0–20 per key.
Both methods store their non-Luck contribution in each characteristic's `rolled`
field; neither replaces the race's `baseline`.

```ts
import { CharacterCreator } from "@wayshrine/core";
import type { CharacteristicRoll } from "@wayshrine/core";

function submitPointBuy(creator: CharacterCreator, luck: CharacteristicRoll) {
  creator.setFavoredCharacteristics(["end", "wp"]);
  creator.setCharacteristicGenerationMethod("point-buy");
  creator.setCharacteristicAllocations({
    str: 20,
    end: 20,
    ag: 20,
    int: 10,
    wp: 10,
    prc: 0,
    prs: 0,
  });
  creator.submitLuckRoll(luck);
  return creator.getSnapshot();
}
```

#### Editing, validation, and previews

- Generation commands may run before choosing race or while content loads. A
  successful command validates only its submission, not the entire character.
  Invalid draft edits remain visible for correction. Selective rerolls and locked
  pool resubmissions instead reject atomically without retaining invalid edits.
- `setCharacteristicAssignments()` and `setCharacteristicAllocations()` replace
  whole maps, never merge. Partial maps are retained as incomplete drafts; `{}`
  clears a map. Initial pool submissions clear assignments until a valid pool is
  accepted; later pool resubmissions are rejected. Replacing Luck affects only Luck.
- Rolled and point-buy drafts are retained separately. Favored selections and Luck
  are common. Switching method preserves both drafts; editing an inactive draft
  does not activate it or affect the preview.
- Generation command issues concern only the edited field. For example, valid rolls
  can return `ok: true` while assignments remain missing. Issues have `code` and
  `message`, with optional `field`, `rollId`, and `characteristic` targets; hosts
  should not parse message text.
- `snapshot.characteristicGeneration` contains detached `drafts`, the active
  `answer`, full active `issues`, `complete`, and session-only `rerolls`. Reroll command
  rejections are not persistent answer-validation issues. The characteristics step has an
  empty `pendingChoices`; use the dedicated section for its inputs and details.
  Top-level wizard issues describe the current step, not every step.
- Preview groups are independent: valid favored selections grant flags; a fully
  valid active method grants **all seven** non-Luck contributions atomically; a
  valid Luck roll grants only its dice total. An invalid group contributes nothing,
  removing its previous effects without hiding other valid groups.
- Generation effects apply only with a usable committed race. A pending/failed race
  change or invalid global race reference suppresses those effects too. Cancel
  restores retained answers; a successful change recalculates against the new
  racial baselines. An invalid individual racial bonus suppresses only that bonus.
- Luck always has `baseline: 30`. Its `rolled` field is the valid 2d10 total (2–20),
  so baseline plus generation is 32–50, capped at 50 by the dice limits. Missing or
  invalid Luck contributes zero, not an additional 30.
- Public `validateCharacteristicGeneration(answer)` returns all answer issues.
  `calculateCharacteristicGeneration(answer)` is strict: incomplete or invalid
  answers return issues, never a partial calculation. Hosts ordinarily use creator
  previews for independent valid-group effects. Inputs, snapshots, and results are
  detached; mutate them only to prepare a new command submission.

See [generation engineering notes](../docs/development/characteristic-generation.md)
for module boundaries and consumer integration considerations.

### Headless birthsign selection

Birthsign selection is the third headless wizard step. Commands can also be used
before navigating there. Creation Kit does not yet provide a birthsign editor.

```ts
import type { CharacterCreator } from "@wayshrine/core";

async function selectBirthsign(creator: CharacterCreator) {
  // Host-acquired complete sequence: fives mark Star-Cursed; 1–4 ends the roll.
  const rolled = await creator.submitBirthsignRoll({
    id: "birthsign-1",
    charge: "warrior",
    dice: [5, 5, 2],
  });
  if (!rolled.ok) return rolled;
  await creator.chooseBirthsign({ signKey: "theMage", variant: "starCursed" });
  const choice = creator
    .getSnapshot()
    .birthsignSelection.choices.find(
      (choice) => choice.lifecycle.selection === "once",
    );
  if (choice) creator.chooseBirthsignBonus(choice.choiceGroup.id, ["prc"]);
  return creator.restoreOriginalBirthsign();
}
```

- `submitBirthsignRoll` accepts one complete identified sequence, with any number of
  initial fives followed by exactly one face 1–4. Incomplete, invalid, and trailing
  results reject atomically. Core never acquires dice. Accepted history locks before
  content loading, including on failure or cancellation. Every later whole-roll
  submission rejects, even a retry with the same ID or a different charge. Retry
  content with `restoreOriginalBirthsign()` or `chooseBirthsign()`, not fresh dice.
- Without a committed selection the original becomes the default selection once
  its content resolves. A committed pre-roll alternative stays selected. The
  original history/result always remains independent, including in free-choice mode.
- `chooseBirthsign` works before or after rolling. It loads and validates only the
  requested definition and its trait/power references (including all choice branches).
  Browse summaries with the host catalog; use `quoteBirthsign` for candidate rules
  without selecting anything.
- Standard costs are derived: original exact sign/variant 0 Luck, an upgrade of a
  naturally normal original 5, another normal sign 5, another Star-Cursed sign 10.
  The restricted Star-Cursed Thief cannot be purchased from another natural sign,
  but **a naturally normal Thief can upgrade for the usual 5 Luck**. A naturally
  Star-Cursed Thief restores at 0. Restrictions are metadata-driven, not key checks.
- `setFreeBirthsignChoice(true)` makes all purchase costs 0, including Star-Cursed
  Thief. Returning to standard preserves the selected answer and original, rechecks
  eligibility, and derives the standard cost. An ineligible retained answer exposes
  `eligibilityIssues` and an undefined cost, rather than silently replacing it.
- `snapshot.birthsignSelection` contains detached history, committed selection and
  definition, derived acquisition method/cost, eligibility issues, and a pending/failed
  `load`, plus offered `choices`, retained `answers`, full `issues`, and selection
  `complete`. Costs never mutate generation answers or accumulate across commands.
  Free purchase costs do not remove inherent effects.
- Latest selection intent wins; failed loads retain committed answers. Call
  `cancelBirthsignSelection()` to clear pending/failed intent. Reselecting the
  committed answer also cancels. Mode changes are evaluated at async commit time.
  Disposal clears birthsign state and invalidates outstanding completions. Pending
  birthsign operations do not interfere with race or generation operations.

`chooseBirthsignBonus(choiceId, selections)` synchronously replaces a required
one-time group's selections. Use the IDs and option IDs offered in the snapshot.
Counts, duplicates, and unknown options are validated by Core; invalid answers stay
visible but grant nothing. Revisiting a sign or variant retains its answers. Only
currently active groups validate: replacement variants omit base groups, while
additive variants include both. Recurring Ritual choices are descriptive metadata,
never editable here, never creation blockers, and grant no selected recurring powers.

#### Candidate quotes

```ts
const result = await creator.quoteBirthsign({
  signKey: "theRitual",
  variant: "starCursed",
});
if (result.ok) {
  const quote = result.value;
  // Render price, eligibilityIssues, choices, affordability, and missingInputs.
  // To inspect a once choice, quote again with explicit provisional answers:
  const choice = quote.choices.find(
    (entry) => entry.lifecycle.selection === "once",
  );
  if (choice) {
    await creator.quoteBirthsign(quote.selection, [
      {
        choiceId: choice.choiceGroup.id,
        selections: [choice.choiceGroup.options[0]!.id],
      },
    ]);
  }
}
```

`quoteBirthsign(selection, provisionalAnswers = [])` uses **only** those provisional
answers, never retained creator answers. It returns a detached `BirthsignQuoteResult`:
content/technical failures have `ok: false` and structured issues; a loaded quote has
`ok: true` even when ineligible, incomplete, or unaffordable. Quotes expose the
definition, eligibility, price/acquisition method, offered choices (including recurring
metadata), provisional answers, strict `effectivePackage`, issues and missing inputs.
Invalid/unresolved once answers withhold the entire package and numeric Luck totals,
but not the offered choices or known price. Recurring selections grant no effects.

`luckBeforePurchase` includes candidate innate modifiers and rolled replacements,
not the currently selected birthsign. `finalLuck` additionally deducts this candidate's
purchase cost. Numeric fields are plain numbers or `undefined`, never fabricated
totals when inputs are unavailable. A usable race and valid generation Luck are
required for either Luck total; eligibility must also resolve the cost for final Luck.
`affordability` is `affordable`, `unaffordable`, or `pending`; `missingInputs` identifies
`race`, `luck`, `choices`, or `eligibility`. Zero-cost original/free candidates are
affordable without imposing a minimum Luck, even if their totals remain unresolved.
Eligibility and choice validity remain independent requirements.

Each quote evaluates current original history, mode, race and generation together
at completion after pinned content/reference validation. It changes no creator state,
load, choices, history, wizard issues or preview; it never spends/reserves Luck or
cancels a selection/roll. Concurrent quotes complete independently. The UI owns
loading and latest-candidate presentation. Disposal invalidates pending quotes.
A quote is an observation, not a token: `chooseBirthsign` always revalidates current
state, and once answers still use `chooseBirthsignBonus` after selection.

Preview reconstruction applies the **entire** valid birthsign package atomically,
including its purchase deduction. Pending/failed content, ineligibility, unresolved
one-time choices, or unresolved/failed affordability withhold all birthsign effects
and cost. Race and independently valid generation groups keep their existing rules.
Changing selections removes the previous package; restoring the original costs zero.

Purchases require final Luck after both the purchase deduction and inherent effects
to be at least zero; exactly zero is allowed. Star-Cursed Ritual therefore consumes
15 Luck (10 purchase plus its inherent -5). A resolved unaffordable async selection
rejects before commitment, using current mode and generation at completion. Purchases
selected before a usable race and valid Luck answer expose `affordability-pending`,
not an invented final score. Earlier edits revalidate retained answers and can
withhold their package and block finish. No unrelated minimum Luck is imposed on
free or naturally rolled selections.

`calculateBirthsignPackage({ selection, definition, answers })` is a pure strict
calculator returning grants and aggregated adjustment inputs, or choice issues.
It does not load content, enforce purchase eligibility, or mutate generation drafts.
Creator previews attach `birthsign` (sign and variant), sourced characteristic
`modifiers`, a separate positive Luck `purchaseCost`, birthsign-origin traits, and
display-only typed `powers`. `birthsignAdjustments` contains `spMaximum`/`speed`
modifiers, `naturalHealingMultiplier`, and `extraLuckyNumbers` entitlements retained
regardless of Luck. It does not invent base attribute formulas or generate lucky
numbers. Star-Cursed Thief replaces only projected **rolled** Luck with 50, not its
baseline or final total; the original generation answer is preserved for restoration.

`calculateCharacteristicScore(data)` calculates baseline + rolled + explicit
modifiers - purchase cost, and its tens-digit bonus. Favored flags add no implicit
numeric effect. Calculated outcomes remain separate from stored/generated inputs.
Generation-only draft displays should pass just `{ baseline, rolled }` to keep
their arithmetic independent of final package modifiers and purchase costs.

The wizard's birthsign step requires valid preceding steps as well as a complete
selection. Next/Back retain all answers; finish validates every registered step
regardless of current position. Power activation, race power integration, recurring
gameplay selections, and the React birthsign editor are not implemented.

## Content validation

`parseContentDefinition(kind, key, value)` validates external definitions with Zod,
checks skill-key consistency, and returns detached data. Definition schemas reject
unknown fields, including host metadata. `validateRaceContent` performs pure choice
and reference checks using caller-supplied skill keys and trait definitions.

`birthsignSchema` is shared by runtime parsing and the build-only localization
compiler. It validates effect targets, positive integer choice counts, distinct
group/option IDs, non-nested choices, lifecycle boundaries, and eligibility flags.
`validateBirthsignContent(sign, traits, powerKeys)` checks references and exact trait
parameter names in normal, Star-Cursed, and every choice branch. Mechanical bonuses
remain authoritative; descriptions are not interpreted as rules.

Use `catalog.list("birthsign")` / `catalog.get("birthsign", "theRitual")` to browse
signs, and `catalog.get("power", "blessedTouch")` to read power prose. `Power` has
only `label` and `description`; activation, tracking, and racial grants are not
modeled. Birthsign `description` contains introductory lore; optional
`starCursed.description` and `choiceGroup.prompt` hold variant/selection explanation.
Option IDs remain characteristic or power keys; consumers reuse their existing
labels rather than maintaining birthsign-specific copies.

`BIRTHSIGN_CHARGE_TABLES` exposes the ordered Warrior, Mage, and Thief tables.
The four `entries` correspond to results 1–4; `fifthResult: "rerollStarCursed"`
is an instruction, not a sign. `validateBirthsignChargeTables(signKeys)` checks
their references during publishing. These declarations do not resolve rolls,
apply effects or edit recurring Ritual selections. `CharacterCreator` resolves
host-supplied rolls using these tables through its headless selection commands.
The Thief metadata retains the natural-sign restriction; the creator explicitly
allows its normal-original upgrade at the standard 5 Luck cost.

Skill definitions either supply governing characteristic keys or explicitly allow
a player-selected characteristic. Custom names and chosen characteristics belong
to `SkillTraining`, not the shared definition. Optional skill display text can be
resolved by the host; browsing labels may fall back to content keys.

YAML under `content/` remains the authoring source. Its top-level map keys identify
definitions. Creation Kit's build-time compiler derives `skillKey` from that key
and rejects contradictory authored values. It validates definitions, birthsign tables, and race/birthsign
references with these shared Core validators before publishing static JSON.
YAML parsing stays in host build scripts and tests, never in Core runtime code.
See the root README for artifact generation, layout, and Creation Kit's browser
catalog adapter. Version-specific Foundry pack generation is not implemented yet.

## Checks

Run `pnpm --filter @wayshrine/core test` for compile-time checks and runtime tests,
including validation of the actual YAML catalogs and their race references.
Node/test-runner types stay isolated from Core's platform-independent source check.
