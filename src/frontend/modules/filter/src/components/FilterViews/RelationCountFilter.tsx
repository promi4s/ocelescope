import { Group, NumberInput, Text } from "@mantine/core";
import {
  type RelationCountSummary,
  useE2o,
  useO2o,
} from "@ocelescope/api-base";
import { DataTable } from "mantine-datatable";
import { Controller } from "react-hook-form";
import { useDatatable } from "../../hooks/useDatatable";
import { useFilterColumns } from "../../hooks/useFilterColumn";
import type { FilterView, FilterViewType } from "../../types/filter";

const RelationCountFilter: (
  relationType: "e2o" | "o2o",
) => FilterView<"e2o_count" | "o2o_count"> =
  (relationType) =>
  ({ ocelId, control }) => {
    const isE2O = relationType === "e2o";

    const { data: relationSummary, isLoading } = (isE2O ? useE2o : useO2o)(
      ocelId,
      {
        ocel_version: "original",
      },
    );

    const { records, columns, tableProps } = useDatatable({
      data: relationSummary,
      columnNames: ["source", "qualifier", "target"],
      defaultSorted: "source",
    });

    const { filterColumns } = useFilterColumns({
      control,
      path: isE2O ? "e2o_count" : "o2o_count",
      generateFilterId: ({ source, target, qualifier }) =>
        `${source}-${qualifier}-${target}`,
      generateRecordId: ({ source, target, qualifier }) =>
        `${source}-${qualifier}-${target}`,
      generateInitialFilter: (record: RelationCountSummary) => ({
        type: isE2O ? ("e2o_count" as const) : ("o2o_count" as const),
        source: record.source,
        target: record.target,
        qualifier: record.qualifier,
        range: [record.min_count, record.max_count] as [number, number],
      }),
      FilterComponent: ({ control, path, record }) => {
        return (
          <Controller
            control={control}
            name={`${path}.range`}
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
                    onChange={(nextMin) => {
                      field.onChange([nextMin, currentMax]);
                    }}
                    allowDecimal={false}
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
    });

    return (
      <DataTable
        records={records}
        columns={[...columns, ...filterColumns]}
        minHeight={500}
        withTableBorder
        noRecordsText="No relations to filter"
        {...tableProps}
        fetching={isLoading}
      />
    );
  };

export const E2OCountFilter: FilterViewType<"e2o_count"> = {
  title: "E2O Count",
  ViewComponent: RelationCountFilter("e2o"),
  generateDefault: () => [],
};

export const O2OCountFilter: FilterViewType<"o2o_count"> = {
  title: "O2O Count",
  ViewComponent: RelationCountFilter("o2o"),
  generateDefault: () => [],
};
