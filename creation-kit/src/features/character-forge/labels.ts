export function readableLabel(key: string, label?: string): string {
  if (label && !label.includes("{LOCALE")) return label;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function plainDescription(description: string): string | undefined {
  if (description.includes("{LOCALE")) return undefined;
  return description || undefined;
}
