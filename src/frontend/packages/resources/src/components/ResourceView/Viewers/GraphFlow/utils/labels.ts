export const hasMarking = (
  label: string | null | undefined,
  marking: "m0=" | "mf=",
): boolean => label?.includes(marking) ?? false;

export const parseObjectType = (
  label: string | null | undefined,
): string | null => {
  if (!label) return null;
  return label.split(" | ")[0]?.trim() || null;
};
