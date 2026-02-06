import {
  Button,
  Grid,
  Group,
  Paper,
  RangeSlider,
  Select,
  Stack,
} from "@mantine/core";
import { memo, useMemo } from "react";
import { PlusIcon, X } from "lucide-react";
import type { OCELFilter, RelationCountSummary } from "@/api/fastapi-schemas";
import { useE2o, useO2o } from "@/api/fastapi/ocels/ocels";
import {
  type Control,
  Controller,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import type { FilterType } from "@/types/filters";
import type { FilterPageComponentProps } from "..";

const RelationFilter: React.FC<{
  soureRelations?: RelationCountSummary[];
  targetRelations?: RelationCountSummary[];
  control: Control<OCELFilter>;
  relationType: Extract<FilterType, "o2o_count" | "e2o_count">;

  index: number;
  remove: () => void;
}> = memo(
  ({
    control,
    index,
    relationType,
    soureRelations,
    targetRelations,
    remove,
  }) => {
    const relationConfig = useWatch({
      control: control,
      name: `${relationType}.${index}`,
    });

    const { qualifierNames, sourceNames, targetNames, min, max } =
      useMemo(() => {
        if (!soureRelations || !targetRelations) {
          return {
            sourceNames: [],
            targetNames: [],
            min: 0,
            max: 0,
          };
        }
        const relations =
          relationConfig?.direction === "target"
            ? targetRelations.map(({ target, source, ...rest }) => ({
                source: target,
                target: source,
                ...rest,
              }))
            : soureRelations;

        const filteredRelations = relations.filter(
          ({ source, target, qualifier, max_count, min_count }) =>
            min_count < max_count &&
            (relationConfig?.source === "" ||
              relationConfig?.source === source) &&
            (!relationConfig?.qualifier ||
              relationConfig?.qualifier === qualifier) &&
            (relationConfig?.target === "" ||
              relationConfig?.target === target),
        );

        const sourceNames = Array.from(
          new Set(filteredRelations.map(({ source }) => source)),
        );

        const targetNames = Array.from(
          new Set(filteredRelations.map(({ target }) => target)),
        );

        const qualifierNames = Array.from(
          new Set(filteredRelations.map(({ qualifier }) => qualifier)),
        );

        const min = filteredRelations.reduce(
          (acc, curr) => acc + curr.min_count,
          0,
        );

        const max = filteredRelations.reduce(
          (acc, curr) => acc + curr.max_count,
          0,
        );

        return {
          sourceNames,
          targetNames,
          min,
          max,
          qualifierNames,
        };
      }, [relationConfig, soureRelations, targetRelations]);

    return (
      <Grid align="center" gutter={"md"}>
        <Grid.Col span={12}>
          <Group justify="space-between" align="start">
            <Group>
              <Controller
                control={control}
                name={`${relationType}.${index}.direction`}
                render={({ field }) => (
                  <>
                    <Select
                      data={[
                        { value: "source", label: "Source" },
                        { value: "target", label: "Target" },
                      ]}
                      label={"Direction"}
                      value={field.value ?? "source"}
                      onChange={field.onChange}
                    />
                  </>
                )}
              />
              <Controller
                control={control}
                name={`${relationType}.${index}.mode`}
                render={({ field }) => (
                  <Select
                    data={[
                      { value: "include", label: "Include" },
                      { value: "exclude", label: "Exclude" },
                    ]}
                    label={"Mode"}
                    value={field.value ?? "include"}
                    onChange={field.onChange}
                  />
                )}
              />
            </Group>
            <Button onClick={remove} variant="subtle" color="red" p={0}>
              <X size={25} color="red" />
            </Button>
          </Group>
        </Grid.Col>
        <Grid.Col span={4}>
          <Controller
            control={control}
            name={`${relationType}.${index}.source`}
            rules={{ required: "Source is required" }}
            render={({ field }) => (
              <Select
                data={sourceNames}
                label={"Source"}
                value={field.value ?? ""}
                onChange={(newValue) => field.onChange(newValue ?? "")}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col
          span={4}
          display={"flex"}
          style={{ justifyContent: "center" }}
        >
          <Controller
            control={control}
            name={`${relationType}.${index}.qualifier`}
            render={({ field }) => (
              <Select
                data={qualifierNames}
                label={"Qualifier"}
                value={field.value ?? ""}
                onChange={(newValue) => field.onChange(newValue ?? "")}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <Controller
            control={control}
            name={`${relationType}.${index}.target`}
            rules={{ required: "Target is required" }}
            render={({ field }) => (
              <Select
                data={targetNames}
                label={"Target"}
                value={field.value ?? ""}
                onChange={(newValue) => field.onChange(newValue ?? "")}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={12}>
          {relationConfig?.source && relationConfig?.target && (
            <Controller
              control={control}
              name={`${relationType}.${index}.range`}
              render={({ field }) => (
                <RangeSlider
                  py={"md"}
                  minRange={0}
                  value={[field.value?.[0] ?? min, field.value?.[1] ?? max]}
                  max={max}
                  min={min}
                  onChange={([min, max]) => {
                    field.onChange([min, max]);
                  }}
                />
              )}
            />
          )}
        </Grid.Col>
      </Grid>
    );
  },
);

const filterRelation = (relationSummary: RelationCountSummary) =>
  relationSummary.min_count < relationSummary.max_count;

export const E2OCountFilter: React.FC<FilterPageComponentProps> = ({
  ocelParams,
  control,
}) => {
  const { data: e2o = [] } = useE2o({
    ...ocelParams,
    direction: "source",
  });

  const { data: o2e = [] } = useE2o({
    ...ocelParams,
    direction: "target",
  });

  // #TODO: Fix allowing duplicate relation filters
  const { filterableE2ORelation, filterableO2ERelation } = useMemo(() => {
    const filterableE2ORelation = e2o.filter(filterRelation);

    const filterableO2ERelation = o2e.filter(filterRelation);

    return { filterableE2ORelation, filterableO2ERelation };
  }, [e2o, o2e]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "e2o_count",
  });

  return (
    <>
      <Stack>
        {fields.map((field, index) => (
          <Paper shadow="xs" p="md" key={field.id}>
            <RelationFilter
              control={control}
              index={index}
              relationType={"e2o_count"}
              soureRelations={filterableE2ORelation}
              targetRelations={filterableO2ERelation}
              remove={() => remove(index)}
            />
          </Paper>
        ))}

        <Button
          onClick={() =>
            append({ source: "", target: "", range: [null, null] })
          }
          leftSection={<PlusIcon height={30} />}
        >
          Add Filter
        </Button>
      </Stack>
    </>
  );
};
export const O2OCountFilter: React.FC<FilterPageComponentProps> = ({
  ocelParams,
  control,
}) => {
  const { data: o2o = [] } = useO2o({
    ...ocelParams,
    direction: "source",
  });

  const { data: o2oReverse = [] } = useO2o({
    ...ocelParams,
    direction: "target",
  });

  const { filterableO2ORelation, filterableO2OReverseRelation } =
    useMemo(() => {
      const filterableO2ORelation = o2o.filter(filterRelation);

      const filterableO2OReverseRelation = o2oReverse.filter(filterRelation);

      return {
        filterableO2ORelation,
        filterableO2OReverseRelation,
      };
    }, [o2o, o2oReverse]);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "o2o_count",
  });

  return (
    <>
      <Stack>
        {fields.map((field, index) => (
          <Paper shadow="xs" p="md" key={field.id}>
            <RelationFilter
              control={control}
              relationType="o2o_count"
              index={index}
              soureRelations={filterableO2ORelation}
              targetRelations={filterableO2OReverseRelation}
              remove={() => remove(index)}
            />
          </Paper>
        ))}

        <Button
          onClick={() =>
            append({ range: [null, null], source: "", target: "" })
          }
          leftSection={<PlusIcon height={30} />}
        >
          Add Filter
        </Button>
      </Stack>
    </>
  );
};
