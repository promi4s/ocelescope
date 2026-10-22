import { Button, Group, NumberInput, Switch, Text } from "@mantine/core";
import type { RelationCountSummary } from "@ocelescope/api-base";
import { CheckIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import type { FilterOf } from "../types/filter";

type RelationCountFilter = FilterOf<"e2o_count" | "o2o_count">;

const relationKey = ({
  source,
  target,
  qualifier,
}: {
  source: string;
  target: string;
  qualifier?: string | null;
}) => `${source}-${qualifier ?? ""}-${target}`;

const resolveQualifier = (record: RelationCountSummary): string | undefined =>
  record.qualifiers?.length === 1 ? record.qualifiers[0] : undefined;

type UseRelationCountFilterProps = {
  filter: RelationCountFilter;
  onChange: (filter: RelationCountFilter) => void;
};

export const useRelationCountFilter = ({
  filter,
  onChange,
}: UseRelationCountFilterProps) => {
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const selectedKey = filter.source ? relationKey(filter) : undefined;

  const filterColumns = useMemo<DataTableColumn<RelationCountSummary>[]>(
    () => [
      {
        accessor: "filter",
        title: "Count range",
        filter: () => (
          <Switch
            label="Show only the selected relation"
            checked={showOnlySelected}
            onChange={(event) =>
              setShowOnlySelected(event.currentTarget.checked)
            }
          />
        ),
        filtering: showOnlySelected,
        render: (record) => {
          const isSelected =
            relationKey({ ...record, qualifier: resolveQualifier(record) }) ===
            selectedKey;

          if (!isSelected) {
            return (
              <Text size="sm" c="dimmed">
                {record.min_count} - {record.max_count}
              </Text>
            );
          }

          const [currentMin, currentMax] = filter.range;
          return (
            <Group wrap="nowrap" align="end" gap="xs">
              <NumberInput
                value={currentMin ?? undefined}
                min={record.min_count}
                max={currentMax ?? record.max_count}
                clampBehavior="strict"
                allowDecimal={false}
                onChange={(next) =>
                  onChange({
                    ...filter,
                    range: [typeof next === "number" ? next : null, currentMax],
                  })
                }
                style={{ flex: 1 }}
              />
              <Text c="dimmed" size="sm" pb={8}>
                -
              </Text>
              <NumberInput
                value={currentMax ?? undefined}
                min={currentMin ?? record.min_count}
                max={record.max_count}
                clampBehavior="strict"
                allowDecimal={false}
                onChange={(next) =>
                  onChange({
                    ...filter,
                    range: [currentMin, typeof next === "number" ? next : null],
                  })
                }
                style={{ flex: 1 }}
              />
            </Group>
          );
        },
      },
      {
        accessor: "action",
        title: "",
        width: "90px",
        render: (record) => {
          const qualifier = resolveQualifier(record);
          const isSelected =
            relationKey({ ...record, qualifier }) === selectedKey;

          return isSelected ? (
            <Button
              size="compact-sm"
              variant="light"
              color="green"
              leftSection={<CheckIcon size={14} />}
            >
              Used
            </Button>
          ) : (
            <Button
              size="compact-sm"
              variant="default"
              onClick={(event) => {
                event.stopPropagation();
                onChange({
                  type: filter.type,
                  source: record.source,
                  target: record.target,
                  qualifier,
                  range: [record.min_count, record.max_count],
                } as RelationCountFilter);
              }}
            >
              Use
            </Button>
          );
        },
      },
    ],
    [filter, onChange, selectedKey, showOnlySelected],
  );

  return {
    filterColumns,
    visibleRelations:
      showOnlySelected && filter.source
        ? [{ source: filter.source, target: filter.target }]
        : undefined,
  };
};
