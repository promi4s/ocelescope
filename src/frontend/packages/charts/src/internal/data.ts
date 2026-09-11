import type { Column, Primitive, Row } from "../types";

/**
 * Every reshaping step a chart needs lives here, so feature modules never write
 * one again. All functions are pure and return new arrays.
 */

export const toNumber = (value: Primitive): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toLabel = (value: Primitive): string =>
  value == null ? "" : String(value);

import type { SortDirection } from "../types";

/** Sort by a column. Numeric when the column holds numbers, else by label. */
export const sortRows = (
  rows: Row[],
  column: Column,
  direction: SortDirection = "desc",
): Row[] => {
  if (direction === "none") return rows;
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (typeof left === "number" || typeof right === "number") {
      return (toNumber(left) - toNumber(right)) * factor;
    }
    return toLabel(left).localeCompare(toLabel(right)) * factor;
  });
};

/** Row-wise total across the given columns. */
export const rowTotal = (row: Row, columns: string[]): number =>
  columns.reduce((sum, column) => sum + toNumber(row[column]), 0);
