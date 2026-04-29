export const colorToId = (color: string): string =>
  color.replace(/[^a-zA-Z0-9]/g, "");

export const darkenHex = (hex: string, amount = 40): string => {
  const normalized = hex.replace("#", "");
  const parsed = Number.parseInt(normalized, 16);

  if (!Number.isFinite(parsed)) return hex;

  const r = Math.max(0, (parsed >> 16) - amount);
  const g = Math.max(0, ((parsed >> 8) & 0xff) - amount);
  const b = Math.max(0, (parsed & 0xff) - amount);

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
};
