import { Container, Stack } from "@mantine/core";
import { defineModuleRoute } from "@ocelescope/core";
import ResourceManagementTable from "../components/ResourceManagementTable";

const ResourceManagementPage: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <Container h="100%">
      <Stack gap={"sm"} h="100%">
        <ResourceManagementTable />
        {children}
      </Stack>
    </Container>
  );
};

export default defineModuleRoute({
  component: ResourceManagementPage,
  label: "Management",
  name: "management",
});
