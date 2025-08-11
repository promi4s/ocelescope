import Form from "@aokiapp/rjsf-mantine-theme";
import { Box, Button, Group } from "@mantine/core";
import validator from "@rjsf/validator-ajv8";
import { ComponentProps, useMemo } from "react";
import {
  buildOcelUiSchema,
  ocelFieldMap,
  wrapFieldsWithContext,
} from "./Fields";
import { Control, Controller } from "react-hook-form";
import { PluginInputType } from ".";

type PluginFormProps = {
  schema: { [key: string]: any };
  control: Control<PluginInputType>;
  onSubmit: () => void;
};

const pluginTemplate: ComponentProps<typeof Form>["templates"] = {
  ButtonTemplates: {
    SubmitButton: () => (
      <Group align="center" justify="center">
        <Button type="submit" color="green">
          Run
        </Button>
      </Group>
    ),
  },
  ObjectFieldTemplate: ({ properties, description }) => (
    <Box style={{ padding: 0, border: "none" }}>
      {description && <p>{description}</p>}
      {properties.map((prop) => (
        <Box key={prop.name} mb="sm">
          {prop.content}
        </Box>
      ))}
    </Box>
  ),
};
const PluginForm: React.FC<PluginFormProps> = ({
  schema,
  control,
  onSubmit,
}) => {
  const uiSchema = useMemo(() => {
    return buildOcelUiSchema(schema, {}, []);
  }, [schema]);

  const fields = useMemo(
    () => wrapFieldsWithContext(control, ocelFieldMap),
    [control],
  );

  return (
    <Controller
      control={control}
      name="input"
      render={({ field }) => (
        <>
          <Form
            schema={schema}
            formData={field.value}
            validator={validator}
            uiSchema={uiSchema}
            fields={fields}
            onChange={(data) => {
              field.onChange(data.formData);
            }}
            onSubmit={onSubmit}
            templates={pluginTemplate}
          />
        </>
      )}
    />
  );
};

export default PluginForm;
