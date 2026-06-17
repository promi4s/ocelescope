export const sortRecords = <T extends Record<string, any>>(
  records: T[],
  accessor: keyof T,
  direction: "asc" | "desc",
) => {
  return [...records].sort((a, b) => {
    const aValue = a[accessor];
    const bValue = b[accessor];

    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return direction === "asc" ? -1 : 1;
    if (bValue == null) return direction === "asc" ? 1 : -1;

    if (typeof aValue === "number" && typeof bValue === "number") {
      return direction === "asc" ? aValue - bValue : bValue - aValue;
    }

    const result = String(aValue).localeCompare(String(bValue), undefined, {
      numeric: true,
      sensitivity: "base",
    });

    return direction === "asc" ? result : -result;
  });
};
