import { LoadingOverlay } from "@mantine/core";
import { defineModuleRoute, useCurrentOcel } from "@ocelescope/core";

import { SchemaConfiguration } from "../components/SchemaConfiguration";

const SchemaPage = () => {
  const { id } = useCurrentOcel();
  return id ? (
    <SchemaConfiguration key={id} ocelId={id} />
  ) : (
    <LoadingOverlay visible />
  );
};

export default defineModuleRoute({
  component: SchemaPage,
  label: "Schema configuration",
  name: "schema",
  requiresOcel: true,
});
