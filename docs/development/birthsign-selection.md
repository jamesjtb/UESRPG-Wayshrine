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

This module deliberately does not register a wizard step, change finish guards, resolve
one-time/recurring choices, project effects or apply purchase costs. Final-Luck
affordability remains unresolved until effect integration; this layer establishes no
minimum-Luck or negative-score rule. Hosts browse catalog content independently rather
than mutating selection to inspect it.
