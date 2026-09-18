export function formatDisplayLabel(value: string): string {
  const spaced = value.replaceAll("_", " ");
  if (!spaced) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatParamLabel(name: string): string {
  return formatDisplayLabel(name);
}
