import EntityTable from "@/components/EntityTable/EntityTable";
import RecentPlugins from "@/components/Plugins/RecentPlugins/RecentPlugins";
import { Container, Group, Stack, Title } from "@mantine/core";

const Overview = () => {
  return (
    <Container h="100%">
      <Stack gap={"sm"} h="100%">
        <EntityTable />
        <Stack gap={"xs"} flex={1}>
          <Title size={"h3"}>Plugins</Title>
          <RecentPlugins />
        </Stack>
      </Stack>
    </Container>
  );
};

export default Overview;
