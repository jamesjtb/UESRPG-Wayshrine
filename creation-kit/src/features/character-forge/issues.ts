import type { WizardIssue } from "@wayshrine/core";

const blockingCodes = new Set([
  "content-unavailable",
  "content-access-denied",
  "invalid-content",
  "incompatible-content",
  "content-version-mismatch",
  "invalid-choice-definition",
  "invalid-race-definition",
  "unknown-race",
  "unknown-choice",
]);

export function isBlockingContentIssue(issue: WizardIssue): boolean {
  return blockingCodes.has(issue.code);
}
