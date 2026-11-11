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

Only `chooseRace()` and `chooseRacialBonus()` do content I/O. Name and generation
commands, `getSnapshot()`, `getCharacterPreview()`, `next()`, `previous()`, and
`finish()` are synchronous and never fetch or roll dice.

The implemented steps are `race` then `characteristics`, identified by the public
`CharacterCreationStep` type. Next requires valid current and preceding steps; Back
retains answers. `finish()` requires both steps valid even when called from race.
Invalidating a previous step blocks finish without changing the current step.
Finishing these two steps is **not** full implementation of character creation.

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
apply effects, edit recurring Ritual selections, or extend `CharacterCreator`.
The Thief eligibility metadata retains the naturally-rolled-sign restriction;
it is not a new creator selection policy.

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
