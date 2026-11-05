import type { ReactNode } from "react";
import { IconChevronDown } from "@tabler/icons-react";

/** Decorative affordances belong only inside an actual menu trigger. */
export function ContributionMenuValue({ value }: { value: ReactNode }) {
  if (value === "—")
    return <IconChevronDown size={16} aria-hidden focusable="false" />;
  return <span>{value}</span>;
}
