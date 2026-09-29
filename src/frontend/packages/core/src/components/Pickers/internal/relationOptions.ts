import type { RelationCountSummary } from "@ocelescope/api-base";
import type { Relation } from "../types";
import type { PickerOption } from "./options";

export const relationId = (relation: Relation) =>
  JSON.stringify([relation.source, relation.target, relation.qualifier]);

export const relationLabel = (relation: Relation) =>
  relation.qualifier
    ? `${relation.target} · ${relation.qualifier}`
    : relation.target;

/**
 * Rows of the E2O or O2O endpoint as options: one per target type and
 * qualifier, counted by how many relations there are. Grouped by source
 * unless the picker is narrowed to one.
 */
export const relationOptions = ({
  rows,
  source,
  unit,
  sourceColor,
  targetColor,
}: {
  rows: readonly RelationCountSummary[];
  /** The one source the picker is narrowed to, if any. */
  source: string | undefined;
  /** What the source is, for the counts: "event" or "object". */
  unit: string;
  sourceColor: (name: string) => string;
  targetColor: (name: string) => string;
}): PickerOption<Relation>[] =>
  rows
    .filter((row) => source === undefined || row.source === source)
    .map((row) => {
      const relation = {
        source: row.source,
        target: row.target,
        qualifier: row.qualifier,
      };
      const perSource =
        row.min_count === row.max_count
          ? `${row.min_count}`
          : `${row.min_count}–${row.max_count}`;
      return {
        value: relation,
        label: relationLabel(relation),
        description: `${perSource} per ${unit}`,
        count: row.sum,
        color: targetColor(row.target),
        group:
          source === undefined
            ? { label: row.source, color: sourceColor(row.source) }
            : undefined,
      };
    });
