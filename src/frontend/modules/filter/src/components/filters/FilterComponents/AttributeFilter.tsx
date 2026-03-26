//TODO: Refactor this whole file :(
import {
  Button,
  Grid,
  NumberInput,
  Paper,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import type { OCELFilter, TypedAttribute } from "@ocelescope/api-base";
import { useEventAttributes, useObjectAttributes } from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import { memo, type ReactNode, useMemo } from "react";
import {
  type Control,
  Controller,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import type { FilterType } from "../../../types/filter";
import type { FilterPageComponentProps } from "..";

type AttributeFilterProps = {
  control: Control<OCELFilter>;
  attributes: TypedAttribute[];
  index: number;
  attributeType: Extract<FilterType, "event_attributes" | "object_attributes">;
};

type AttributeTypeInput = (
  props: Omit<AttributeFilterProps, "attributes"> & {
    attribute: TypedAttribute;
  },
) => ReactNode;

const attributeTypeToInput: {
  [K in TypedAttribute["type"]]: AttributeTypeInput;
} = {
  bool: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  date_mixed: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  empty: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  mixed: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  object: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  numeric: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
  date: ({ control, index, attribute, attributeType }) => {
    const { min, max } = attribute as { min: string; max: string };
    return (
      <Grid.Col span={6}>
        <Controller
          control={control}
          name={`${attributeType}.${index}.time_range`}
          render={({ field: { onChange, value } }) => (
            <DatePickerInput
              label={"Date Range"}
              value={[value?.[0] ?? min, value?.[1] as string]}
              onChange={([a, b]) => onChange([a ?? undefined, b ?? undefined])}
              type="range"
              minDate={min}
              maxDate={max}
            />
          )}
        />
      </Grid.Col>
    );
  },
  float: ({ attribute, attributeType, index, control }) => {
    const { min, max } = attribute as { min: number; max: number };
    return (
      <Controller
        control={control}
        name={`${attributeType}.${index}.number_range`}
        render={({ field: { onChange, value } }) => (
          <>
            <Grid.Col span={3}>
              <NumberInput
                label={"min"}
                min={min}
                max={value?.[1] ? Number.parseFloat(`${value[1]}`) : max}
                value={value?.[0] ?? min}
                onChange={(newMin) => onChange([newMin, value?.[1] ?? null])}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label={"max"}
                min={value?.[0] ? Number.parseFloat(`${value[0]}`) : min}
                max={max}
                value={value?.[1] ?? max}
                onChange={(newMax) => onChange([value?.[0] ?? null, newMax])}
              />
            </Grid.Col>
          </>
        )}
      />
    );
  },
  int: ({ attribute, attributeType, control, index }) => {
    const { min, max } = attribute as { min: number; max: number };
    return (
      <Controller
        control={control}
        name={`${attributeType}.${index}.number_range`}
        render={({ field: { onChange, value } }) => (
          <>
            <Grid.Col span={3}>
              <NumberInput
                label={"min"}
                min={min}
                max={value?.[1] ? Number.parseInt(`${value[1]}`, 10) : max}
                value={value?.[0] ?? min}
                onChange={(newMin) => onChange([newMin, value?.[1] ?? null])}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label={"max"}
                min={value?.[0] ? Number.parseInt(`${value[0]}`, 10) : min}
                max={max}
                value={value?.[1] ?? max}
                onChange={(newMax) => onChange([value?.[0] ?? null, newMax])}
              />
            </Grid.Col>
          </>
        )}
      />
    );
  },
  string: ({ index, attributeType, control }) => (
    <Controller
      control={control}
      name={`${attributeType}.${index}.regex`}
      render={({ field }) => (
        <Grid.Col span={6}>
          <TextInput
            label={"Regex"}
            value={field.value ?? undefined}
            onChange={field.onChange}
          />
        </Grid.Col>
      )}
    />
  ),
};

const AttributeFilter: React.FC<AttributeFilterProps> = ({
  attributes,
  control,
  attributeType,
  index,
}) => {
  const value = useWatch({ control, name: `${attributeType}.${index}` });

  const { attributeNames, targetNames, currentAttribute } = useMemo(() => {
    if (!value) {
      return {};
    }

    const attributeNames = Array.from(
      new Set(
        attributes
          .filter(
            ({ entity_type }) =>
              !value.target_type || value.target_type === entity_type,
          )
          .map(({ name }) => name),
      ),
    );

    const targetNames = Array.from(
      new Set(
        attributes
          .filter(({ name }) => !value.attribute || value.attribute === name)
          .map(({ entity_type }) => entity_type),
      ),
    );

    const currentAttribute = attributes.find(
      ({ entity_type, name }) =>
        entity_type === value.target_type && value.attribute === name,
    );

    return { attributeNames, targetNames, currentAttribute };
  }, [value, attributes]);

  return (
    <Grid>
      <Grid.Col span={3}>
        <Controller
          control={control}
          name={`${attributeType}.${index}.target_type`}
          rules={{ required: "The target is Required" }}
          render={({ field }) => (
            <Select
              data={targetNames}
              label={"Type"}
              onChange={field.onChange}
              value={field?.value}
            />
          )}
        />
      </Grid.Col>
      <Grid.Col span={3}>
        <Controller
          control={control}
          name={`${attributeType}.${index}.attribute`}
          rules={{ required: "The target is Required" }}
          render={({ field }) => (
            <Select
              label={"Attribute Name"}
              data={attributeNames}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Grid.Col>
      {currentAttribute &&
        attributeTypeToInput[currentAttribute.type]({
          attribute: currentAttribute,
          control,
          attributeType,
          index,
        })}
    </Grid>
  );
};

export const EventAttributeFilter: React.FC<FilterPageComponentProps> = memo(
  ({ ocelId, control }) => {
    const { data: attributes = [] } = useEventAttributes(ocelId, {
      ocel_version: "original",
    });

    const { fields, append, remove } = useFieldArray({
      control,
      name: "event_attributes",
    });

    return (
      <Stack>
        {fields.map((field, index) => (
          <Paper shadow="xs" p="md" key={field.id}>
            <Grid gutter={0}>
              <Grid.Col
                style={{ display: "flex", justifyContent: "end" }}
                offset={11}
                span={1}
              >
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => remove(index)}
                >
                  <XIcon color="red" />
                </Button>
              </Grid.Col>
              <Grid.Col span={12}>
                <AttributeFilter
                  key={field.id}
                  attributeType="event_attributes"
                  control={control}
                  attributes={attributes}
                  index={index}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        ))}
        <Button
          onClick={() => append({ attribute: "", target_type: "" })}
          leftSection={<PlusIcon height={30} />}
        >
          Add Filter
        </Button>
      </Stack>
    );
  },
);
export const ObjectAttributeFilter: React.FC<FilterPageComponentProps> = memo(
  ({ ocelId, control }) => {
    const { data: attributes = [] } = useObjectAttributes(ocelId, {
      ocel_version: "original",
    });

    const { fields, append, remove } = useFieldArray({
      name: "object_attributes",
      control,
    });

    return (
      <Stack>
        {fields.map((field, index) => (
          <Paper shadow="xs" p="md" key={field.id}>
            <Grid gutter={0}>
              <Grid.Col
                style={{ display: "flex", justifyContent: "end" }}
                offset={11}
                span={1}
              >
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => remove(index)}
                >
                  <XIcon color="red" />
                </Button>
              </Grid.Col>
              <Grid.Col span={12}>
                <AttributeFilter
                  key={field.id}
                  attributeType="object_attributes"
                  control={control}
                  attributes={attributes}
                  index={index}
                />
              </Grid.Col>
            </Grid>
          </Paper>
        ))}
        <Button
          onClick={() => append({ attribute: "", target_type: "" })}
          leftSection={<PlusIcon height={30} />}
        >
          Add Filter
        </Button>
      </Stack>
    );
  },
);
