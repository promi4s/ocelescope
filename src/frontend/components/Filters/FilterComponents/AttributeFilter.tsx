import {
  useEventAttributes,
  useObjectAttributes,
} from "@/api/fastapi/ocels/ocels";
import {
  type Control,
  Controller,
  useFieldArray,
  useWatch,
} from "react-hook-form";
import {
  Button,
  Grid,
  NumberInput,
  Paper,
  Select,
  Stack,
  TextInput,
} from "@mantine/core";
import { memo, type ReactNode, useMemo } from "react";
import type {
  EventAttributes200,
  EventAttributes200Item,
  ObjectAttributes200,
  ObjectAttributes200Item,
  OCELFilter,
} from "@/api/fastapi-schemas";
import { DatePickerInput } from "@mantine/dates";
import { PlusIcon, XIcon } from "lucide-react";
import type { FilterPageComponentProps } from "..";
import type { FilterType } from "@/types/filters";

type AttributeFilterProps = {
  control: Control<OCELFilter>;
  attributes: EventAttributes200 | ObjectAttributes200;
  index: number;
  attributeType: Extract<FilterType, "event_attributes" | "object_attributes">;
};

type AttributeTypes = (
  | ObjectAttributes200Item
  | EventAttributes200Item
)["type"];
type Attribute = EventAttributes200Item | ObjectAttributes200Item;

type AttirbuteByType<K extends AttributeTypes> = Extract<
  AttributeTypes,
  { type: K }
>;

type AttributeTypeInput = (
  props: Omit<AttributeFilterProps, "attributes"> & {
    attribute: Attribute;
  },
) => ReactNode;

const attributeTypeToInput: {
  [K in AttributeTypes]: AttributeTypeInput;
} = {
  boolean: ({ index, control }) => (
    <Grid.Col span={6}>{"Not Implemented"}</Grid.Col>
  ),
  date: ({ control, index, attribute, attributeType }) => {
    const { min, max } = attribute as AttirbuteByType<"date">;
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
    const { min, max } = attribute as AttirbuteByType<"float">;
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
  integer: ({ attribute, attributeType, control, index }) => {
    const { min, max } = attribute as AttirbuteByType<"integer">;
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
                max={value?.[1] ? Number.parseInt(`${value[1]}`) : max}
                value={value?.[0] ?? min}
                onChange={(newMin) => onChange([newMin, value?.[1] ?? null])}
              />
            </Grid.Col>
            <Grid.Col span={3}>
              <NumberInput
                label={"max"}
                min={value?.[0] ? Number.parseInt(`${value[0]}`) : min}
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
  nominal: ({ index, attributeType, control }) => (
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

    const filteredAttributes = Object.entries(attributes ?? {})
      .filter(
        ([entityName, _]) =>
          !value.target_type ||
          value.target_type === "" ||
          !value.target_type ||
          entityName === value.target_type,
      )
      .flatMap(([_, attributes]) =>
        attributes.filter(
          ({ attribute }) =>
            !value.attribute ||
            value.attribute === "" ||
            attribute === value.attribute,
        ),
      );

    const attributeNames = Array.from(
      new Set(filteredAttributes.map(({ attribute }) => attribute)),
    );

    const targetNames = Object.entries(attributes)
      .filter(([_, attributes]) =>
        attributes.some(({ attribute }) => attributeNames.includes(attribute)),
      )
      .map(([targetName, _]) => targetName);

    const currentAttribute = attributes[value.target_type]?.find(
      ({ attribute }) => attribute === value.attribute,
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
  ({ ocelParams, control }) => {
    const { data: attributes = {} } = useEventAttributes({ ...ocelParams });

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
  ({ ocelParams, control }) => {
    const { data: attributes = {} } = useObjectAttributes({ ...ocelParams });

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
