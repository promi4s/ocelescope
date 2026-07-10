import { ActionIcon, Group, NumberInput, Switch, Text } from "@mantine/core";
import type { RelationCountSummary } from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import type { DataTableColumn } from "mantine-datatable";
import { useMemo, useState } from "react";
import { type Control, Controller, useFieldArray } from "react-hook-form";
import type { GroupedFilter } from "../types/filter";

type RelationCountPath = "e2o_count" | "o2o_count";

type RelationCountFilter = GroupedFilter["e2o_count"][number];

const filterKey = ({
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

type UseRelationCountFilterProps<K extends RelationCountPath> = {
  control: Control<GroupedFilter>;
  path: K;
};

export const useRelationCountFilter = <K extends RelationCountPath>({
  path,
  control,
}: UseRelationCountFilterProps<K>) => {
  const { fields, append, remove } = useFieldArray<GroupedFilter, K>({
    name: path,
    control,
  });

  const filterIndexMap = useMemo(() => {
    const map = new Map<string, number>();

    fields.forEach((field, index) => {
      map.set(filterKey(field as unknown as RelationCountFilter), index);
    });

    return map;
  }, [fields]);

  const [showOnlyFiltered, setShowOnlyFiltered] = useState(false);

  const visibleRelations = useMemo(() => {
    const seen = new Set<string>();
    const relations: { source: string; target: string }[] = [];

    fields.forEach((field) => {
      const { source, target } = field as unknown as RelationCountFilter;
      const key = `${source}-${target}`;
      if (!seen.has(key)) {
        seen.add(key);
        relations.push({ source, target });
      }
    });

    return relations;
  }, [fields]);

  const filterColumns = useMemo<DataTableColumn<RelationCountSummary>[]>(
    () => [
      {
        accessor: "filter",
        title: "Filter",
        filter: () => (
          <Switch
            label="Show only filtered relations"
            checked={showOnlyFiltered}
            onChange={(event) =>
              setShowOnlyFiltered(event.currentTarget.checked)
            }
          />
        ),
        filtering: showOnlyFiltered,
        render: (record) => {
          const qualifier = resolveQualifier(record);

          const filterIndex =
            filterIndexMap.get(filterKey({ ...record, qualifier })) ?? -1;

          if (filterIndex < 0) {
            return (
              <Text size="sm" c="dimmed">
                No filter applied
              </Text>
            );
          }

          return (
            <Controller
              control={control}
              name={`${path}.${filterIndex}.range`}
              render={({ field }) => {
                const currentMin =
                  typeof field.value?.[0] === "number"
                    ? field.value[0]
                    : undefined;
                const currentMax =
                  typeof field.value?.[1] === "number"
                    ? field.value[1]
                    : undefined;

                return (
                  <Group wrap="nowrap" align="end" gap="xs">
                    <NumberInput
                      value={currentMin}
                      min={record.min_count}
                      max={currentMax ?? record.max_count}
                      clampBehavior="strict"
                      allowDecimal={false}
                      onChange={(nextMin) => {
                        field.onChange([nextMin, currentMax]);
                      }}
                      style={{ flex: 1 }}
                    />

                    <Text c="dimmed" size="sm" pb={8}>
                      -
                    </Text>

                    <NumberInput
                      value={currentMax}
                      min={currentMin ?? record.min_count}
                      max={record.max_count}
                      clampBehavior="strict"
                      allowDecimal={false}
                      onChange={(nextMax) => {
                        field.onChange([currentMin, nextMax]);
                      }}
                      style={{ flex: 1 }}
                    />
                  </Group>
                );
              }}
            />
          );
        },
      },
      {
        accessor: "action",
        title: "",
        width: "50px",
        render: (record) => {
          const qualifier = resolveQualifier(record);

          const filterIndex =
            filterIndexMap.get(filterKey({ ...record, qualifier })) ?? -1;

          return filterIndex < 0 ? (
            <ActionIcon
              color="green"
              variant="light"
              onClick={(event) => {
                event.stopPropagation();
                append({
                  type: path,
                  source: record.source,
                  target: record.target,
                  qualifier,
                  range: [record.min_count, record.max_count],
                } as Parameters<typeof append>[0]);
              }}
            >
              <PlusIcon size={16} />
            </ActionIcon>
          ) : (
            <ActionIcon
              color="red"
              variant="light"
              onClick={(event) => {
                event.stopPropagation();
                remove(filterIndex);
              }}
            >
              <XIcon size={16} />
            </ActionIcon>
          );
        },
      },
    ],
    [append, remove, filterIndexMap, path, control, showOnlyFiltered],
  );

  return {
    filterColumns,
    visibleRelations: showOnlyFiltered ? visibleRelations : undefined,
  };
};
