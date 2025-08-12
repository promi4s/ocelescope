import { useEventCounts, useObjectCount } from "@/api/fastapi/ocels/ocels";
import { Box, MultiSelect, Select } from "@mantine/core";
import { FieldProps } from "@rjsf/utils";
import { Control, useWatch } from "react-hook-form";
import { PluginInputType } from "..";
import React, { memo } from "react";

type OcelFieldProps = {
  value: any;
  isMulti: boolean;
  onChange: (data: any) => void;
  ocelId: string;
  label?: string;
  description?: string;
  requiered?: boolean;
};

// TODO: Merge EventType and ObjectTypeSelector
const EventTypeSelector: React.FC<OcelFieldProps> = ({
  ocelId,
  onChange,
  requiered,
  value,
  isMulti,
  label,
  description,
}) => {
  const { data = {} } = useEventCounts({ ocel_id: ocelId });
  const SelectComponent = isMulti ? MultiSelect : Select;

  return (
    <Box>
      <SelectComponent
        value={value}
        label={label}
        required={requiered}
        clearable
        description={description}
        onChange={onChange}
        data={Object.keys(data)}
      />
    </Box>
  );
};

const ObjectTypeSelector: React.FC<OcelFieldProps> = memo(
  ({ ocelId, onChange, requiered, value, isMulti, label, description }) => {
    const { data = {} } = useObjectCount({ ocel_id: ocelId });
    const SelectComponent = isMulti ? MultiSelect : Select;

    return (
      <Box>
        <SelectComponent
          value={value}
          label={label}
          required={requiered}
          clearable
          description={description}
          onChange={onChange}
          data={Object.keys(data)}
          searchable
        />
      </Box>
    );
  },
);

const ocelFieldMap: Record<string, React.FC<OcelFieldProps>> = {
  event_type: EventTypeSelector,
  object_type: ObjectTypeSelector,
};

export const wrapFieldsWithContext = (control: Control<PluginInputType>) => {
  const wrapped: Record<string, React.FC<FieldProps>> = {};

  Object.entries(ocelFieldMap).forEach(([name, Field]) => {
    const Comp: React.FC<FieldProps> = ({
      schema,
      required,
      formData,
      onChange,
    }) => {
      const ocelRef = schema?.["x-ui-meta"]?.ocel_id;
      const isMulti = schema?.type === "array";
      const ocelId = useWatch({ control, name: `input_ocels.${ocelRef}` });

      return (
        <Field
          label={schema?.title}
          requiered={required}
          description={schema?.description}
          isMulti={isMulti}
          onChange={onChange}
          value={formData}
          ocelId={ocelId}
        />
      );
    };

    wrapped[name] = memo(Comp);
  });

  return wrapped;
};
