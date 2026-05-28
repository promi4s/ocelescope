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
import type { TypedAttribute } from "@ocelescope/api-base";
import { useEventAttributes, useObjectAttributes } from "@ocelescope/api-base";
import { PlusIcon, XIcon } from "lucide-react";
import { memo, type ReactNode, useMemo } from "react";
import { type Control, Controller, useFieldArray } from "react-hook-form";
import type { GroupedOCELFilter } from "../../api/base";

type AttributeFilterProps = {
  control: Control<GroupedOCELFilter>;
  attributes: TypedAttribute[];
  index: number;
  attributeType: Extract<
    keyof GroupedOCELFilter,
    "event_attribute" | "object_attribute"
  >;
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
  empty: () => <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>,
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
export const ObjectAttributeFilter: React.FC<{
  ocelId: string;
  control: Control<GroupedOCELFilter>;
}> = memo(({ ocelId, control }) => {
  const { data: attributes } = useObjectAttributes(ocelId, {
    ocel_version: "original",
  });

  const { fields, append, remove } = useFieldArray({
    name: "event_attribute",
    control,
  });

  const availableAttributes = useMemo(() => {
    const allAttributes = (attributes ?? []).filter(
      ({ distinct_values, name, entity_type }) =>
        distinct_values > 1 &&
        fields.some(
          ({ type, attribute }) => name !== attribute && entity_type !== type,
        ),
    );

    return allAttributes;
  }, [attributes, fields]);

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
              <Controller />
              <AttributeFilter
                key={field.id}
                attributeType=""
                control={control}
                attributes={availableAttributes}
                index={index}
              />
            </Grid.Col>
          </Grid>
        </Paper>
      ))}
      <Button leftSection={<PlusIcon height={30} />}>Add Filter</Button>
    </Stack>
  );
});
