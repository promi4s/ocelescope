export const parseObjectType = (
  label: string | null | undefined,
): string | null => {
  if (!label) return null;
  return label.trim() || null;
};
