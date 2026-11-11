# Birthsign selection engineering notes

For command usage and selection costs, see the
[Core contract](../../core/README.md#headless-birthsign-selection).

`BirthsignSelectionSession` is feature-owned headless state composed by
`CharacterCreator`. Public domain types live in
`core/interface/character/BirthsignSelection.ts`. The helper shares the creator's
pinned `ContentReader`; it does not own a second catalog or cache. Only the committed
birthsign definition is retained. Reference definitions are loaded individually,
validated across all branches, and released. Snapshot definitions are detached with
the shared schema, as are history, answers, loading state and issues.

## History and asynchronous intent

The roll API is atomic, not incremental. Hosts acquire all dice first, including
repeated fives, and submit a complete sequence. Acquisition failures before submission
leave Core unchanged. Invalid sequences never become drafts. A valid sequence commits
its immutable original and locks rerolling synchronously before the first await.
Content failure, supersession and cancellation cannot unlock or duplicate that roll.
An ID identifies the sequence for provenance, not a retry authorization token.

Submitting the first roll retains a committed pre-roll selection, or requests the
original when none exists. This is a new selection intent and supersedes any older
pending selection. Hosts can explicitly choose again while it loads. Request identity
checks prevent stale reads (including failed reference reads) from publishing answers
or load failures. Cancellation clears only requested intent; committed content,
selection, and original history survive. Disposal clears all state and invalidates
every pending command. Race/generation state has an independent lifetime and request
space within the same creator.

Mode changes do not invalidate a pending read: permission is evaluated against the
current mode and immutable original at commit. Turning free choice off retains an
already committed but newly ineligible selection, with structured eligibility issues
and no purchasable cost. Hosts must not interpret an undefined cost as zero.

## Rule boundary

Pricing and provenance are derived from current mode, committed selection and original,
never stored as accumulated deductions. Exact original equality takes precedence over
free-choice/purchase provenance. Upgrade eligibility is derived from a naturally normal
original of the same sign. The explicit upgrade exception applies to restricted
Star-Cursed metadata without hardcoding a sign key; unrelated-sign purchases still obey
that metadata. Table keys and ordering come only from the shared charge tables.

Hosts browse catalog content independently rather than mutating selection to inspect it.

## Choices and effective packages

`birthsignPackage.ts` is the pure rule boundary for active bonuses, once-choice
validation, and effective-package calculation. Additive variants include base and
Star-Cursed bonuses; replacements omit the base entirely. Required groups use the
shared primitive-key choice validator. IDs are encoded sign/group pairs, preserving
answers across variant changes without conflating signs. Inactive answers are retained
but never validated or applied. Recurring choices remain detached descriptive metadata;
the creation command cannot edit them and they grant no transient gameplay effects.

The calculator returns a fresh package only when every active once group is valid.
It produces explicit characteristic modifiers, rolled-component replacements, typed
trait/power grants, attribute adjustment inputs, healing multipliers and lucky-number
entitlements. It does not load content, mutate drafts, or calculate missing base
attributes. Stable source IDs identify sign, base/Star-Cursed branch, effect position
and selected option. Trait grants with different parameter values retain distinct
source identities, including when a racial grant uses the same trait key.

`CharacterCreator` reconstructs the character from scratch, then projects one valid
package. Purchase cost is a separate positive Luck deduction, not an inherent modifier
or a mutation of the generation answer. `calculateCharacteristicScore` applies both
explicit modifiers and purchase deductions, so effective scores cannot silently omit
birthsign effects. Draft-only generation displays explicitly supply baseline and their
draft rolled contribution instead. Star-Cursed Thief replaces the preview's rolled
Luck with 50 while leaving baseline 30 and the accepted generation roll unchanged.

## Context validation and atomic projection

The selection session owns content, intent, retained choice answers and pricing. Its
creator-supplied context evaluator checks purchases using the same pure package and
score calculators as projection, with current usable race and valid Luck contribution.
Other generation groups remain independently valid or invalid; missing Luck is not
substituted with a fabricated final score. A pending context exposes
`affordability-pending`. Final Luck below zero rejects a resolved purchase before
async commitment; exactly zero is legal. Required unresolved choices defer that check,
then resolving them persistently validates the retained answer. Generation/race/mode
edits also revalidate without incremental cost accumulation or lost rolls.

Projection withholds the entire birthsign package, including cost, for unresolved
choices, unavailable content, ineligibility, or affordability issues. It never grants
benefits while waiting for penalties. Zero-cost original/free selections do not impose
a new negative-Luck prohibition; free choice removes purchase deductions only.

The Core wizard registers `birthsign` after `characteristics`; its evaluator includes
earlier-step validity, and the generic wizard enforces all-step finish guards from any
position. Back retains choices and generation. Selection completeness in its dedicated
snapshot describes selection/context validity; wizard step completeness also includes
the preceding steps. Creation Kit has no birthsign editor yet: Core may advance to the
new step, but browser presentation is an intermediate integration checkpoint, not a
complete creation workflow. Do not remap the new step to an old editor or skip its guards.
